import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import BottomActionBar from "@/components/layout/BottomActionBar";
import SessionStepper from "@/components/layout/SessionStepper";

const sessionSteps = [
  { href: "/session/new", label: "创建聚餐", shortLabel: "创建" },
  { href: "/session/demo/menu", label: "上传菜单", shortLabel: "上传" },
  { href: "/session/demo/menu/review", label: "校正菜单", shortLabel: "校正" },
  { href: "/session/demo/members", label: "成员需求", shortLabel: "成员" },
  { href: "/session/demo/budget", label: "预算优惠", shortLabel: "预算" },
  { href: "/session/demo/result", label: "推荐结果", shortLabel: "结果" }
];

export default function SessionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="app-shell">
      <AppHeader title="周五晚餐" />
      <div className="session-layout">
        <aside className="session-sidebar" aria-label="聚餐流程">
          <SessionStepper currentPath="/session/demo/menu" steps={sessionSteps} />
        </aside>
        <main className="session-content">
          <div className="page-frame">
            {children}
          </div>
        </main>
      </div>
      <BottomActionBar
        backHref="/session/new"
        nextHref="/session/demo/menu/review"
        nextLabel="保存并继续"
      />
    </div>
  );
}
