/**
 * RFC-0003 runtime guards.
 *
 * Mock 与未来 HTTP/Agent Adapter 共用这些 guard。关键结果缺少结构时直接拒绝，
 * 不把部分不可信数据交给页面继续渲染。
 */
import type {
  DiningSessionView,
  EditableMenuItem,
  MemberView,
  MenuSnapshotView,
  PricingDraft,
  RecommendationPlanView
} from "@/domain/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function assertMoney(value: unknown, fieldName: string): { minorValue: number; currency: string } {
  if (!isRecord(value) || typeof value.minorValue !== "number" || typeof value.currency !== "string") {
    throw new Error(`${fieldName}金额格式无效`);
  }
  return value as { minorValue: number; currency: string };
}

export function assertSession(value: unknown): DiningSessionView {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" || typeof value.peopleCount !== "number") {
    throw new Error("会话格式无效");
  }
  return value as DiningSessionView;
}

export function assertMenuSnapshot(value: unknown): MenuSnapshotView {
  if (!isRecord(value) || !Array.isArray(value.items) || !Array.isArray(value.images) || !isRecord(value.extractionJob)) {
    throw new Error("菜单快照格式无效");
  }

  return {
    ...value,
    images: value.images as MenuSnapshotView["images"],
    items: value.items.map(assertMenuItem),
    issueSummary: Array.isArray(value.issueSummary) ? value.issueSummary.map(String) : []
  } as MenuSnapshotView;
}

export function assertMenuItem(value: unknown): EditableMenuItem {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string" || !isRecord(value.price)) {
    throw new Error("菜品格式无效");
  }

  if (value.price.status === "confirmed") {
    assertMoney(value.price.money, "菜品价格");
  }

  return value as EditableMenuItem;
}

export function assertMembers(value: unknown): MemberView[] {
  if (!Array.isArray(value)) {
    throw new Error("成员需求格式无效");
  }

  return value.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string" || !Array.isArray(item.constraints)) {
      throw new Error("成员格式无效");
    }
    return item as MemberView;
  });
}

export function assertPricingDraft(value: unknown): PricingDraft {
  if (!isRecord(value) || !Array.isArray(value.promotions) || !Array.isArray(value.takeoutAllocations)) {
    throw new Error("预算草稿格式无效");
  }
  assertMoney(value.budget, "预算");

  if ((value.budget as { minorValue: number }).minorValue <= 0) {
    throw new Error("总预算必须大于 0");
  }

  for (const promotion of value.promotions) {
    if (!isRecord(promotion) || typeof promotion.type !== "string" || typeof promotion.enabled !== "boolean") {
      throw new Error("优惠格式无效");
    }
    if (promotion.type === "threshold_discount") {
      const threshold = assertMoney(promotion.threshold, "满减门槛");
      const discount = assertMoney(promotion.discount, "满减金额");
      if (threshold.minorValue <= discount.minorValue) {
        throw new Error("满减门槛必须大于优惠金额");
      }
    }
  }

  return value as PricingDraft;
}

export function assertRecommendation(value: unknown): RecommendationPlanView {
  if (
    !isRecord(value)
    || !Array.isArray(value.planItems)
    || !Array.isArray(value.memberCoverage)
    || !Array.isArray(value.alternatives)
    || !isRecord(value.pricing)
  ) {
    throw new Error("推荐结果格式无效");
  }

  assertMoney(value.pricing.subtotal, "菜品小计");
  assertMoney(value.pricing.total, "推荐总价");
  assertMoney(value.pricing.budgetRemaining, "预算余额");
  return value as RecommendationPlanView;
}
