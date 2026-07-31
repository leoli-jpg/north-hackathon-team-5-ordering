"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import type { EditableMenuItem, PriceField } from "@/domain/types";
import { getFrontendPorts } from "@/domain/ports";
import { moneyFromMajor, moneyToMajor } from "@/lib/money/money";

function priceValue(price: PriceField) {
  if (price.status === "confirmed") {
    return String(moneyToMajor(price.money));
  }
  if (price.status === "estimated") {
    return String(moneyToMajor(price.suggestedMoney));
  }
  return "";
}

export default function MenuReviewPage({ params }: Readonly<{ params: { sessionId: string } }>) {
  const router = useRouter();
  const [items, setItems] = useState<EditableMenuItem[]>([]);
  const [images, setImages] = useState<Array<{ id: string; previewUrl: string; pageIndex: number }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getFrontendPorts().menu.getMenuSnapshot(params.sessionId)
      .then((response) => {
        if (active) {
          setItems(response.data.items);
          setImages(response.data.images);
        }
      })
      .catch((error_: unknown) => {
        if (active) setError(error_ instanceof Error ? error_.message : "读取菜单失败");
      });
    return () => {
      active = false;
    };
  }, [params.sessionId]);

  const blockingItems = useMemo(
    () => items.filter((item) =>
      item.recommendationEligible
      && item.availability === "available"
      && (item.price.status !== "confirmed" || !item.accepted || item.name.trim().length === 0)
    ),
    [items]
  );
  const canConfirm = items.length > 0 && blockingItems.length === 0;

  function updateItem(id: string, patch: Partial<EditableMenuItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function updatePrice(item: EditableMenuItem, rawValue: string) {
    if (!rawValue) {
      updateItem(item.id, { price: { status: "missing", source: "manual" }, accepted: false });
      return;
    }
    updateItem(item.id, {
      price: { status: "confirmed", money: moneyFromMajor(Number(rawValue)), source: "manual" },
      accepted: true
    });
  }

  async function handleSave() {
    if (!canConfirm) {
      setError(`请先处理 ${blockingItems.length} 个价格缺失、低置信或菜名问题`);
      document.querySelector<HTMLElement>("[data-blocking-item='true'] input")?.focus();
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      for (const item of items) {
        await getFrontendPorts().menu.saveItem(params.sessionId, item.id, item);
      }
      await getFrontendPorts().menu.confirmMenu(params.sessionId);
      router.push(`/session/${params.sessionId}/members`);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow="步骤 3 / 6"
        title="校正菜单"
        description="确认菜名、价格、过敏原候选和份量。低置信或缺价菜品完成前，质量门不会放行。"
      />
      {items.length === 0 && !error ? (
        <div className="loading-panel" role="status">
          <div className="loading-spinner" />
          <p>正在读取 Mock 菜单快照…</p>
        </div>
      ) : (
        <>
          <div className={`quality-summary ${canConfirm ? "quality-ready" : ""}`} role="status">
            <span className="quality-icon" aria-hidden="true">{canConfirm ? "✓" : "!"}</span>
            <div>
              <strong>{canConfirm ? "菜单已达到推荐质量门" : `还有 ${blockingItems.length} 个菜品需要确认`}</strong>
              <p>{canConfirm ? "价格和低置信字段均已人工确认，可以继续填写成员需求。" : "补全价格或勾选人工确认后再继续。"}</p>
            </div>
          </div>

          <div className="review-grid">
            <aside className="section-card source-viewer">
              <div>
                <p className="eyebrow">识别证据</p>
                <h2>菜单原图</h2>
              </div>
              {images.map((image) => (
                <figure key={image.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.previewUrl} alt={`菜单原图第 ${image.pageIndex} 页`} />
                  <figcaption>第 {image.pageIndex} 页 · Mock 本地图片</figcaption>
                </figure>
              ))}
              <p className="risk-note">黄色/红色提示同时附带文字，不只依赖颜色表达。</p>
            </aside>

            <div className="menu-item-list">
              {items.map((item) => {
                const isBlocking = blockingItems.some((candidate) => candidate.id === item.id);
                return (
                  <article className="section-card menu-item-card" key={item.id} data-blocking-item={isBlocking}>
                    <div className="menu-item-title-row">
                      <div>
                        <p className="eyebrow">{item.category} · 置信度 {Math.round(item.confidence * 100)}%</p>
                        <h2>{item.name || "未命名菜品"}</h2>
                        <p>{item.description}</p>
                      </div>
                      <div className="chip-row">
                        {item.confidence < 0.75 && <span className="chip chip-warning">低置信 · 待确认</span>}
                        {item.price.status === "missing" && <span className="chip chip-danger">价格缺失</span>}
                        {item.accepted && <span className="chip chip-success">人工确认</span>}
                      </div>
                    </div>

                    <div className="menu-review-fields">
                      <label>
                        菜名
                        <input
                          aria-label={`${item.name || "未命名菜品"}菜名`}
                          value={item.name}
                          onChange={(event) => updateItem(item.id, { name: event.target.value, accepted: true })}
                        />
                      </label>
                      <label>
                        价格（元）
                        <input
                          aria-label={`${item.name}价格（元）`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={priceValue(item.price)}
                          onChange={(event) => updatePrice(item, event.target.value)}
                          placeholder="补全价格"
                        />
                      </label>
                      <label>
                        分类
                        <select value={item.category} onChange={(event) => updateItem(item.id, { category: event.target.value })}>
                          <option>主食</option>
                          <option>热菜</option>
                          <option>凉菜</option>
                          <option>点心</option>
                        </select>
                      </label>
                      <label>
                        辣度
                        <select
                          value={item.spiceLevel}
                          onChange={(event) => updateItem(item.id, { spiceLevel: Number(event.target.value) as EditableMenuItem["spiceLevel"] })}
                        >
                          <option value={0}>不辣</option>
                          <option value={1}>微辣</option>
                          <option value={2}>中辣</option>
                          <option value={3}>重辣</option>
                          <option value={4}>很辣</option>
                          <option value={5}>极辣</option>
                        </select>
                      </label>
                      <label>
                        候选配料
                        <input
                          value={item.ingredientTags.join("、")}
                          onChange={(event) => updateItem(item.id, { ingredientTags: event.target.value.split(/[、,，]/).filter(Boolean) })}
                        />
                      </label>
                      <label>
                        过敏原候选
                        <input
                          value={item.allergenCandidates.join("、")}
                          onChange={(event) => updateItem(item.id, { allergenCandidates: event.target.value.split(/[、,，]/).filter(Boolean) })}
                        />
                      </label>
                    </div>

                    <div className="item-confirm-row">
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={item.accepted}
                          onChange={(event) => updateItem(item.id, { accepted: event.target.checked })}
                        />
                        已人工确认菜名、价格和候选过敏原
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={item.recommendationEligible}
                          onChange={(event) => updateItem(item.id, { recommendationEligible: event.target.checked })}
                        />
                        参与推荐
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="risk-banner">
            <span aria-hidden="true">!</span>
            菜单识别的过敏原只是候选证据；严重过敏仍会在成员页要求二次确认。
          </aside>
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="inline-actions step-actions">
            <Link className="button button-secondary" href={`/session/${params.sessionId}/menu`}>← 返回上传</Link>
            <button className="button button-primary" type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "正在保存 Mock 菜单…" : "确认菜单并填写成员需求 →"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
