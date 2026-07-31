"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getFrontendPorts } from "@/domain/ports";
import type { MemberConstraint, MemberView } from "@/domain/types";
import { saveDraft } from "@/state/session-draft-store";
import { useSessionDraft } from "@/state/use-session-draft";

export default function MembersPage({ params }: Readonly<{ params: { sessionId: string } }>) {
  const router = useRouter();
  const draft = useSessionDraft(params.sessionId);
  const [members, setMembers] = useState<MemberView[]>(draft.members);
  const [isParsing, setIsParsing] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMembers(draft.members);
  }, [draft.members]);

  const criticalUnconfirmed = useMemo(
    () => members.some((member) => member.constraints.some((constraint) => constraint.severity === "critical" && !constraint.confirmed)),
    [members]
  );
  const incompleteMembers = useMemo(
    () => members.filter((member) =>
      !member.noRequirements
      && (member.parseStatus === "idle" || member.parseStatus === "failed" || member.parseStatus === "needs_review")
    ),
    [members]
  );

  function commitMembers(nextMembers: MemberView[]) {
    setMembers(nextMembers);
    saveDraft(params.sessionId, { members: nextMembers });
  }

  function updateMember(id: string, patch: Partial<MemberView>) {
    commitMembers(members.map((member) => member.id === id ? { ...member, ...patch } : member));
  }

  async function parseRequirement(memberId: string) {
    const member = members.find((item) => item.id === memberId);
    if (!member) return;

    setIsParsing((current) => ({ ...current, [memberId]: true }));
    setError(null);
    updateMember(memberId, { parseStatus: "running", noRequirements: false });

    try {
      const result = await getFrontendPorts().agentRuntime.parseMemberRequirement(
        params.sessionId,
        memberId,
        member.requirementText
      );
      const nextMembers = members.map((item) => item.id === memberId
        ? {
            ...item,
            constraints: result.data.constraints,
            clarificationQuestions: result.data.clarificationQuestions,
            parseStatus: result.data.confidence < 0.8 ? "needs_review" as const : "parsed" as const,
            noRequirements: item.requirementText.trim().length === 0
          }
        : item);
      commitMembers(nextMembers);
    } catch (error_: unknown) {
      updateMember(memberId, { parseStatus: "failed" });
      setError(error_ instanceof Error ? `${member.name}：${error_.message}` : "解析失败，请重试");
    } finally {
      setIsParsing((current) => ({ ...current, [memberId]: false }));
    }
  }

  function confirmConstraint(memberId: string, constraintId: string) {
    const nextMembers = members.map((member) => member.id === memberId
      ? {
          ...member,
          constraints: member.constraints.map((constraint) =>
            constraint.id === constraintId ? { ...constraint, confirmed: true } : constraint
          ),
          clarificationQuestions: []
        }
      : member);
    commitMembers(nextMembers);
  }

  function addManualConstraint(memberId: string) {
    const constraint: MemberConstraint = {
      id: `manual-${memberId}-${Date.now()}`,
      label: "人工约束：需要当面确认",
      type: "other",
      severity: "hard",
      confirmed: true,
      source: "manual"
    };
    const nextMembers = members.map((member) => member.id === memberId
      ? { ...member, constraints: [...member.constraints, constraint], parseStatus: "parsed" as const }
      : member);
    commitMembers(nextMembers);
  }

  function addMember() {
    const memberNumber = members.length + 1;
    commitMembers([
      ...members,
      {
        id: `member-${Date.now()}`,
        name: `成员 ${memberNumber}`,
        presence: "onsite",
        requirementText: "",
        constraints: [],
        clarificationQuestions: [],
        parseStatus: "idle",
        noRequirements: false
      }
    ]);
  }

  function removeMember(memberId: string) {
    if (members.length <= 1) {
      setError("至少保留一名成员");
      return;
    }
    commitMembers(members.filter((member) => member.id !== memberId));
  }

  async function handleSave() {
    if (criticalUnconfirmed || incompleteMembers.length > 0) {
      setError(
        criticalUnconfirmed
          ? "请先完成严重过敏二次确认"
          : `请确认 ${incompleteMembers.map((member) => member.name).join("、")} 的需求，或勾选“无特殊要求”`
      );
      return;
    }
    setError(null);
    saveDraft(params.sessionId, { members });
    await getFrontendPorts().session.advanceStep(params.sessionId, "budget");
    router.push(`/session/${params.sessionId}/budget`);
  }

  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow="步骤 4 / 6"
        title="每个人都想吃什么？"
        description="输入自然语言后由 Mock Agent 解析成可编辑约束。严重过敏固定置顶，并要求人工二次确认。"
      />

      <div className="members-toolbar">
        <div>
          <strong>{members.length} 位成员</strong>
          <span>{members.filter((member) => member.presence === "takeout").length} 位打包</span>
        </div>
        <button className="button button-secondary" type="button" onClick={addMember}>＋ 添加成员</button>
      </div>

      <div className="members-grid">
        {members.map((member, index) => (
          <article className="section-card member-card" key={member.id} data-testid={`member-${member.id}`}>
            <div className="member-card-header">
              <div className="member-identity">
                <span className="avatar" aria-hidden="true">{member.name.slice(0, 1)}</span>
                <div>
                  <input
                    aria-label={`成员 ${index + 1} 姓名`}
                    value={member.name}
                    onChange={(event) => updateMember(member.id, { name: event.target.value })}
                  />
                  <div className="presence-toggle" role="group" aria-label={`${member.name}用餐方式`}>
                    <button
                      type="button"
                      className={member.presence === "onsite" ? "is-selected" : ""}
                      onClick={() => updateMember(member.id, { presence: "onsite" })}
                    >
                      现场
                    </button>
                    <button
                      type="button"
                      className={member.presence === "takeout" ? "is-selected" : ""}
                      onClick={() => updateMember(member.id, { presence: "takeout" })}
                    >
                      打包
                    </button>
                  </div>
                </div>
              </div>
              <button className="icon-button" type="button" onClick={() => removeMember(member.id)} aria-label={`删除成员 ${member.name}`}>×</button>
            </div>

            <label>
              自然语言需求
              <textarea
                aria-label={`${member.name}自然语言需求`}
                value={member.requirementText}
                placeholder="例如：花生严重过敏，不吃内脏，希望不要太辣。"
                rows={3}
                onChange={(event) => updateMember(member.id, {
                  requirementText: event.target.value,
                  parseStatus: "idle",
                  noRequirements: false
                })}
              />
            </label>
            <div className="member-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={isParsing[member.id] || member.noRequirements}
                onClick={() => parseRequirement(member.id)}
              >
                {isParsing[member.id] ? "Mock Agent 解析中…" : "✦ 解析需求"}
              </button>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={member.noRequirements}
                  onChange={(event) => updateMember(member.id, {
                    noRequirements: event.target.checked,
                    parseStatus: event.target.checked ? "parsed" : "idle",
                    constraints: event.target.checked ? [] : member.constraints,
                    clarificationQuestions: []
                  })}
                />
                无特殊要求
              </label>
            </div>

            {member.clarificationQuestions.length > 0 && (
              <div className="clarification-panel" role="alert">
                <strong>需要二次确认</strong>
                <p>{member.clarificationQuestions.join(" ")}</p>
              </div>
            )}

            <div className="constraint-section">
              <div className="constraint-heading">
                <strong>已解析约束</strong>
                <span className={`status-dot status-${member.parseStatus}`}>
                  {member.noRequirements ? "无特殊要求" : member.parseStatus === "failed" ? "解析失败" : member.parseStatus === "needs_review" ? "待确认" : "已同步"}
                </span>
              </div>
              <div className="chip-row" aria-label={`${member.name}的约束`}>
                {member.constraints.map((constraint) => (
                  <span
                    className={`chip ${constraint.severity === "critical" && !constraint.confirmed ? "chip-danger" : constraint.severity === "critical" ? "chip-success" : ""}`}
                    key={constraint.id}
                  >
                    {constraint.label}{constraint.confirmed ? " ✓" : " ?"}
                    {constraint.severity === "critical" && !constraint.confirmed && (
                      <button type="button" onClick={() => confirmConstraint(member.id, constraint.id)}>确认</button>
                    )}
                  </span>
                ))}
                {member.constraints.length === 0 && !member.noRequirements && <span className="empty-inline">尚未解析</span>}
              </div>
              {member.parseStatus === "failed" && (
                <button className="text-button" type="button" onClick={() => addManualConstraint(member.id)}>＋ 手工添加约束</button>
              )}
            </div>
          </article>
        ))}
      </div>

      {criticalUnconfirmed && (
        <aside className="risk-banner risk-danger">
          <span aria-hidden="true">!</span>
          <div><strong>存在未确认的严重过敏约束</strong><br />该硬约束不会被推荐器自动放宽，确认后才能继续。</div>
        </aside>
      )}
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="inline-actions step-actions">
        <Link className="button button-secondary" href={`/session/${params.sessionId}/menu/review`}>← 返回菜单校正</Link>
        <button className="button button-primary" type="button" onClick={handleSave}>确认成员并设置预算 →</button>
      </div>
    </section>
  );
}
