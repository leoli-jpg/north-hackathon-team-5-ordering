import Image from "next/image";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";

export default function MenuUploadPage() {
  return (
    <section className="stacked-page">
      <PageHeader
        eyebrow="步骤 2 / 6"
        title="上传菜单"
        description="选择或上传菜单图片，预览缩略图后进入模拟识别任务。T1 只验证路由、布局和状态占位。"
      />
      <div className="menu-upload-layout">
        <div className="form-card menu-upload-card">
          <div className="dropzone-card">
            <div className="dropzone-icon" aria-hidden="true">📷</div>
            <h2>上传菜单图片</h2>
            <p>支持拍照、相册或多张图片；T1 先用 Mock 菜单图片展示后续上传与识别入口。</p>
            <div className="dropzone-actions">
              <button className="button button-primary" type="button">拍照</button>
              <button className="button button-secondary" type="button">从相册选择</button>
            </div>
          </div>
          <div className="thumbnail-strip" aria-label="菜单图片缩略图">
            <Image src="/demo/menu-page-1.svg" alt="Mock 菜单第一页" width={96} height={126} />
            <Image src="/demo/menu-page-2.svg" alt="Mock 菜单第二页" width={96} height={126} />
            <span className="thumbnail-placeholder">待添加</span>
          </div>
          <p className="form-note">图片质量提示：尽量拍摄完整菜单、避免强反光，多人共享菜和打包需求可在后续步骤补充。</p>
        </div>

        <aside className="placeholder-panel menu-progress-panel">
          <h2>识别进度占位</h2>
          <p>后续 T2/T3 将在这里接入 Session Draft Store、MenuGateway、Mock 识别进度、失败重试与低置信字段。</p>
          <div className="progress-mock">
            <span />
            <span />
            <span />
          </div>
          <div className="inline-actions">
            <Link className="button button-secondary" href="/session/demo/menu/review">查看校正占位</Link>
            <Link className="button button-primary" href="/session/demo/menu/review">保存并继续</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
