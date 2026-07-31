"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionDraft } from "@/state/use-session-draft";

export default function SessionRootPage({ params }: Readonly<{ params: { sessionId: string } }>) {
  const router = useRouter();
  const draft = useSessionDraft(params.sessionId);

  useEffect(() => {
    const step = draft.session.currentStep;
    const suffix = step === "review" ? "menu/review" : step === "new" ? "menu" : step;
    router.replace(`/session/${params.sessionId}/${suffix}`);
  }, [draft.session.currentStep, params.sessionId, router]);

  return (
    <div className="loading-panel" role="status">
      <div className="loading-spinner" />
      <p>正在恢复 Mock 会话与当前步骤…</p>
    </div>
  );
}
