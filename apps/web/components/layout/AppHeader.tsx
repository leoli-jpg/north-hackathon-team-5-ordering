import Link from "next/link";

export default function AppHeader({ title }: Readonly<{ title: string }>) {
  return (
    <header className="app-header">
      <Link className="brand-link" href="/" aria-label="Ordering Guide Demo 首页">
        <span className="brand-mark" aria-hidden="true">OG</span>
        <span className="brand-text">Ordering Guide</span>
      </Link>
      <div className="session-title" aria-live="polite">{title}</div>
      <nav className="header-actions" aria-label="页面辅助操作">
        <Link href="/session/new">新建</Link>
        <span className="runtime-badge"><span aria-hidden="true">●</span> 纯 Mock</span>
      </nav>
    </header>
  );
}
