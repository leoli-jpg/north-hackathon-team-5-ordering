/**
 * RFC-0003: Ordering Demo frontend shell.
 *
 * 本文件是 RFC-0003 T1 的前端入口，负责引入全局样式和设计 token。
 */
import "@/styles/globals.css";
import "@/styles/tokens.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Ordering Guide Demo",
  description: "多人点餐推荐 Demo：上传菜单、收集需求、生成预算内方案。"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
