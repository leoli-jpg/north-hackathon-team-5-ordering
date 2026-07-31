/**
 * RFC-0003: stable frontend view models for the ordering demo.
 *
 * 页面、交互控制器和 Adapter 只共享这里的类型。金额统一使用最小货币单位，
 * Mock 返回也必须先通过 Schema guard，避免页面绑定外部字段。
 */
export type Money = {
  minorValue: number;
  currency: string;
};

export type PriceField =
  | { status: "confirmed"; money: Money; source: "mock" | "manual" }
  | { status: "missing"; source: "mock" | "manual" }
  | { status: "estimated"; suggestedMoney: Money; note: string; source: "mock" | "manual" };

export type AsyncJobStatus = "idle" | "running" | "completed" | "failed";

export type AsyncJobView = {
  id: string;
  status: AsyncJobStatus;
  progress: number;
  stage: "queued" | "reading_images" | "detecting_items" | "validating_prices" | "completed" | "failed";
  title: string;
  message?: string;
  retryable: boolean;
};

export type FrontendErrorCode =
  | "integration_not_configured"
  | "schema_validation_failed"
  | "network_failure"
  | "budget_conflict"
  | "hard_constraint_conflict"
  | "no_feasible_plan"
  | "revision_conflict"
  | "unknown";

export type FrontendError = {
  code: FrontendErrorCode;
  title: string;
  message: string;
  retryable: boolean;
  fieldErrors?: Record<string, string>;
  traceId?: string;
};

export type SessionStep = "new" | "menu" | "review" | "members" | "budget" | "result" | "share";

export type DiningSessionView = {
  id: string;
  title: string;
  mealType: "breakfast" | "lunch" | "dinner" | "other";
  currency: string;
  peopleCount: number;
  takeoutPeopleCount: number;
  currentStep: SessionStep;
  phase:
    | "draft"
    | "menu_uploading"
    | "menu_extracting"
    | "menu_needs_review"
    | "menu_confirmed"
    | "requirements_editing"
    | "ready_to_generate"
    | "generating"
    | "result_ready"
    | "conflict"
    | "failed";
  revision: number;
};

export type MenuImageView = {
  id: string;
  pageIndex: number;
  previewUrl: string;
  fileName?: string;
  rotation: 0 | 90 | 180 | 270;
  quality: "good" | "low" | "failed";
  qualityIssues: string[];
  status: "pending" | "uploaded" | "processing" | "processed" | "failed";
};

export type EditableMenuItem = {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: PriceField;
  ingredientTags: string[];
  allergenCandidates: string[];
  spiceLevel: 0 | 1 | 2 | 3 | 4 | 5;
  servings: {
    min: number;
    max: number;
  };
  confidence: number;
  accepted: boolean;
  availability: "available" | "sold_out" | "unknown";
  recommendationEligible: boolean;
};

export type MenuSnapshotView = {
  id: string;
  revision: number;
  images: MenuImageView[];
  items: EditableMenuItem[];
  issueSummary: string[];
  extractionJob: AsyncJobView;
};

export type MemberConstraint = {
  id: string;
  label: string;
  type: "allergy" | "diet" | "preference" | "budget" | "other";
  severity: "soft" | "hard" | "critical";
  confirmed: boolean;
  source: "mock-agent" | "manual";
  evidence?: string;
};

export type MemberView = {
  id: string;
  name: string;
  presence: "onsite" | "takeout";
  requirementText: string;
  constraints: MemberConstraint[];
  clarificationQuestions: string[];
  parseStatus: "idle" | "running" | "parsed" | "needs_review" | "failed";
  noRequirements: boolean;
};

export type PromotionDraft =
  | {
      id: string;
      type: "threshold_discount";
      name: string;
      threshold: Money;
      discount: Money;
      stackable: boolean | "unknown";
      enabled: boolean;
    }
  | {
      id: string;
      type: "fixed_coupon";
      name: string;
      amount: Money;
      minimumSpend: Money;
      stackable: boolean | "unknown";
      enabled: boolean;
    };

export type PricingDraft = {
  budget: Money;
  includesTax: boolean | "unknown";
  includesServiceFee: boolean | "unknown";
  promotions: PromotionDraft[];
  takeoutAllocations: Array<{
    memberId: string;
    mode: "shared_budget" | "soft_limit" | "fixed";
    amount?: Money;
  }>;
  assumptions: string[];
};

export type RecommendationPlanItem = {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: Money;
  subtotal: Money;
  assignedMemberIds: string[];
  fulfillment: "shared" | "individual" | "takeout";
  reasons: string[];
};

export type MemberCoverageView = {
  memberId: string;
  memberName: string;
  satisfied: number;
  total: number;
  status: "satisfied" | "partial" | "blocked";
  summary: string;
};

export type AlternativePlanSummary = {
  id: string;
  title: string;
  total: Money;
  difference: string;
  description: string;
};

export type RecommendationPlanView = {
  id: string;
  version: number;
  title: string;
  status: "idle" | "running" | "success" | "conflict" | "failed";
  planItems: RecommendationPlanItem[];
  pricing: {
    subtotal: Money;
    packageAdjustment: Money;
    thresholdDiscount: Money;
    couponDiscount: Money;
    serviceFee: Money;
    tax: Money;
    total: Money;
    budgetRemaining: Money;
  };
  memberCoverage: MemberCoverageView[];
  unmetConstraints: string[];
  reasons: string[];
  alternatives: AlternativePlanSummary[];
  revisionSource: string;
};

export type ParsedRequirementView = {
  memberId: string;
  constraints: MemberConstraint[];
  clarificationQuestions: string[];
  confidence: number;
};
