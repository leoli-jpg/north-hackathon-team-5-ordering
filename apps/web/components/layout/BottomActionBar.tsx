import Link from "next/link";

type BottomActionBarProps = {
  backHref: string;
  nextHref: string;
  nextLabel?: string;
};

export default function BottomActionBar({ backHref, nextHref, nextLabel = "保存并继续" }: BottomActionBarProps) {
  return (
    <footer className="bottom-action-bar" aria-label="页面底部操作">
      <Link className="button button-secondary" href={backHref}>返回</Link>
      <Link className="button button-primary" href={nextHref}>{nextLabel}</Link>
    </footer>
  );
}
