"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AppHeader from "@/components/layout/AppHeader";
import PageHeader from "@/components/layout/PageHeader";
import type { DiningSessionView } from "@/domain/types";
import { getFrontendPorts } from "@/domain/ports";

function mealTypeFromForm(value: string): DiningSessionView["mealType"] {
  if (value === "breakfast" || value === "lunch" || value === "other") {
    return value;
  }
  return "dinner";
}

export default function NewSessionPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim() || "周五晚餐";
    const peopleCount = Math.max(1, Math.min(12, Number(form.get("peopleCount") || 4)));
    const mealType = mealTypeFromForm(String(form.get("mealType") || "dinner"));
    const currency = String(form.get("currency") || "CNY");
    const hasTakeoutMember = form.get("hasTakeoutMember") === "on";

    try {
      const result = await getFrontendPorts().session.createDraft({
        title,
        peopleCount,
        mealType,
        currency,
        hasTakeoutMember
      });
      router.push(`/session/${result.data.id}/menu`);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "创建失败，请重试");
      setIsCreating(false);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader title="创建聚餐" />
      <main className="standalone-main">
        <section className="stacked-page narrow-page">
          <PageHeader
            eyebrow="步骤 1 / 6"
            title="创建一次聚餐"
            description="用少量信息建立前端会话草稿。成员、菜单和后续推荐全部由本地 Mock Gateway 提供。"
          />
          <form className="form-card setup-form" onSubmit={handleSubmit}>
            <label>
              聚餐名称
              <input name="title" defaultValue="周五晚餐" maxLength={40} placeholder="例如：周五晚餐" />
            </label>
            <div className="form-split">
              <label>
                总人数
                <input name="peopleCount" type="number" min="1" max="12" defaultValue="4" />
              </label>
              <label>
                币种
                <select name="currency" defaultValue="CNY">
                  <option value="CNY">人民币 CNY</option>
                  <option value="USD">美元 USD</option>
                </select>
              </label>
            </div>
            <fieldset>
              <legend>哪一餐？</legend>
              <div className="radio-card-grid">
                <label><input type="radio" name="mealType" value="breakfast" /><span>🌤️ 早餐</span></label>
                <label><input type="radio" name="mealType" value="lunch" /><span>☀️ 午餐</span></label>
                <label><input type="radio" name="mealType" value="dinner" defaultChecked /><span>🌙 晚餐</span></label>
                <label><input type="radio" name="mealType" value="other" /><span>✨ 其他</span></label>
              </div>
            </fieldset>
            <label className="switch-row">
              <input name="hasTakeoutMember" type="checkbox" defaultChecked />
              <span>
                <strong>包含打包成员</strong>
                <small>最后一名成员默认标为打包，可在成员页修改。</small>
              </span>
            </label>
            <div className="mock-callout">
              <span aria-hidden="true">✦</span>
              <p><strong>演示数据已准备</strong><br />创建后自动带入两页菜单、5 个菜品和成员需求，可完整跑通流程。</p>
            </div>
            {error && <p className="error-text" role="alert">{error}</p>}
            <div className="inline-actions step-actions">
              <Link className="button button-secondary" href="/">返回首页</Link>
              <button className="button button-primary" type="submit" disabled={isCreating}>
                {isCreating ? "正在创建 Mock 会话…" : "创建并上传菜单 →"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
