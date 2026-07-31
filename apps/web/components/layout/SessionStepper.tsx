import Link from "next/link";

type SessionStep = {
  href: string;
  label: string;
  shortLabel: string;
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
        return (
          <li key={step.href} className={isActive ? "is-active" : undefined}>
            <Link href={step.href} aria-current={isActive ? "step" : undefined}>
              <span className="step-number">{index + 1}</span>
              <span className="step-label">{step.label}</span>
              <span className="step-short-label">{step.shortLabel}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
