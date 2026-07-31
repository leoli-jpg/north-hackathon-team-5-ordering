/**
 * RFC-0003 Mock fixtures.
 *
 * 这些数据覆盖 happy path、低置信菜单、价格缺失、严重过敏、优惠组合、
 * 共享菜、打包成员、备选方案和冲突结果。页面不直接导入 fixture。
 */
import type {
  DiningSessionView,
  EditableMenuItem,
  MemberView,
  MenuImageView,
  MenuSnapshotView,
  PricingDraft,
  RecommendationPlanView
} from "@/domain/types";
import { moneyFromMajor, zeroMoney } from "@/lib/money/money";

export const mockSession: DiningSessionView = {
  id: "demo",
  title: "周五晚餐",
  mealType: "dinner",
  currency: "CNY",
  peopleCount: 4,
  takeoutPeopleCount: 1,
  currentStep: "menu",
  phase: "menu_uploading",
  revision: 1
};

export const mockMenuImages: MenuImageView[] = [
  {
    id: "menu-image-1",
    pageIndex: 1,
    previewUrl: "/demo/menu-page-1.svg",
    fileName: "晚餐菜单-第1页.jpg",
    rotation: 0,
    quality: "good",
    qualityIssues: [],
    status: "processed"
  },
  {
    id: "menu-image-2",
    pageIndex: 2,
    previewUrl: "/demo/menu-page-2.svg",
    fileName: "晚餐菜单-第2页.jpg",
    rotation: 0,
    quality: "low",
    qualityIssues: ["右上角轻微反光，价格字段需确认"],
    status: "processed"
  }
];

export const mockMenuItems: EditableMenuItem[] = [
  {
    id: "item-1",
    name: "招牌番茄牛腩饭",
    description: "慢炖牛腩、番茄与米饭，适合共享。",
    category: "主食",
    price: { status: "confirmed", money: moneyFromMajor(48), source: "mock" },
    ingredientTags: ["牛肉", "番茄", "米饭"],
    allergenCandidates: [],
    spiceLevel: 0,
    servings: { min: 1, max: 2 },
    confidence: 0.94,
    accepted: true,
    availability: "available",
    recommendationEligible: true
  },
  {
    id: "item-2",
    name: "香辣鸡丁拌面",
    description: "低置信识别字段，用于展示人工校正入口。",
    category: "主食",
    price: { status: "missing", source: "mock" },
    ingredientTags: ["鸡肉", "面条", "辣椒"],
    allergenCandidates: ["花生"],
    spiceLevel: 2,
    servings: { min: 1, max: 1 },
    confidence: 0.62,
    accepted: false,
    availability: "available",
    recommendationEligible: true
  },
  {
    id: "item-3",
    name: "清爽时蔬沙拉",
    description: "生菜、番茄、黄瓜与独立酱汁。",
    category: "凉菜",
    price: { status: "confirmed", money: moneyFromMajor(32), source: "mock" },
    ingredientTags: ["生菜", "番茄", "黄瓜"],
    allergenCandidates: ["乳制品"],
    spiceLevel: 0,
    servings: { min: 2, max: 3 },
    confidence: 0.88,
    accepted: true,
    availability: "available",
    recommendationEligible: true
  },
  {
    id: "item-4",
    name: "菌菇烧豆腐",
    description: "口味温和的共享热菜。",
    category: "热菜",
    price: { status: "confirmed", money: moneyFromMajor(42), source: "mock" },
    ingredientTags: ["豆腐", "香菇", "青菜"],
    allergenCandidates: ["大豆"],
    spiceLevel: 0,
    servings: { min: 2, max: 3 },
    confidence: 0.91,
    accepted: true,
    availability: "available",
    recommendationEligible: true
  },
  {
    id: "item-5",
    name: "鲜虾蒸饺",
    description: "一份 8 只，适合多人分享。",
    category: "点心",
    price: { status: "confirmed", money: moneyFromMajor(36), source: "mock" },
    ingredientTags: ["虾", "面粉"],
    allergenCandidates: ["甲壳类", "麸质"],
    spiceLevel: 0,
    servings: { min: 2, max: 4 },
    confidence: 0.86,
    accepted: true,
    availability: "available",
    recommendationEligible: true
  }
];

