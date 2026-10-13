import {
  BookOpenText,
  BriefcaseBusiness,
  CalendarCheck2,
  ChevronsLeft,
  ChevronsRight,
  Cloud,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  NotebookPen,
  Plus,
  Radar,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnboardingState, Page } from "@/types";

export const navigation = [
  { id: "overview" as const, label: "今日作战台", icon: LayoutDashboard },
  { id: "radar" as const, label: "岗位雷达", icon: Radar },
  { id: "opportunities" as const, label: "机会与投递", icon: BriefcaseBusiness },
  { id: "pipeline" as const, label: "投递流水线", icon: ListChecks },
  { id: "interview" as const, label: "面试训练", icon: MessageSquareText },
  { id: "experience" as const, label: "真实面经", icon: NotebookPen },
  { id: "materials" as const, label: "材料与清单", icon: BookOpenText },
];

export function Sidebar({
  page,
  onPageChange,
  onCreate,
  onboarding,
  rhythm,
  collapsed,
  onToggleCollapsed,
}: {
  page: Page;
  onPageChange: (page: Page) => void;
  onCreate: () => void;
  onboarding: OnboardingState;
  rhythm: boolean[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const rhythmDone = rhythm.filter(Boolean).length;
  return (
    <aside className="sidebar-shell">
      <button className="sidebar-toggle" type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"} aria-expanded={!collapsed} aria-controls="workspace-sidebar-navigation" title={collapsed ? "展开侧边栏" : "收起侧边栏"}>
        {collapsed ? <ChevronsRight aria-hidden="true" /> : <ChevronsLeft aria-hidden="true" />}
      </button>
      <button className="brand-lockup" onClick={() => onPageChange("overview")} aria-label="返回今日作战台" title={collapsed ? "今日作战台" : undefined}>
        <span className="brand-seal">秋</span>
        <span className="brand-copy">
          <strong>钱嘉豪秋招工作台</strong>
          <small>LOCAL · EVIDENCE FIRST</small>
        </span>
      </button>

      <Button variant="seal" className="w-full sketch-button" onClick={onCreate} aria-label="新建投递" title={collapsed ? "新建投递" : undefined}>
        <Plus />
        <span className="sidebar-create-label">新建投递</span>
      </Button>

      <nav id="workspace-sidebar-navigation" className="sidebar-nav" aria-label="工作台导航">
        <p className="nav-kicker">WORKSPACE</p>
        <a href="/projects" className="nav-item" aria-label="项目作品集" title={collapsed ? "项目作品集" : undefined}><BriefcaseBusiness /><span>项目作品集</span></a>
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={cn(
                "nav-item",
                page === item.id && "active",
                !onboarding.skipped && !onboarding.visited.includes(item.id) && "needs-guide",
              )}
              onClick={() => onPageChange(item.id)}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
            >
              <Icon />
              <span>{item.label}</span>
              {!onboarding.skipped && !onboarding.visited.includes(item.id) && <i className="nav-guide-ping" aria-label="新入口" />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-spacer" />

      <div className="week-card">
        <div className="week-card-head">
          <CalendarCheck2 />
          <span>本周节奏</span>
        </div>
        <strong>投递与面试双线推进</strong>
        <div className="week-dots" aria-label={`本周进度 ${rhythmDone}/6`}>
          {[1, 2, 3, 4, 5, 6].map((day) => (
            <i key={day} className={rhythm[day - 1] ? "done" : undefined} />
          ))}
        </div>
        <small>{rhythmDone} / 6 个节奏节点已推进</small>
      </div>

      <div className="local-status">
        <span className="status-dot" />
        <div>
          <b>本地模式</b>
          <small>状态写入 data/state.json</small>
        </div>
        <Cloud className="ml-auto" />
      </div>

      <div className="sidebar-signature">
        <Sparkles />
        <span>证据优先，人工投递</span>
      </div>
    </aside>
  );
}
