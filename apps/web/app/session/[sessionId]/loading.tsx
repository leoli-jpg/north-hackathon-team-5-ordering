import Link from "next/link";

export default function Loading() {
  return (
    <div className="loading-panel" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <p>正在恢复会话草稿…</p>
      <Link href="/session/new">返回首页</Link>
    </div>
  );
}
