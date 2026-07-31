"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <section className="error-state">
      <p className="eyebrow">会话页面遇到问题</p>
      <h1>当前步骤暂时无法加载</h1>
      <p>请检查路由参数或稍后重试。{error.message}</p>
      <div className="inline-actions">
        <button type="button" onClick={() => reset()}>重试</button>
        <Link href="/session/new">创建新聚餐</Link>
      </div>
    </section>
  );
}
