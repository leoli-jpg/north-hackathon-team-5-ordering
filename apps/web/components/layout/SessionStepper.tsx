import Link from "next/link";

type SessionStep = {
  href: string;
  label: string;
  shortLabel: string;
  completed?: boolean;
  disabled?: boolean;
};

type SessionStepperProps = {
  currentPath: string;
  steps: SessionStep[];
};

export default function SessionStepper({ currentPath, steps }: SessionStepperProps) {
  return (
    <ol className="session-stepper" aria-label="当前聚餐流程">
      {steps.map((step, index) => {
        const isActive = currentPath === step.href || currentPath.startsWith(`${step.href}/`);
        const content = (
          <>
            <span className="step-number" aria-hidden="true">{step.completed ? "✓" : index + 1}</span>
            <span className="step-label">{step.label}</span>
            <span className="step-short-label">{step.shortLabel}</span>
          </>
        );
        return (
          <li
            key={step.href}
            className={[
              isActive ? "is-active" : "",
              step.completed ? "is-complete" : "",
              step.disabled ? "is-disabled" : ""
            ].filter(Boolean).join(" ")}
          >
            {step.disabled ? (
              <span className="step-link" aria-disabled="true">{content}</span>
            ) : (
              <Link href={step.href} aria-current={isActive ? "step" : undefined}>{content}</Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
