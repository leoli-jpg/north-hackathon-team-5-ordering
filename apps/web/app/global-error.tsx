"use client";

export default function GlobalError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="error-state">
          <p className="eyebrow">全局错误</p>
          <h1>页面暂时无法加载</h1>
          <p>{error.message}</p>
          <button type="button" onClick={() => reset()}>重试</button>
        </main>
      </body>
    </html>
  );
}
