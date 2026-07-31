"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import type { PricingDraft, PromotionDraft } from "@/domain/types";
import { getFrontendPorts } from "@/domain/ports";
import { formatMoney, moneyFromMajor, moneyToMajor } from "@/lib/money/money";
import { useSessionDraft } from "@/state/use-session-draft";

export default function BudgetPage({ params }: Readonly<{ params: { sessionId: string } }>) {
  const router = useRouter();
  const draft = useSessionDraft(params.sessionId);
  const [pricingDraft, setPricingDraft] = useState<PricingDraft>(draft.pricingDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPricingDraft(draft.pricingDraft);
  }, [draft.pricingDraft]);

  const takeoutMembers = draft.members.filter((member) => member.presence === "takeout");
  const budgetPerPerson = pricingDraft.budget.minorValue / Math.max(1, draft.members.length);
  const activePromotions = pricingDraft.promotions.filter((promotion) => promotion.enabled);
  const estimatedSubtotal = 20_600;
  const estimatedDiscount = activePromotions.reduce((total, promotion) => {
    if (promotion.type === "threshold_discount" && estimatedSubtotal >= promotion.threshold.minorValue) {
      return total + promotion.discount.minorValue;
    }
    if (promotion.type === "fixed_coupon" && estimatedSubtotal >= promotion.minimumSpend.minorValue) {
      return total + promotion.amount.minorValue;
    }
    return total;
  }, 0);
  const estimatedTotal = useMemo(
    () => moneyFromMajor((estimatedSubtotal - estimatedDiscount) / 100, pricingDraft.budget.currency),
    [estimatedDiscount, pricingDraft.budget.currency]
  );

  function updatePromotion(id: string, patch: Partial<PromotionDraft>) {
    setPricingDraft((current) => ({
      ...current,
      promotions: current.promotions.map((promotion) =>
        promotion.id === id ? { ...promotion, ...patch } as PromotionDraft : promotion
      )
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      await getFrontendPorts().recommendation.savePricingDraft(params.sessionId, pricingDraft);
      router.push(`/session/${params.sessionId}/result`);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "预算保存失败，请检查输入");
      setIsSaving(false);
    }
  }

  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow="步骤 5 / 6"
        title="预算与优惠"
        description="金额内部统一使用分，页面只展示本地化数值。这里的即时价格只是 Mock 预览，最终明细由 RecommendationGateway 返回。"
      />
      <div className="budget-grid">
        <div className="budget-form-stack">
          <article className="section-card">
            <div className="card-heading-row">
              <div>
                <p className="eyebrow">01 · 总预算</p>
                <h2>这顿饭最多花多少？</h2>
              </div>
              <span className="chip">{draft.members.length} 人</span>
            </div>
            <label className="money-input">
              <span>总预算（元）</span>
              <div><b>¥</b><input
                type="number"
                min="1"
                step="1"
                aria-label="总预算（元）"
                value={moneyToMajor(pricingDraft.budget)}
                onChange={(event) => setPricingDraft({
                  ...pricingDraft,
                  budget: moneyFromMajor(Number(event.target.value || 0), pricingDraft.budget.currency)
                })}
              /></div>
            </label>
            <p className="form-note">当前人均预算约 ¥{Math.round(budgetPerPerson / 100)}。</p>
            <div className="toggle-grid">
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={pricingDraft.includesTax === true}
                  onChange={(event) => setPricingDraft({ ...pricingDraft, includesTax: event.target.checked })}
                />
                <span><strong>预算包含税费</strong><small>Mock 结果按已包含展示</small></span>
              </label>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={pricingDraft.includesServiceFee === true}
                  onChange={(event) => setPricingDraft({ ...pricingDraft, includesServiceFee: event.target.checked })}
                />
                <span><strong>包含服务费</strong><small>关闭时结果明细为 ¥0</small></span>
              </label>
            </div>
          </article>

          <article className="section-card">
            <div className="card-heading-row">
              <div>
                <p className="eyebrow">02 · 优惠</p>
                <h2>可使用的优惠</h2>
              </div>
              <span className="chip chip-success">{activePromotions.length} 个启用</span>
            </div>
            <div className="promotion-list">
              {pricingDraft.promotions.map((promotion) => (
                <div className={`promotion-card ${promotion.enabled ? "is-enabled" : ""}`} key={promotion.id}>
                  <label className="promotion-toggle">
                    <input
                      type="checkbox"
                      checked={promotion.enabled}
                      onChange={(event) => updatePromotion(promotion.id, { enabled: event.target.checked })}
                    />
                    <span>
                      <strong>{promotion.name}</strong>
                      <small>{promotion.stackable === true ? "可叠加" : "叠加规则未知"}</small>
                    </span>
                  </label>
                  {promotion.type === "threshold_discount" ? (
                    <div className="compact-money-row">
                      <label>满 <input
                        aria-label={`${promotion.name}门槛`}
                        type="number"
                        value={moneyToMajor(promotion.threshold)}
                        onChange={(event) => updatePromotion(promotion.id, { threshold: moneyFromMajor(Number(event.target.value || 0)) })}
                      /></label>
                      <label>减 <input
                        aria-label={`${promotion.name}优惠金额`}
                        type="number"
                        value={moneyToMajor(promotion.discount)}
                        onChange={(event) => updatePromotion(promotion.id, { discount: moneyFromMajor(Number(event.target.value || 0)) })}
                      /></label>
                    </div>
                  ) : (
                    <div className="compact-money-row">
                      <label>券额 <input
                        aria-label={`${promotion.name}券额`}
                        type="number"
                        value={moneyToMajor(promotion.amount)}
                        onChange={(event) => updatePromotion(promotion.id, { amount: moneyFromMajor(Number(event.target.value || 0)) })}
                      /></label>
                      <label>最低消费 <input
                        aria-label={`${promotion.name}最低消费`}
                        type="number"
                        value={moneyToMajor(promotion.minimumSpend)}
                        onChange={(event) => updatePromotion(promotion.id, { minimumSpend: moneyFromMajor(Number(event.target.value || 0)) })}
                      /></label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>

          <article className="section-card">
            <p className="eyebrow">03 · 打包与假设</p>
            <h2>打包预算怎么分？</h2>
            {takeoutMembers.length > 0 ? takeoutMembers.map((member) => {
              const allocation = pricingDraft.takeoutAllocations.find((item) => item.memberId === member.id);
              return (
                <div className="takeout-row" key={member.id}>
                  <div><span className="avatar" aria-hidden="true">{member.name.slice(0, 1)}</span><strong>{member.name}</strong></div>
                  <select
                    aria-label={`${member.name}打包预算方式`}
                    value={allocation?.mode ?? "shared_budget"}
                    onChange={(event) => {
                      const mode = event.target.value as "shared_budget" | "soft_limit" | "fixed";
                      setPricingDraft((current) => ({
                        ...current,
                        takeoutAllocations: [
                          ...current.takeoutAllocations.filter((item) => item.memberId !== member.id),
                          { memberId: member.id, mode, amount: allocation?.amount ?? moneyFromMajor(45) }
                        ]
                      }));
                    }}
                  >
                    <option value="shared_budget">计入统一预算</option>
                    <option value="soft_limit">软上限 ¥45</option>
                    <option value="fixed">固定 ¥45</option>
                  </select>
                </div>
              );
            }) : <p className="empty-inline">当前没有打包成员，可返回成员页修改。</p>}
            <label>
              价格假设
              <textarea
                rows={3}
                value={pricingDraft.assumptions.join("\n")}
                onChange={(event) => setPricingDraft({
                  ...pricingDraft,
                  assumptions: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean)
                })}
              />
            </label>
          </article>
        </div>

        <aside className="section-card budget-summary-card">
          <p className="eyebrow">Mock 即时预览</p>
          <h2>预算摘要</h2>
          <div className="budget-hero-number">
            <span>当前预算</span>
            <strong>{formatMoney(pricingDraft.budget)}</strong>
            <small>人均约 ¥{Math.round(budgetPerPerson / 100)}</small>
          </div>
          <dl className="price-breakdown">
            <div><dt>演示菜品小计</dt><dd>¥206</dd></div>
            <div><dt>预计优惠</dt><dd className="discount">-¥{estimatedDiscount / 100}</dd></div>
            <div className="total-row"><dt>预计总价</dt><dd>{formatMoney(estimatedTotal)}</dd></div>
          </dl>
          <div className={pricingDraft.budget.minorValue >= estimatedTotal.minorValue ? "budget-ok" : "budget-warning"}>
            {pricingDraft.budget.minorValue >= estimatedTotal.minorValue
              ? `✓ 预计结余 ¥${(pricingDraft.budget.minorValue - estimatedTotal.minorValue) / 100}`
              : `! 预计还差 ¥${(estimatedTotal.minorValue - pricingDraft.budget.minorValue) / 100}`}
          </div>
          <p className="risk-note">预览不作为最终价格；生成后会检查明细与总价是否一致。</p>
        </aside>
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="inline-actions step-actions">
        <Link className="button button-secondary" href={`/session/${params.sessionId}/members`}>← 返回成员需求</Link>
        <button className="button button-primary" type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "正在保存预算…" : "保存并生成推荐 →"}
        </button>
      </div>
    </section>
  );
}