export function collectMenuIssues(items: EditableMenuItem[]): string[] {
  const issues: string[] = [];
  const missing = items.filter((item) => item.recommendationEligible && item.price.status !== "confirmed");
  const unreviewed = items.filter((item) => item.recommendationEligible && (!item.accepted || item.confidence < 0.75 && !item.accepted));

  if (missing.length > 0) {
    issues.push(`${missing.length} 个入选菜品价格尚未确认`);
  }
  if (unreviewed.length > 0) {
    issues.push(`${unreviewed.length} 个低置信菜品等待人工确认`);
  }
  if (items.some((item) => item.allergenCandidates.length > 0)) {
    issues.push("过敏原候选仅供提示，点餐前仍需向餐厅确认");
  }
  return issues;
}

export const mockMenuSnapshot: MenuSnapshotView = {
  id: "menu-snapshot-1",
  revision: 1,
  images: mockMenuImages,
  items: mockMenuItems,
  issueSummary: collectMenuIssues(mockMenuItems),
  extractionJob: {
    id: "extract-1",
    status: "completed",
    progress: 100,
    stage: "completed",
    title: "菜单识别完成",
    message: "已识别 5 个菜品，1 项需要人工确认。",
    retryable: false
  }
};

const memberNames = ["小林", "阿晨", "小雨", "周叔", "安安", "陈老师"];
const memberRequirements = [
  "想吃主食，不要太辣。",
  "花生严重过敏，请完全避开花生和交叉接触。",
  "偏好蔬菜和清淡口味。",
  "想吃点心，份量不用太大。"
];

export function createMockMembers(count: number, hasTakeoutMember = true): MemberView[] {
  return Array.from({ length: count }, (_, index) => {
    const isAllergyMember = index === 1;
    const isTakeout = hasTakeoutMember && index === count - 1;
    return {
      id: `member-${index + 1}`,
      name: memberNames[index] ?? `成员 ${index + 1}`,
      presence: isTakeout ? "takeout" : "onsite",
      requirementText: memberRequirements[index] ?? "无特殊要求。",
      constraints: isAllergyMember
        ? [{
            id: "constraint-peanut",
            label: "严重过敏：花生",
            type: "allergy",
            severity: "critical",
            confirmed: true,
            source: "mock-agent",
            evidence: "花生严重过敏"
          }]
        : index === 0
          ? [{
              id: "constraint-mild",
              label: "偏好不辣",
              type: "preference",
              severity: "soft",
              confirmed: true,
              source: "mock-agent",
              evidence: "不要太辣"
            }]
          : [],
      clarificationQuestions: [],
      parseStatus: "parsed",
      noRequirements: index > 3
    };
  });
}

export const mockMembers = createMockMembers(4, true);

export const mockPricingDraft: PricingDraft = {
  budget: moneyFromMajor(220),
  includesTax: true,
  includesServiceFee: false,
  promotions: [
    {
      id: "promotion-threshold",
      type: "threshold_discount",
      name: "满 180 减 20",
      threshold: moneyFromMajor(180),
      discount: moneyFromMajor(20),
      stackable: true,
      enabled: true
    },
    {
      id: "promotion-coupon",
      type: "fixed_coupon",
      name: "新客券",
      amount: moneyFromMajor(5),
      minimumSpend: moneyFromMajor(100),
      stackable: true,
      enabled: true
    }
  ],
  takeoutAllocations: [{
    memberId: "member-4",
    mode: "soft_limit",
    amount: moneyFromMajor(45)
  }],
  assumptions: ["优惠可叠加", "税费已包含", "过敏信息下单前向餐厅二次确认"]
};

