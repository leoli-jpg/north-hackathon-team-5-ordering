import PageHeader from "@/components/layout/PageHeader";
import PlaceholderPanel from "@/components/ui/PlaceholderPanel";

export default function SharePage() {
  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow="协作占位"
        title="分享与协作"
        description="预留分享链接、成员状态和实时协作入口。"
      />
      <PlaceholderPanel title="分享协作占位">
        <p>完整实时协作不在 RFC-0003 首期范围内，后续可按需要扩展。</p>
      </PlaceholderPanel>
    </section>
  );
}
