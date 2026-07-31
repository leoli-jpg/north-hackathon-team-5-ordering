import PageHeader from "@/components/layout/PageHeader";
import PlaceholderPanel from "@/components/ui/PlaceholderPanel";

export default function MembersPage() {
  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow="步骤 4 / 6"
        title="成员需求"
        description="输入每位成员的自然语言需求，展示 Agent 解析状态和约束 Chip 占位。"
      />
      <PlaceholderPanel title="成员需求占位">
        <p>后续 T4 将在这里接入成员草稿、AgentRuntimeGateway 和约束编辑。</p>
      </PlaceholderPanel>
    </section>
  );
}
