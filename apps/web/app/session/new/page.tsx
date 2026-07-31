import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";

export default function NewSessionPage() {
  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow="步骤 1 / 6"
        title="创建聚餐"
        description="先确定聚餐名称、人数和基础场景。T1 仅保留路由与占位表单，真实创建草稿由后续 T2/T3 接入。"
      />
      <form className="form-card">
        <label>
          聚餐名称
          <input name="title" placeholder="周五晚餐" />
        </label>
        <label>
          现场人数
          <input name="peopleCount" type="number" min="1" defaultValue="4" />
        </label>
        <fieldset>
          <legend>餐次</legend>
          <div className="radio-row">
            <label><input type="radio" name="mealType" defaultChecked /> 午餐</label>
            <label><input type="radio" name="mealType" /> 晚餐</label>
            <label><input type="radio" name="mealType" /> 其他</label>
          </div>
        </fieldset>
        <label>
          币种
          <select name="currency" defaultValue="CNY">
            <option value="CNY">CNY</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <div className="inline-actions">
          <Link className="button button-secondary" href="/">返回首页</Link>
          <Link className="button button-primary" href="/session/demo/menu">创建并上传菜单</Link>
        </div>
      </form>
    </section>
  );
}
