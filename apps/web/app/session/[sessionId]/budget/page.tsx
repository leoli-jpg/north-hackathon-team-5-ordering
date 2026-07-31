import PageHeader from "@/components/layout/PageHeader";
import PlaceholderPanel from "@/components/ui/PlaceholderPanel";

export default function BudgetPage() {
  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow="步骤 5 / 6"
        title="预算优惠"
        description="设置总预算、优惠、打包成员和费用假设。T1 只验证页面入口。"
      />
      <PlaceholderPanel title="预算优惠占位">
        <p>后续 T4 将在这里实现预算表单、优惠字段和跨字段校验。</p>
      </PlaceholderPanel>
    </section>
  );
}
