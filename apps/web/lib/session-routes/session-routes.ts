export type SessionStep =
  | "setup"
  | "menu-upload"
  | "menu-review"
  | "members"
  | "budget"
  | "result";

export type SessionPhase =
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

export const sessionStepOrder: SessionStep[] = [
  "setup",
  "menu-upload",
  "menu-review",
  "members",
  "budget",
  "result"
];

export function sessionStepFromPath(pathname: string): SessionStep | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const sessionIndex = parts.indexOf("session");

  if (sessionIndex === -1) {
    return undefined;
  }

  const afterSession = parts[sessionIndex + 1];
  if (afterSession === "new") {
    return "setup";
  }

  const afterSessionId = parts[sessionIndex + 2];
  if (afterSessionId === "menu" && parts[sessionIndex + 3] === "review") {
    return "menu-review";
  }

  const knownSessionSteps: SessionStep[] = ["menu-upload", "menu-review", "members", "budget", "result"];
  return knownSessionSteps.find((step) => step === afterSessionId);
}
