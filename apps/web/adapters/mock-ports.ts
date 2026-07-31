/**
 * RFC-0003 Mock adapters.
 *
 * 全部“外部能力”都在这里模拟：会话、上传/识别、需求解析、预算保存和推荐。
 * 页面不散落 fixture，也不调用 fetch、数据库或 Agent SDK。
 */
import {
  collectMenuIssues,
  conflictRecommendation,
  createMockMembers,
  mockRecommendation
} from "@/mocks/fixtures";
import type {
  AgentRuntimeGateway,
  CreateSessionInput,
  FrontendPorts,
  MenuGateway,
  RecommendationGateway,
  SessionGateway
} from "@/ports/frontend-ports";
import {
  assertMembers,
  assertMenuSnapshot,
  assertPricingDraft,
  assertRecommendation,
  assertSession
} from "@/schemas/frontend-schemas";
import { getDraft, saveDraft } from "@/state/session-draft-store";
import type { MemberConstraint, RecommendationPlanView } from "@/domain/types";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createSessionId(): string {
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextRevision(sessionId: string) {
  return getDraft(sessionId).session.revision + 1;
}

export const mockSessionGateway: SessionGateway = {
  async createDraft(input: CreateSessionInput) {
    await wait(180);
    const id = createSessionId();
    const draft = getDraft(id);
    const members = assertMembers(createMockMembers(input.peopleCount, input.hasTakeoutMember));
    const session = assertSession({
      ...draft.session,
      id,
      title: input.title || "周五晚餐",
      mealType: input.mealType,
      currency: input.currency,
      peopleCount: input.peopleCount,
      takeoutPeopleCount: input.hasTakeoutMember ? 1 : 0,
      currentStep: "menu",
      phase: "menu_uploading",
      revision: 1
    });

    saveDraft(id, {
      session,
      members,
      recommendation: null
    });
    return { data: session };
  },

  async restoreDraft(sessionId: string) {
    await wait(60);
    return { data: assertSession(getDraft(sessionId).session) };
  },

  async advanceStep(sessionId: string, step) {
    await wait(60);
    const draft = getDraft(sessionId);
    const phase = step === "menu"
      ? "menu_uploading"
      : step === "review"
        ? "menu_needs_review"
        : step === "members"
          ? "requirements_editing"
          : step === "budget"
            ? "ready_to_generate"
            : "result_ready";
    const session = assertSession({
      ...draft.session,
      currentStep: step,
      phase,
      revision: draft.session.revision + 1
    });
    saveDraft(sessionId, { session });
    return { data: session };
  }
};

export const mockMenuGateway: MenuGateway = {
  async uploadImage(sessionId, image) {
    await wait(160);
    const draft = getDraft(sessionId);
    const nextImage = {
      ...image,
      id: `image-${draft.menuSnapshot.images.length + 1}`,
      pageIndex: draft.menuSnapshot.images.length + 1,
      status: "uploaded" as const
    };
    const snapshot = assertMenuSnapshot({
      ...draft.menuSnapshot,
      images: [...draft.menuSnapshot.images, nextImage],
      extractionJob: {
        ...draft.menuSnapshot.extractionJob,
        status: "idle",
        progress: 0,
        stage: "queued",
        message: "新图片已进入 Mock 识别队列"
      }
    });
    return { data: saveDraft(sessionId, { menuSnapshot: snapshot }).menuSnapshot };
  },

  async startExtraction(sessionId) {
    const draft = getDraft(sessionId);
    const stages = [
      { stage: "reading_images" as const, progress: 28, message: "正在读取菜单图片…" },
      { stage: "detecting_items" as const, progress: 62, message: "正在识别菜名、价格与配料…" },
      { stage: "validating_prices" as const, progress: 88, message: "正在合并页面并检查价格…" }
    ];

    for (const stage of stages) {
      const current = getDraft(sessionId);
      saveDraft(sessionId, {
        session: { ...current.session, phase: "menu_extracting" },
        menuSnapshot: assertMenuSnapshot({
          ...current.menuSnapshot,
          extractionJob: {
            ...current.menuSnapshot.extractionJob,
            status: "running",
            title: "正在识别菜单",
            retryable: false,
            ...stage
          }
        })
      });
      await wait(220);
    }

    const completed = assertMenuSnapshot({
      ...draft.menuSnapshot,
      revision: draft.menuSnapshot.revision + 1,
      issueSummary: collectMenuIssues(draft.menuSnapshot.items),
      extractionJob: {
        ...draft.menuSnapshot.extractionJob,
        status: "completed",
        stage: "completed",
        progress: 100,
        title: "菜单识别完成",
        message: "已识别 5 个菜品，1 项价格与低置信字段需要确认。",
        retryable: false
      }
    });
    saveDraft(sessionId, {
      session: { ...getDraft(sessionId).session, phase: "menu_needs_review" },
      menuSnapshot: completed
    });
    return { data: completed };
  },

  async saveItem(sessionId, itemId, patch) {
    await wait(60);
    const draft = getDraft(sessionId);
    const items = draft.menuSnapshot.items.map((item) => item.id === itemId ? { ...item, ...patch } : item);
    const snapshot = assertMenuSnapshot({
      ...draft.menuSnapshot,
      revision: draft.menuSnapshot.revision + 1,
      items,
      issueSummary: collectMenuIssues(items)
    });
    return { data: saveDraft(sessionId, { menuSnapshot: snapshot }).menuSnapshot };
  },

  async confirmMenu(sessionId) {
    await wait(100);
    const draft = getDraft(sessionId);
    const activeItems = draft.menuSnapshot.items.filter((item) => item.recommendationEligible && item.availability === "available");
    const invalid = activeItems.filter((item) => !item.name.trim() || item.price.status !== "confirmed" || !item.accepted);

    if (activeItems.length === 0 || invalid.length > 0) {
      throw new Error(`还有 ${invalid.length || 1} 个入选菜品未完成价格或人工确认`);
    }

    const snapshot = assertMenuSnapshot({
      ...draft.menuSnapshot,
      revision: draft.menuSnapshot.revision + 1,
      issueSummary: ["过敏原候选仅供提示，下单前仍需向餐厅确认"]
    });
    saveDraft(sessionId, {
      menuSnapshot: snapshot,
      session: {
        ...draft.session,
        currentStep: "members",
        phase: "menu_confirmed",
        revision: nextRevision(sessionId)
      }
    });
    return { data: snapshot };
  },

  async getMenuSnapshot(sessionId) {
    await wait(60);
    return { data: assertMenuSnapshot(getDraft(sessionId).menuSnapshot) };
  }
};

function parsedConstraints(memberId: string, text: string): MemberConstraint[] {
  const constraints: MemberConstraint[] = [];
  const normalized = text.trim();

  if (normalized.includes("花生") || normalized.includes("过敏")) {
    constraints.push({
      id: `constraint-${memberId}-allergy`,
      label: normalized.includes("花生") ? "严重过敏：花生" : "严重过敏风险",
      type: "allergy",
      severity: "critical",
      confirmed: false,
      source: "mock-agent",
      evidence: normalized
    });
  }
  if (normalized.includes("不辣") || normalized.includes("清淡")) {
    constraints.push({
      id: `constraint-${memberId}-mild`,
      label: normalized.includes("清淡") ? "偏好清淡" : "偏好不辣",
      type: "preference",
      severity: "soft",
      confirmed: true,
      source: "mock-agent",
      evidence: normalized
    });
  }
  if (normalized.includes("素食") || normalized.includes("不吃肉")) {
    constraints.push({
      id: `constraint-${memberId}-vegetarian`,
      label: "素食",
      type: "diet",
      severity: "hard",
      confirmed: true,
      source: "mock-agent",
      evidence: normalized
    });
  }
  if (normalized.includes("预算") || normalized.includes("便宜")) {
    constraints.push({
      id: `constraint-${memberId}-budget`,
      label: "控制人均预算",
      type: "budget",
      severity: "soft",
      confirmed: true,
      source: "mock-agent",
      evidence: normalized
    });
  }
  return constraints;
}

export const mockAgentRuntimeGateway: AgentRuntimeGateway = {
  async parseMemberRequirement(sessionId, memberId, text) {
    await wait(240);
    const draft = getDraft(sessionId);
    const member = draft.members.find((item) => item.id === memberId);
    if (!member) {
      throw new Error("成员不存在");
    }
    if (text.includes("模拟解析失败")) {
      throw new Error("Mock Agent 暂时无法解析，可修改原文后重试或手工添加约束");
    }

    const constraints = parsedConstraints(memberId, text);
    const hasCritical = constraints.some((constraint) => constraint.severity === "critical");
    const nextMember = {
      ...member,
      requirementText: text,
      noRequirements: text.trim().length === 0,
      constraints,
      clarificationQuestions: hasCritical ? ["请确认需要完全避免花生及可能的交叉接触。"] : [],
      parseStatus: hasCritical ? "needs_review" as const : "parsed" as const
    };
    saveDraft(sessionId, {
      members: draft.members.map((item) => item.id === memberId ? nextMember : item)
    });
    return {
      data: {
        memberId,
        constraints,
        clarificationQuestions: nextMember.clarificationQuestions,
        confidence: hasCritical ? 0.78 : 0.93
      }
    };
  }
};

function buildSuccessPlan(sessionId: string): RecommendationPlanView {
  const draft = getDraft(sessionId);
  const previousVersion = draft.recommendation?.version ?? 0;
  const result = structuredClone(mockRecommendation);
  const subtotal = result.pricing.subtotal.minorValue;
  let thresholdDiscount = 0;
  let couponDiscount = 0;

  for (const promotion of draft.pricingDraft.promotions.filter((item) => item.enabled)) {
    if (promotion.type === "threshold_discount" && subtotal >= promotion.threshold.minorValue) {
      thresholdDiscount += promotion.discount.minorValue;
    }
    if (promotion.type === "fixed_coupon" && subtotal >= promotion.minimumSpend.minorValue) {
      couponDiscount += promotion.amount.minorValue;
    }
  }

  const total = subtotal - thresholdDiscount - couponDiscount;
  result.version = previousVersion + 1;
  result.id = `plan-${sessionId}-v${result.version}`;
  result.pricing.thresholdDiscount = { minorValue: thresholdDiscount, currency: draft.session.currency };
  result.pricing.couponDiscount = { minorValue: couponDiscount, currency: draft.session.currency };
  result.pricing.total = { minorValue: total, currency: draft.session.currency };
  result.pricing.budgetRemaining = {
    minorValue: draft.pricingDraft.budget.minorValue - total,
    currency: draft.session.currency
  };
  result.memberCoverage = draft.members.map((member) => ({
    memberId: member.id,
    memberName: `${member.name}${member.presence === "takeout" ? " · 打包" : ""}`,
    satisfied: Math.max(1, member.constraints.length),
    total: Math.max(1, member.constraints.length),
    status: "satisfied",
    summary: member.constraints.length > 0
      ? member.constraints.map((constraint) => constraint.label).join("、")
      : "无特殊要求，份量已覆盖"
  }));
  result.revisionSource = `menu-r${draft.menuSnapshot.revision} · members-r${draft.session.revision} · pricing-r${draft.session.revision}`;
  return assertRecommendation(result);
}

export const mockRecommendationGateway: RecommendationGateway = {
  async savePricingDraft(sessionId, draft) {
    await wait(120);
    const nextDraft = assertPricingDraft(draft);
    const current = getDraft(sessionId);
    saveDraft(sessionId, {
      pricingDraft: nextDraft,
      session: {
        ...current.session,
        currentStep: "result",
        phase: "ready_to_generate",
        revision: current.session.revision + 1
      }
    });
    return { data: nextDraft };
  },

  async runRecommendation(sessionId) {
    const current = getDraft(sessionId);
    saveDraft(sessionId, {
      session: { ...current.session, phase: "generating" }
    });
    await wait(560);

    const draft = getDraft(sessionId);
    const hasCriticalUnconfirmed = draft.members.some((member) =>
      member.constraints.some((constraint) => constraint.severity === "critical" && !constraint.confirmed)
    );
    const successPlan = buildSuccessPlan(sessionId);
    const budgetTooLow = draft.pricingDraft.budget.minorValue < successPlan.pricing.total.minorValue;
    let result: RecommendationPlanView;

    if (hasCriticalUnconfirmed || budgetTooLow) {
      result = structuredClone(conflictRecommendation);
      result.version = (draft.recommendation?.version ?? 0) + 1;
      result.id = `plan-${sessionId}-conflict-v${result.version}`;
      result.pricing.budgetRemaining = {
        minorValue: draft.pricingDraft.budget.minorValue - result.pricing.total.minorValue,
        currency: draft.session.currency
      };
      result.unmetConstraints = [
        ...(budgetTooLow ? [`预算还差 ¥${Math.ceil(Math.abs(result.pricing.budgetRemaining.minorValue) / 100)}`] : []),
        ...(hasCriticalUnconfirmed ? ["严重过敏约束尚未二次确认"] : [])
      ];
      result = assertRecommendation(result);
    } else {
      result = successPlan;
    }

    saveDraft(sessionId, {
      recommendation: result,
      session: {
        ...draft.session,
        currentStep: "result",
        phase: result.status === "conflict" ? "conflict" : "result_ready",
        revision: draft.session.revision + 1
      }
    });
    return { data: result };
  },

  async getResult(sessionId) {
    await wait(60);
    const result = getDraft(sessionId).recommendation;
    if (!result) {
      throw new Error("推荐结果尚未生成");
    }
    return { data: assertRecommendation(result) };
  }
};

export function createMockFrontendPorts(): FrontendPorts {
  return {
    session: mockSessionGateway,
    menu: mockMenuGateway,
    agentRuntime: mockAgentRuntimeGateway,
    recommendation: mockRecommendationGateway
  };
}
