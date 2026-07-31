import PageHeader from "@/components/layout/PageHeader";
import PlaceholderPanel from "@/components/ui/PlaceholderPanel";

export default function MenuReviewPage() {
  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow="步骤 3 / 6"
        title="校正菜单"
        description="人工确认菜名、价格、配料、辣度和份量。T1 只保留页面骨架。"
      />
      <PlaceholderPanel title="菜单校正占位">
        <p>后续 T4 将在这里实现菜品编辑、价格确认和识别低置信提示。</p>
      </PlaceholderPanel>
    </section>
  );
}
