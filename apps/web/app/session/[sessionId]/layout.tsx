"use client";

import { useParams, usePathname } from "next/navigation";
import AppHeader from "@/components/layout/AppHeader";
import SessionStepper from "@/components/layout/SessionStepper";
import { useSessionDraft } from "@/state/use-session-draft";

const stepOrder = [
  { key: "new", label: "创建聚餐", shortLabel: "创建" },
  { key: "menu", label: "上传菜单", shortLabel: "上传" },
  { key: "review", label: "校正菜单", shortLabel: "校正" },
  { key: "members", label: "成员需求", shortLabel: "成员" },
  { key: "budget", label: "预算优惠", shortLabel: "预算" },
  { key: "result", label: "推荐结果", shortLabel: "结果" }
] as const;

function stepHref(sessionId: string, key: (typeof stepOrder)[number]["key"]) {
  if (key === "new") {
    return "/session/new";
  }
  if (key === "review") {
    return `/session/${sessionId}/menu/review`;
  }
  return `/session/${sessionId}/${key}`;
}

export default function SessionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const params = useParams<{ sessionId: string }>();
  const pathname = usePathname();
  const sessionId = params.sessionId ?? "demo";
  const draft = useSessionDraft(sessionId);
  const maxStepIndex = Math.max(1, stepOrder.findIndex((step) => step.key === draft.session.currentStep));
  const steps = stepOrder.map((step, index) => ({
    href: stepHref(sessionId, step.key),
    label: step.label,
    shortLabel: step.shortLabel,
    completed: index < maxStepIndex,
    disabled: index > maxStepIndex
  }));
  const currentIndex = Math.max(1, steps.findIndex((step) => pathname === step.href));

  return (
    <div className="app-shell">
      <AppHeader title={draft.session.title} />
      <div className="mobile-progress" aria-label={`当前第 ${currentIndex + 1} 步，共 6 步`}>
        <strong>{currentIndex + 1} / 6</strong>
        <span><i style={{ width: `${((currentIndex + 1) / 6) * 100}%` }} /></span>
      </div>
      <div className="session-layout">
        <aside className="session-sidebar" aria-label="当前聚餐流程">
          <SessionStepper currentPath={pathname} steps={steps} />
        </aside>
        <main className="session-content">
          <div className="page-frame">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
