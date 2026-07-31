import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";

const capabilities = [
  "预算内推荐",
  "严重过敏二次确认",
  "多人独立需求",
  "共享菜与打包",
  "满减与优惠券",
  "可比较备选方案"
];

const flowSteps = [
  {
    icon: "📷",
    title: "拍菜单",
    description: "使用演示菜单或选择图片，查看模拟识别进度。"
  },
  {
    icon: "👥",
    title: "收需求",
    description: "逐位解析忌口、过敏、预算与口味偏好。"
  },
  {
    icon: "✨",
    title: "拿方案",
    description: "获得可下单组合、价格明细、覆盖情况与备选。"
  }
];

export default function HomePage() {
  return (
    <div className="app-shell">
      <AppHeader title="API 优先演示" />
      <main className="home-page">
        <section className="hero-panel hero-split">
          <div className="hero-content">
            <p className="eyebrow">多人点餐推荐 · RFC-0003</p>
            <h1>菜单不用翻半天。<span>一起吃，也能照顾每个人。</span></h1>
            <p className="hero-copy">
              上传菜单、确认菜品、收集多人需求，再在预算和优惠范围内生成一份说得清楚的点餐方案。
            </p>
            <div className="hero-actions">
              <Link className="button button-primary button-large" href="/session/new">开始一次聚餐 <span aria-hidden="true">→</span></Link>
              <Link className="button button-secondary button-large" href="/session/demo/menu">直接体验完整 Demo</Link>
            </div>
            <div className="hero-trust">
              <span><i aria-hidden="true">✓</i> 无需登录</span>
              <span><i aria-hidden="true">✓</i> 数据库可持久化</span>
              <span><i aria-hidden="true">✓</i> 可演示冲突与恢复</span>
            </div>
          </div>
          <div className="hero-visual" aria-label="多人共享点餐示意">
            <span className="floating-tag tag-budget">预算内</span>
            <span className="floating-tag tag-allergy">避开花生</span>
            <div className="plate">
              <span aria-hidden="true">🍲</span>
            </div>
            <div className="picked-pill">✦ 4 人现场 · 1 份打包</div>
          </div>
        </section>

        <section className="section-card flow-section" aria-labelledby="flow-title">
          <div className="section-heading">
            <p className="eyebrow">完整闭环</p>
            <h2 id="flow-title">三段体验，六个清晰步骤</h2>
            <p>页面只突出当前任务，外部字段统一由 Gateway / Adapter 转换。</p>
          </div>
          <div className="feature-grid">
            {flowSteps.map((step, index) => (
              <article className="feature-card" key={step.title}>
                <span className="feature-index">0{index + 1}</span>
                <span className="feature-icon" aria-hidden="true">{step.icon}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-card capability-section" aria-labelledby="capability-title">
          <div>
            <p className="eyebrow">演示覆盖</p>
            <h2 id="capability-title">不只展示 happy path</h2>
            <p>价格缺失、低置信、严重过敏、预算不足和重新生成都有可操作页面状态。</p>
          </div>
          <ul className="capability-list">
            {capabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
          <Link className="text-link" href="/session/conflict-demo/budget">直接查看预算冲突演示 →</Link>
        </section>

        <p className="risk-banner">
          <span aria-hidden="true">!</span>
          过敏原候选和餐厅供应仍需下单前向商家二次确认。本 Demo 不替代食品安全判断。
        </p>
      </main>
    </div>
  );
}
