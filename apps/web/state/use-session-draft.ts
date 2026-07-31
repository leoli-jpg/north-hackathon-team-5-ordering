"use client";

import { useEffect, useState } from "react";
import {
  getDefaultDraft,
  getDraft,
  subscribeDraft,
  type DraftState
} from "@/state/session-draft-store";

export function useSessionDraft(sessionId: string): DraftState {
  const [draft, setDraft] = useState(() => getDefaultDraft(sessionId));

  useEffect(() => {
    const sync = () => setDraft(structuredClone(getDraft(sessionId)));
    sync();
    return subscribeDraft(sessionId, sync);
  }, [sessionId]);

  return draft;
}
