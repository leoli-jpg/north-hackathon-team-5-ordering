"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getFrontendPorts } from "@/domain/ports";
import { saveDraft } from "@/state/session-draft-store";
import { useSessionDraft } from "@/state/use-session-draft";

const stageLabels = {
  queued: "等待开始",
  reading_images: "读取图片",
  detecting_items: "识别菜品",
  validating_prices: "校验价格",
  completed: "识别完成",
  failed: "识别失败"
};

export default function MenuUploadPage({ params }: Readonly<{ params: { sessionId: string } }>) {
  const router = useRouter();
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const draft = useSessionDraft(params.sessionId);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const job = draft.menuSnapshot.extractionJob;

  async function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }
    setIsUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name} 不是支持的图片格式`);
        }
        const previewUrl = URL.createObjectURL(file);
        await getFrontendPorts().menu.uploadImage(params.sessionId, {
          pageIndex: draft.menuSnapshot.images.length + 1,
          previewUrl,
          fileName: file.name,
          rotation: 0,
          quality: file.size < 50_000 ? "low" : "good",
          qualityIssues: file.size < 50_000 ? ["图片较小，真实 OCR 可能不稳定"] : []
        });
      }
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "图片添加失败，请重试");
    } finally {
      setIsUploading(false);
      if (galleryInput.current) galleryInput.current.value = "";
      if (cameraInput.current) cameraInput.current.value = "";
    }
  }

  function rotateImage(imageId: string) {
    const current = draft.menuSnapshot;
    saveDraft(params.sessionId, {
      menuSnapshot: {
        ...current,
        images: current.images.map((image) => image.id === imageId
          ? { ...image, rotation: ((image.rotation + 90) % 360) as 0 | 90 | 180 | 270 }
          : image)
      }
    });
  }

  async function handleRecognize() {
    if (draft.menuSnapshot.images.length === 0) {
      setError("请至少添加一张菜单图片");
      return;
    }
    setIsRecognizing(true);
    setError(null);

    try {
      await getFrontendPorts().menu.startExtraction(params.sessionId);
      await getFrontendPorts().session.advanceStep(params.sessionId, "review");
      router.push(`/session/${params.sessionId}/menu/review`);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "识别失败，请重试");
    } finally {
      setIsRecognizing(false);
    }
  }

  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow="步骤 2 / 6"
        title="上传菜单"
        description="拍照、选择图片，或直接使用已准备好的两页演示菜单。识别、进度和错误全部由 Mock MenuGateway 模拟。"
      />
      <div className="menu-upload-layout">
        <div className="form-card menu-upload-card">
          <div className="dropzone-card">
            <div className="dropzone-icon" aria-hidden="true">📷</div>
            <p className="eyebrow">菜单扫描</p>
            <h2>把菜单交给我们</h2>
            <p>可以添加多张图片；演示菜单已经预置，直接点击“开始识别”即可继续完整流程。</p>
            <div className="dropzone-actions">
              <button className="button button-primary" type="button" onClick={() => cameraInput.current?.click()} disabled={isUploading}>
                {isUploading ? "正在添加…" : "拍照"}
              </button>
              <button className="button button-secondary" type="button" onClick={() => galleryInput.current?.click()} disabled={isUploading}>
                从相册选择
              </button>
            </div>
            <input
              ref={cameraInput}
              className="visually-hidden"
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="拍摄菜单图片"
              onChange={(event) => handleFiles(event.target.files)}
            />
            <input
              ref={galleryInput}
              className="visually-hidden"
              type="file"
              accept="image/*"
              multiple
              aria-label="选择菜单图片"
              onChange={(event) => handleFiles(event.target.files)}
            />
          </div>

          <div className="thumbnail-strip" aria-label="菜单图片缩略图">
            {draft.menuSnapshot.images.map((image) => (
              <article className="thumbnail-card" key={image.id}>
                {/* blob URL 与静态演示图都由浏览器本地渲染，不经过外部图片服务。 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.previewUrl}
                  alt={`菜单第 ${image.pageIndex} 页`}
                  style={{ transform: `rotate(${image.rotation}deg)` }}
                />
                <div>
                  <strong>第 {image.pageIndex} 页</strong>
                  <span className={image.quality === "good" ? "chip chip-success" : "chip chip-warning"}>
                    {image.quality === "good" ? "清晰" : "需留意"}
                  </span>
                </div>
                <button type="button" className="text-button" onClick={() => rotateImage(image.id)} aria-label={`旋转菜单第 ${image.pageIndex} 页`}>
                  ↻ 旋转
                </button>
              </article>
            ))}
          </div>
          <p className="form-note">图片质量只做前端明显问题提示，不声称能判断真实 OCR 准确率。</p>
        </div>

        <aside className="section-card menu-progress-panel" aria-live="polite">
          <div className="plan-status-row">
            <div>
              <p className="eyebrow">Mock 任务</p>
              <h2>识别进度</h2>
            </div>
            <span className={`chip ${job.status === "completed" ? "chip-success" : isRecognizing ? "chip-warning" : ""}`}>
              {stageLabels[job.stage]}
            </span>
          </div>
          <div className="progress-track" aria-label={`识别进度 ${job.progress}%`}>
            <span style={{ width: `${job.progress}%` }} />
          </div>
          <ol className="stage-list">
            <li className={job.progress >= 28 ? "is-done" : ""}><span>1</span> 读取 {draft.menuSnapshot.images.length} 页图片</li>
            <li className={job.progress >= 62 ? "is-done" : ""}><span>2</span> 识别菜名、价格与配料</li>
            <li className={job.progress >= 88 ? "is-done" : ""}><span>3</span> 合并页面并校验价格</li>
          </ol>
          <p>{job.message ?? "已准备好演示菜单，开始后会短暂展示三个识别阶段。"}</p>
          <div className="result-preview-row">
            <span><strong>5</strong> 个菜品</span>
            <span><strong>1</strong> 项缺价</span>
            <span><strong>1</strong> 个低置信</span>
          </div>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button className="button button-primary button-block" type="button" onClick={handleRecognize} disabled={isRecognizing || isUploading}>
            {isRecognizing ? "正在识别 Mock 菜单…" : "开始识别菜单 →"}
          </button>
        </aside>
      </div>
    </section>
  );
}