export const mockRecommendation: RecommendationPlanView = {
  id: "plan-1",
  version: 1,
  title: "均衡共享方案",
  status: "success",
  planItems: [
    {
      menuItemId: "item-1",
      name: "招牌番茄牛腩饭",
      quantity: 2,
      unitPrice: moneyFromMajor(48),
      subtotal: moneyFromMajor(96),
      assignedMemberIds: ["member-1", "member-2", "member-4"],
      fulfillment: "shared",
      reasons: ["覆盖主食需求", "不含花生候选", "可拆分一份打包"]
    },
    {
      menuItemId: "item-3",
      name: "清爽时蔬沙拉",
      quantity: 1,
      unitPrice: moneyFromMajor(32),
      subtotal: moneyFromMajor(32),
      assignedMemberIds: ["member-2", "member-3"],
      fulfillment: "shared",
      reasons: ["满足清淡与蔬菜偏好", "酱汁可分装"]
    },
    {
      menuItemId: "item-4",
      name: "菌菇烧豆腐",
      quantity: 1,
      unitPrice: moneyFromMajor(42),
      subtotal: moneyFromMajor(42),
      assignedMemberIds: ["member-1", "member-2", "member-3"],
      fulfillment: "shared",
      reasons: ["增加菜品多样性", "不使用花生配料"]
    },
    {
      menuItemId: "item-5",
      name: "鲜虾蒸饺",
      quantity: 1,
      unitPrice: moneyFromMajor(36),
      subtotal: moneyFromMajor(36),
      assignedMemberIds: ["member-1", "member-4"],
      fulfillment: "takeout",
      reasons: ["满足点心偏好", "便于打包"]
    }
  ],
  pricing: {
    subtotal: moneyFromMajor(206),
    packageAdjustment: zeroMoney(),
    thresholdDiscount: moneyFromMajor(20),
    couponDiscount: moneyFromMajor(5),
    serviceFee: zeroMoney(),
    tax: zeroMoney(),
    total: moneyFromMajor(181),
    budgetRemaining: moneyFromMajor(39)
  },
  memberCoverage: [
    { memberId: "member-1", memberName: "小林", satisfied: 2, total: 2, status: "satisfied", summary: "主食与不辣偏好均满足" },
    { memberId: "member-2", memberName: "阿晨", satisfied: 1, total: 1, status: "satisfied", summary: "避开花生候选，需向餐厅二次确认" },
    { memberId: "member-3", memberName: "小雨", satisfied: 2, total: 2, status: "satisfied", summary: "蔬菜与清淡口味均满足" },
    { memberId: "member-4", memberName: "周叔 · 打包", satisfied: 2, total: 2, status: "satisfied", summary: "点心与打包份量均满足" }
  ],
  unmetConstraints: [],
  reasons: ["避开花生过敏风险", "四人现场与一份打包均有明确分配", "叠加满减与新客券后低于预算"],
  alternatives: [
    {
      id: "alt-budget",
      title: "更省预算",
      total: moneyFromMajor(165),
      difference: "-¥16 · 减少 1 道点心",
      description: "保留硬约束，减少点心数量，人均成本更低。"
    },
    {
      id: "alt-variety",
      title: "更多样",
      total: moneyFromMajor(208),
      difference: "+¥27 · 替换 2 道菜",
      description: "加入低辣主食并增加共享菜，多样性更高。"
    },
    {
      id: "alt-takeout",
      title: "更照顾打包成员",
      total: moneyFromMajor(194),
      difference: "+¥13 · 打包独立成套",
      description: "打包成员获得独立主食和点心，现场共享菜不变。"
    }
  ],
  revisionSource: "menu-r1 · members-r1 · pricing-r1"
};

export const conflictRecommendation: RecommendationPlanView = {
  ...mockRecommendation,
  id: "plan-conflict-1",
  version: 1,
  title: "当前条件无可行方案",
  status: "conflict",
  planItems: [],
  pricing: {
    subtotal: moneyFromMajor(206),
    packageAdjustment: zeroMoney(),
    thresholdDiscount: zeroMoney(),
    couponDiscount: zeroMoney(),
    serviceFee: zeroMoney(),
    tax: zeroMoney(),
    total: moneyFromMajor(206),
    budgetRemaining: moneyFromMajor(-86)
  },
  memberCoverage: mockRecommendation.memberCoverage.map((coverage) => ({
    ...coverage,
    status: coverage.memberId === "member-2" ? "blocked" : "partial",
    summary: coverage.memberId === "member-2" ? "严重过敏约束尚未确认" : "预算不足，无法同时满足份量"
  })),
  unmetConstraints: ["预算不足以覆盖四人份量与一份打包", "严重过敏约束必须确认，不能自动放宽"],
  reasons: ["当前预算低于可行方案最低总价", "硬过敏约束不会作为一键放宽选项"],
  alternatives: []
};
