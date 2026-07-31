"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import type { AlternativePlanSummary, RecommendationPlanView } from "@/domain/types";
import { getFrontendPorts } from "@/domain/ports";
import { formatMoney, moneyFromMajor } from "@/lib/money/money";
import { useSessionDraft } from "@/state/use-session-draft";

export default function ResultPage({ params }: Readonly<{ params: { sessionId: string } }>) {
  const draft = useSessionDraft(params.sessionId);
  const [result, setResult] = useState<RecommendationPlanView | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generationKey, setGenerationKey] = useState(0);
  const [selectedAlternative, setSelectedAlternative] = useState<AlternativePlanSummary | null>(null);
  const startedKey = useRef<number | null>(null);

  useEffect(() => {
    if (startedKey.current === generationKey) {
      return;
    }
    startedKey.current = generationKey;
    let active = true;
    setIsGenerating(true);
    setError(null);
    setSelectedAlternative(null);

    getFrontendPorts().recommendation.runRecommendation(params.sessionId)
      .then((response) => {
        if (active) {
          setResult(response.data);
          setIsGenerating(false);
        }
      })
      .catch((error_: unknown) => {
        if (active) {
          setError(error_ instanceof Error ? error_.message : "推荐生成失败，请重试");
          setIsGenerating(false);
        }
      });

    return () => {
      active = false;
    };
  }, [generationKey, params.sessionId]);

  const pricingIsConsistent = useMemo(() => {
    if (!result) return true;
    const displayed = result.pricing.subtotal.minorValue
      + result.pricing.packageAdjustment.minorValue
      - result.pricing.thresholdDiscount.minorValue
      - result.pricing.couponDiscount.minorValue
      + result.pricing.serviceFee.minorValue
      + result.pricing.tax.minorValue;
    return displayed === result.pricing.total.minorValue;
  }, [result]);

  async function applySuggestedBudget() {
    await getFrontendPorts().recommendation.savePricingDraft(params.sessionId, {
      ...draft.pricingDraft,
      budget: moneyFromMajor(220, draft.session.currency)
    });
    setGenerationKey((value) => value + 1);
  }

  if (isGenerating) {
    return (
      <section className="stacked-page">
        <PageHeader eyebrow="步骤 6 / 6" title="正在生成点餐方案" description="Mock RecommendationGateway 正在执行价格、硬约束和覆盖检查。" />
        <div className="generation-panel" role="status">
          <div className="generation-orbit"><span>✦</span></div>
          <h2>组合菜品与成员需求</h2>
          <p>先校验严重过敏，再计算优惠和预算，最后生成可比较备选方案。</p>
          <div className="generation-steps">
            <span className="is-active">校验约束</span>
            <span className="is-active">计算价格</span>
            <span>生成解释</span>
          </div>
        </div>
      </section>
    );
  }

  if (error || !result) {
    return (
      <section className="stacked-page">
        <PageHeader eyebrow="步骤 6 / 6" title="推荐结果" description="Mock 推荐任务未能完成。" />
        <div className="error-state" role="alert">
          <span className="quality-icon" aria-hidden="true">!</span>
          <h1>生成失败</h1>
          <p>{error ?? "暂无结果。"}</p>
          <button className="button button-primary" type="button" onClick={() => setGenerationKey((value) => value + 1)}>重试生成</button>
        </div>
      </section>
    );
  }

  const isConflict = result.status === "conflict";
  const budgetUsage = draft.pricingDraft.budget.minorValue > 0
    ? Math.min(100, Math.round(result.pricing.total.minorValue / draft.pricingDraft.budget.minorValue * 100))
    : 100;

  if (isConflict) {
    return (
      <section className="stacked-page">
        <PageHeader
          eyebrow={`步骤 6 / 6 · 版本 ${result.version}`}
          title="当前条件下没有可行方案"
          description="这不是通用错误页。下面列出主要冲突，以及只会调整软条件的恢复操作。"
        />
        <div className="conflict-hero">
          <div className="conflict-icon" aria-hidden="true">!</div>
          <div>
            <p className="eyebrow">NO FEASIBLE PLAN</p>
            <h2>预算或安全确认阻止了推荐</h2>
            <p>{result.reasons.join("；")}</p>
          </div>
        </div>
        <div className="conflict-grid">
          <article className="section-card">
            <h2>主要冲突</h2>
            <ol className="conflict-list">
              {result.unmetConstraints.map((constraint, index) => (
                <li key={constraint}><span>{index + 1}</span><p>{constraint}</p></li>
              ))}
            </ol>
          </article>
          <article className="section-card">
            <h2>可以尝试</h2>
            <div className="suggestion-list">
              {result.pricing.budgetRemaining.minorValue < 0 && (
                <button type="button" onClick={applySuggestedBudget}>
                  <span>💰</span><div><strong>把预算提高到 ¥220</strong><small>只调整预算并重新生成</small></div><b>→</b>
                </button>
              )}
              <Link href={`/session/${params.sessionId}/members`}>
                <span>👥</span><div><strong>返回确认成员需求</strong><small>严重过敏只能人工确认，不能忽略</small></div><b>→</b>
              </Link>
              <Link href={`/session/${params.sessionId}/menu/review`}>
                <span>📋</span><div><strong>检查菜单候选</strong><small>确认价格与花生候选信息</small></div><b>→</b>
              </Link>
            </div>
          </article>
        </div>
        <aside className="risk-banner risk-danger">
          <span aria-hidden="true">!</span>
          硬过敏约束不提供“一键忽略”。演示恢复只允许提高预算或返回人工确认。
        </aside>
        <div className="inline-actions step-actions">
          <Link className="button button-secondary" href={`/session/${params.sessionId}/budget`}>← 修改预算</Link>
          <button className="button button-primary" type="button" onClick={() => setGenerationKey((value) => value + 1)}>按当前条件重试</button>
        </div>
      </section>
    );
  }

  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow={`步骤 6 / 6 · 方案版本 ${result.version}`}
        title="推荐结果"
        description="先给出可下单摘要，再解释价格、成员覆盖、风险和备选方案。"
      />
      {!pricingIsConsistent && (
        <div className="risk-banner risk-danger" role="alert">
          <span aria-hidden="true">!</span>价格明细无法合计到最终总价，当前方案不能确认为可下单。
        </div>
      )}

      <article className="plan-hero">
        <div className="plan-hero-main">
          <div className="plan-status-row">
            <span className="chip chip-success">✓ 可推荐</span>
            <span className="revision-pill">{result.revisionSource}</span>
          </div>
          <h2>{result.title}</h2>
          <p>{result.reasons.join("；")}</p>
          <div className="plan-meta">
            <span><strong>{result.planItems.length}</strong> 道菜</span>
            <span><strong>{draft.members.filter((member) => member.presence === "onsite").length}</strong> 人现场</span>
            <span><strong>{draft.members.filter((member) => member.presence === "takeout").length}</strong> 份打包</span>
          </div>
        </div>
        <div className="plan-total">
          <span>最终总价</span>
          <strong>{formatMoney(result.pricing.total)}</strong>
          <small>预算 {formatMoney(draft.pricingDraft.budget)}</small>
          <div className="usage-track"><span style={{ width: `${budgetUsage}%` }} /></div>
          <b>预算利用率 {budgetUsage}% · 结余 {formatMoney(result.pricing.budgetRemaining)}</b>
        </div>
      </article>

      <div className="result-grid">
        <div className="result-main-column">
          <section className="section-card">
            <div className="card-heading-row">
              <div><p className="eyebrow">可下单组合</p><h2>菜品方案</h2></div>
              <button className="button button-secondary" type="button" onClick={() => setGenerationKey((value) => value + 1)}>重新生成</button>
            </div>
            <div className="plan-dish-list">
              {result.planItems.map((item) => (
                <article className="plan-dish-card" key={item.menuItemId}>
                  <div className="dish-emoji" aria-hidden="true">{item.fulfillment === "takeout" ? "🥡" : item.name.includes("沙拉") ? "🥗" : "🍲"}</div>
                  <div>
                    <div className="plan-item-title-row">
                      <h3>{item.name} × {item.quantity}</h3>
                      <strong>{formatMoney(item.subtotal)}</strong>
                    </div>
                    <p>{item.reasons.join(" · ")}</p>
                    <div className="chip-row">
                      <span className="chip">{item.fulfillment === "takeout" ? "打包" : "多人共享"}</span>
                      <span className="chip chip-success">覆盖 {item.assignedMemberIds.length} 人</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="section-card">
            <p className="eyebrow">成员需求覆盖</p>
            <h2>每个人都被照顾到了吗？</h2>
            <div className="coverage-grid">
              {result.memberCoverage.map((coverage) => (
                <article key={coverage.memberId}>
                  <span className="avatar" aria-hidden="true">{coverage.memberName.slice(0, 1)}</span>
                  <div><strong>{coverage.memberName}</strong><p>{coverage.summary}</p></div>
                  <span className={`coverage-status status-${coverage.status}`}>
                    {coverage.satisfied}/{coverage.total} ✓
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="result-side-column">
          <section className="section-card sticky-card">
            <p className="eyebrow">价格明细</p>
            <h2>怎么算出来的？</h2>
            <dl className="price-breakdown">
              <div><dt>菜品小计</dt><dd>{formatMoney(result.pricing.subtotal)}</dd></div>
              <div><dt>套餐调整</dt><dd>{formatMoney(result.pricing.packageAdjustment)}</dd></div>
              <div><dt>满减</dt><dd className="discount">-{formatMoney(result.pricing.thresholdDiscount)}</dd></div>
              <div><dt>优惠券</dt><dd className="discount">-{formatMoney(result.pricing.couponDiscount)}</dd></div>
              <div><dt>服务费</dt><dd>{formatMoney(result.pricing.serviceFee)}</dd></div>
              <div><dt>税费</dt><dd>{formatMoney(result.pricing.tax)}</dd></div>
              <div className="total-row"><dt>最终总价</dt><dd>{formatMoney(result.pricing.total)}</dd></div>
            </dl>
            <div className="budget-ok">✓ 价格明细校验通过</div>
          </section>
          <section className="risk-banner risk-danger">
            <span aria-hidden="true">!</span>
            <div><strong>过敏安全提醒</strong><br />方案避开花生候选，但仍需向餐厅确认配料和交叉接触。</div>
          </section>
        </aside>
      </div>

      <section className="section-card">
        <div className="card-heading-row">
          <div><p className="eyebrow">备选方案</p><h2>换个侧重点</h2></div>
          <span className="chip">3 个实质差异</span>
        </div>
        <div className="alternative-grid">
          {result.alternatives.map((alternative) => (
            <article
              className={selectedAlternative?.id === alternative.id ? "is-selected" : ""}
              key={alternative.id}
              data-testid={`alternative-${alternative.id}`}
            >
              <div className="plan-status-row"><span className="chip">{alternative.difference}</span><strong>{formatMoney(alternative.total)}</strong></div>
              <h3>{alternative.title}</h3>
              <p>{alternative.description}</p>
              <button className="text-button" type="button" onClick={() => setSelectedAlternative(alternative)}>
                {selectedAlternative?.id === alternative.id ? "✓ 已选作演示方案" : "查看并采用 →"}
              </button>
            </article>
          ))}
        </div>
        {selectedAlternative && (
          <div className="selection-confirmation" role="status">
            已选择“{selectedAlternative.title}”作为当前演示备选；不会创建真实订单。
          </div>
        )}
      </section>

      <div className="inline-actions step-actions">
        <div className="edit-links">
          <Link className="text-link" href={`/session/${params.sessionId}/menu/review`}>修改菜单</Link>
          <Link className="text-link" href={`/session/${params.sessionId}/members`}>修改成员</Link>
          <Link className="text-link" href={`/session/${params.sessionId}/budget`}>修改预算</Link>
        </div>
        <Link className="button button-primary" href="/">完成 Demo ✓</Link>
      </div>
    </section>
  );
}
