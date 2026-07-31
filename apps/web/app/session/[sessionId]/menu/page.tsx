import PageHeader from "@/components/layout/PageHeader";
import PlaceholderPanel from "@/components/ui/PlaceholderPanel";

export default function MenuUploadPage() {
  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow="步骤 2 / 6"
        title="上传菜单"
        description="选择或上传菜单图片，并进入模拟识别任务。T1 只验证路由、布局和状态占位。"
      />
      <PlaceholderPanel title="菜单上传与识别占位">
        <p>后续 T2/T3 将在这里接入 Session Draft Store、MenuGateway 和 Mock 场景。</p>
      </PlaceholderPanel>
    </section>
  );
}
