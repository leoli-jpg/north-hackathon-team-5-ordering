import Link from "next/link";

const capabilities = [
  "预算内推荐",
  "严重过敏提示",
  "多人需求收集",
  "共享菜与打包",
  "优惠组合",
  "备选方案"
];

const flowSteps = [
  {
    title: "上传菜单",
    description: "支持拍照、相册或 Demo Fixture，识别后进入人工校正。"
  },
  {
    title: "收集需求",
    description: "记录每位成员的自然语言需求、忌口、过敏和偏好。"
  },
  {
    title: "生成方案",
    description: "在预算、约束和优惠假设下生成主方案与备选方案。"
  }
];

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero-panel">
        <p className="eyebrow">多人点餐推荐 Demo</p>
        <h1>一次聚餐，多人需求，预算内也能说清楚。</h1>
        <p className="hero-copy">
          上传菜单、校正菜品、收集成员需求，再生成可解释的推荐方案。默认使用 Mock 流程，无需真实后端即可完整演示。
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/session/new">开始一次聚餐</Link>
          <Link className="button button-secondary" href="/session/demo/menu">查看 Demo 流程</Link>
        </div>
        <p className="risk-note">提示：过敏与餐厅供应情况仍需向商家二次确认。</p>
      </section>

      <section className="section-card" aria-labelledby="flow-title">
        <h2 id="flow-title">完整流程</h2>
        <div className="feature-grid">
          {flowSteps.map((step) => (
            <article className="feature-card" key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card" aria-labelledby="capability-title">
        <h2 id="capability-title">Demo 能力</h2>
        <ul className="capability-list">
          {capabilities.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
