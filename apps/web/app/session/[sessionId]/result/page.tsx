import PageHeader from "@/components/layout/PageHeader";
import PlaceholderPanel from "@/components/ui/PlaceholderPanel";

export default function ResultPage() {
  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow="步骤 6 / 6"
        title="推荐结果"
        description="展示主推荐方案、价格、理由、约束满足情况和备选方案。"
      />
      <PlaceholderPanel title="推荐结果占位">
        <p>后续 T5 将在这里实现成功、冲突、失败、备选方案和版本恢复状态。</p>
      </PlaceholderPanel>
    </section>
  );
}
