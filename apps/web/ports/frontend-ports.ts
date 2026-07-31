/**
 * RFC-0003: Frontend gateway interfaces.
 *
 * 页面和 Feature Hook 只依赖这些 Gateway，不直接调用 HTTP、数据库或 Agent SDK。
 */
import type {
  DiningSessionView,
  EditableMenuItem,
  MenuImageView,
  MenuSnapshotView,
  ParsedRequirementView,
  PricingDraft,
  RecommendationPlanView
} from "@/domain/types";

export interface SessionGateway {
  createDraft(input: CreateSessionInput): Promise<GatewayResult<DiningSessionView>>;
  restoreDraft(sessionId: string): Promise<GatewayResult<DiningSessionView>>;
  advanceStep(sessionId: string, step: DiningSessionView["currentStep"]): Promise<GatewayResult<DiningSessionView>>;
}

export interface MenuGateway {
  uploadImage(sessionId: string, image: Omit<MenuImageView, "id" | "status">): Promise<GatewayResult<MenuSnapshotView>>;
  startExtraction(sessionId: string): Promise<GatewayResult<MenuSnapshotView>>;
  saveItem(sessionId: string, itemId: string, patch: Partial<EditableMenuItem>): Promise<GatewayResult<MenuSnapshotView>>;
  confirmMenu(sessionId: string): Promise<GatewayResult<MenuSnapshotView>>;
  getMenuSnapshot(sessionId: string): Promise<GatewayResult<MenuSnapshotView>>;
}

export interface AgentRuntimeGateway {
  parseMemberRequirement(sessionId: string, memberId: string, text: string): Promise<GatewayResult<ParsedRequirementView>>;
}

export interface RecommendationGateway {
  savePricingDraft(sessionId: string, draft: PricingDraft): Promise<GatewayResult<PricingDraft>>;
  runRecommendation(sessionId: string): Promise<GatewayResult<RecommendationPlanView>>;
  getResult(sessionId: string): Promise<GatewayResult<RecommendationPlanView>>;
}

export type CreateSessionInput = {
  title: string;
  mealType: DiningSessionView["mealType"];
  currency: string;
  peopleCount: number;
  hasTakeoutMember: boolean;
};

export type GatewayResult<T> = {
  data: T;
};

export type FrontendPorts = {
  session: SessionGateway;
  menu: MenuGateway;
  agentRuntime: AgentRuntimeGateway;
  recommendation: RecommendationGateway;
};
