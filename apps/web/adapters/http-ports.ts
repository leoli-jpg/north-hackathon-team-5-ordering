/**
 * RFC-0003 HTTP Adapter for the RFC-0002 API on main.
 *
 * The API owns Postgres writes. Session-only UI state and requirement parsing
 * remain local because main does not expose session/member endpoints yet.
 * Network failures deliberately fall back to the complete Mock flow so the
 * demo remains usable when Docker is not running.
 */
import { createMockFrontendPorts } from "@/adapters/mock-ports";
import type {
  EditableMenuItem,
  MenuImageView,
  RecommendationPlanView
} from "@/domain/types";
import { assertRecommendation } from "@/schemas/frontend-schemas";
import { getDraft, saveDraft } from "@/state/session-draft-store";
import type { FrontendPorts } from "@/ports/frontend-ports";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "/ordering-api";
const remoteImageIds = new Map<string, Map<string, string>>();

type ApiMenuItem = {
  id: string;
  name: string;
  price_cents: number;
};

type ApiMenuList = {
  items: ApiMenuItem[];
};

type ApiMenuImage = {
  id: string;
};

type ApiRecommendation = {
  session_id: string;
  total_price_cents: number;
  items: Array<{
    menu_item_id: string;
    name: string;
    quantity: number;
    unit_price_cents: number;
    subtotal_cents: number;
  }>;
  reasons: string[];
  conflicts: string[];
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });

  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Ordering API 请求失败（${response.status}）`);
  }
  return payload;
}

function menuPayload(item: EditableMenuItem) {
  const price = item.price.status === "confirmed"
    ? item.price.money.minorValue
    : item.price.status === "estimated"
      ? item.price.suggestedMoney.minorValue
      : 0;

  return {
    name: item.name,
    description: item.description || null,
    price_cents: price,
    category: item.category,
    status: item.recommendationEligible ? "active" : "inactive",
    tags: [
      ...item.ingredientTags,
      ...item.allergenCandidates.map((allergen) => `过敏原:${allergen}`),
      `辣度:${item.spiceLevel}`
    ],
    ingredients: item.ingredientTags,
    attributes: {
      spice_level: item.spiceLevel,
      servings: item.servings,
      confidence: item.confidence,
      source: "rfc-0003-http-adapter"
    }
  };
}

async function persistMenuItems(items: EditableMenuItem[]) {
  const current = await apiRequest<ApiMenuList>("/api/menu-items?page_size=100&status=active");

  for (const item of items.filter((entry) => entry.accepted && entry.availability === "available")) {
    const existing = current.items.find((entry) => entry.name === item.name);
    await apiRequest(
      existing ? `/api/menu-items/${existing.id}` : "/api/menu-items",
      {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify(menuPayload(item))
      }
    );
  }
}

async function ensureRemoteImage(sessionId: string, image: MenuImageView) {
  const sessionImages = remoteImageIds.get(sessionId) ?? new Map<string, string>();
  const existing = sessionImages.get(image.id);
  if (existing) return existing;

  const remote = await apiRequest<ApiMenuImage>("/api/menu-images", {
    method: "POST",
    body: JSON.stringify({
      file_name: image.fileName || `menu-page-${image.pageIndex}.jpg`,
      storage_path: `demo/${sessionId}/${image.fileName || image.id}`,
      mime_type: image.fileName?.endsWith(".png") ? "image/png" : "image/jpeg",
      source: "manual"
    })
  });
  sessionImages.set(image.id, remote.id);
  remoteImageIds.set(sessionId, sessionImages);
  return remote.id;
}

function recommendationRequest(sessionId: string) {
  const draft = getDraft(sessionId);
  return {
    budget_cents: draft.pricingDraft.budget.minorValue,
    person_count: draft.session.peopleCount,
    member_constraints: draft.members.map((member) => ({
      member_id: member.id,
      allergies: member.constraints
        .filter((constraint) => constraint.type === "allergy")
        .map((constraint) => constraint.label.replace(/^严重过敏[：:]/, "").trim()),
      dislikes: member.constraints
        .filter((constraint) => constraint.type === "diet")
        .map((constraint) => constraint.label),
      spicy_tolerance: member.constraints.some((constraint) => constraint.label.includes("不辣"))
        ? "none"
        : "mild"
    }))
  };
}

function mapRecommendation(
  sessionId: string,
  remote: ApiRecommendation,
  scaffold: RecommendationPlanView
): RecommendationPlanView {
  const draft = getDraft(sessionId);
  const currency = draft.session.currency;
  const total = remote.total_price_cents;
  const hasItems = remote.items.length > 0;
  const assignedMemberIds = draft.members.map((member) => member.id);

  return assertRecommendation({
    ...scaffold,
    id: remote.session_id,
    title: hasItems ? "数据库实时推荐方案" : "当前条件下没有可行方案",
    status: hasItems ? "success" : "conflict",
    planItems: remote.items.map((item) => ({
      menuItemId: item.menu_item_id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: { minorValue: item.unit_price_cents, currency },
      subtotal: { minorValue: item.subtotal_cents, currency },
      assignedMemberIds,
      fulfillment: "shared",
      reasons: ["由 RFC-0002 推荐接口从 Postgres 菜单中选择"]
    })),
    pricing: {
      ...scaffold.pricing,
      subtotal: { minorValue: total, currency },
      thresholdDiscount: { minorValue: 0, currency },
      couponDiscount: { minorValue: 0, currency },
      total: { minorValue: total, currency },
      budgetRemaining: {
        minorValue: draft.pricingDraft.budget.minorValue - total,
        currency
      }
    },
    reasons: [
      ...remote.reasons,
      "结果已写入 recommendation_sessions 与 recommendation_items。"
    ],
    unmetConstraints: hasItems ? [] : (remote.conflicts.length > 0 ? remote.conflicts : ["数据库中没有满足当前约束的可选菜品"]),
    revisionSource: `${scaffold.revisionSource} · api:${remote.session_id.slice(0, 8)}`
  });
}

export function createHttpFrontendPorts(): FrontendPorts {
  const mock = createMockFrontendPorts();

  return {
    session: mock.session,
    agentRuntime: mock.agentRuntime,
    menu: {
      ...mock.menu,
      async uploadImage(sessionId, image) {
        const local = await mock.menu.uploadImage(sessionId, image);
        try {
          const uploaded = local.data.images.at(-1);
          if (uploaded) await ensureRemoteImage(sessionId, uploaded);
        } catch {
          // Docker/API 未启动时保留完整 Mock 演示。
        }
        return local;
      },
      async startExtraction(sessionId) {
        const local = await mock.menu.startExtraction(sessionId);
        try {
          for (const image of local.data.images) {
            const imageId = await ensureRemoteImage(sessionId, image);
            await apiRequest(`/api/menu-images/${imageId}/recognize`, {
              method: "POST",
              body: JSON.stringify({
                candidates: local.data.items.map((item) => ({
                  ...menuPayload(item),
                  confidence: item.confidence
                }))
              })
            });
          }
        } catch {
          // 识别 UI 使用稳定 View Model，远端不可用时不阻塞演示。
        }
        return local;
      },
      async confirmMenu(sessionId) {
        const local = await mock.menu.confirmMenu(sessionId);
        try {
          await persistMenuItems(local.data.items);
        } catch {
          // 菜单仍保留在当前会话；推荐阶段会再次尝试 API。
        }
        return local;
      }
    },
    recommendation: {
      ...mock.recommendation,
      async runRecommendation(sessionId) {
        try {
          await persistMenuItems(getDraft(sessionId).menuSnapshot.items);
          const remote = await apiRequest<ApiRecommendation>("/api/recommendations", {
            method: "POST",
            body: JSON.stringify(recommendationRequest(sessionId))
          });
          const scaffold = (await mock.recommendation.runRecommendation(sessionId)).data;
          const recommendation = mapRecommendation(sessionId, remote, scaffold);
          saveDraft(sessionId, {
            recommendation,
            session: {
              ...getDraft(sessionId).session,
              currentStep: "result",
              phase: recommendation.status === "conflict" ? "conflict" : "result_ready"
            }
          });
          return { data: recommendation };
        } catch {
          return mock.recommendation.runRecommendation(sessionId);
        }
      }
    }
  };
}
