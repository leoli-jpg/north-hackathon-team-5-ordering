/**
 * RFC-0003 session-scoped draft store.
 *
 * 运行时只保存前端 Mock View Model。浏览器刷新时从 sessionStorage 恢复，
 * 不写入 URL，不保存图片二进制，也不接触任何外部服务。
 */
import type {
  DiningSessionView,
  MemberView,
  MenuSnapshotView,
  PricingDraft,
  RecommendationPlanView
} from "@/domain/types";
import {
  createMockMembers,
  mockMenuSnapshot,
  mockPricingDraft,
  mockSession
} from "@/mocks/fixtures";
import { moneyFromMajor } from "@/lib/money/money";

export type DraftState = {
  session: DiningSessionView;
  menuSnapshot: MenuSnapshotView;
  members: MemberView[];
  pricingDraft: PricingDraft;
  recommendation: RecommendationPlanView | null;
};

const drafts = new Map<string, DraftState>();
const listeners = new Map<string, Set<() => void>>();
const storagePrefix = "ordering-guide-demo:";

function storageKey(sessionId: string) {
  return `${storagePrefix}${sessionId}`;
}

function createDraft(sessionId: string): DraftState {
  const isConflictDemo = sessionId.includes("conflict");
  const pricingDraft = structuredClone(mockPricingDraft);
  const menuSnapshot = structuredClone(mockMenuSnapshot);
  menuSnapshot.extractionJob = {
    ...menuSnapshot.extractionJob,
    status: "idle",
    progress: 0,
    stage: "queued",
    title: "等待识别",
    message: "已载入两页演示菜单，可开始 Mock 识别。"
  };
  if (isConflictDemo) {
    pricingDraft.budget = moneyFromMajor(120);
  }

  return {
    session: {
      ...structuredClone(mockSession),
      id: sessionId,
      title: isConflictDemo ? "预算冲突演示" : mockSession.title
    },
    menuSnapshot,
    members: createMockMembers(4, true),
    pricingDraft,
    recommendation: null
  };
}

export function getDefaultDraft(sessionId: string): DraftState {
  return createDraft(sessionId);
}

function readStoredDraft(sessionId: string): DraftState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey(sessionId));
    return raw ? JSON.parse(raw) as DraftState : null;
  } catch {
    return null;
  }
}

function persistDraft(sessionId: string, draft: DraftState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey(sessionId), JSON.stringify(draft));
  } catch {
    // sessionStorage 不可用时仍保留当前标签页内的内存流程。
  }
}

function emit(sessionId: string) {
  listeners.get(sessionId)?.forEach((listener) => listener());
}

export function getDraft(sessionId: string): DraftState {
  const existing = drafts.get(sessionId);
  if (existing) {
    return existing;
  }

  const draft = readStoredDraft(sessionId) ?? createDraft(sessionId);
  drafts.set(sessionId, draft);
  return draft;
}

export function saveDraft(sessionId: string, patch: Partial<DraftState>): DraftState {
  const draft = getDraft(sessionId);
  const next = { ...draft, ...structuredClone(patch) };
  drafts.set(sessionId, next);
  persistDraft(sessionId, next);
  emit(sessionId);
  return next;
}

export function subscribeDraft(sessionId: string, listener: () => void) {
  const sessionListeners = listeners.get(sessionId) ?? new Set<() => void>();
  sessionListeners.add(listener);
  listeners.set(sessionId, sessionListeners);

  return () => {
    sessionListeners.delete(listener);
  };
}

export function clearDraft(sessionId: string) {
  drafts.delete(sessionId);
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(storageKey(sessionId));
  }
  emit(sessionId);
}
