import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigation } from "@/components/Sidebar";
import type { OnboardingState, Page } from "@/types";

const descriptions: Record<Page, string> = {
  overview: "安排今天任务，并查看真实进展。",
  radar: "浏览实时聚合岗位，核验后加入机会池。",
  opportunities: "录入、核验、编辑和归档岗位。",
  pipeline: "拖动流程卡片并完成每周复盘。",
  interview: "安排训练，记录答案和复盘得分。",
  experience: "搜索 242 道真实面试问题与参考答案。",
  materials: "阅读本地材料并完成检查清单。",
};

export function OnboardingGuide({ onboarding, onNavigate, onSkip }: {
  onboarding: OnboardingState;
  onNavigate: (page: Page) => void;
  onSkip: () => void;
}) {
  if (onboarding.skipped) return null;
  const next = navigation.find((item) => !onboarding.visited.includes(item.id));
  if (!next) return null;
  const Icon = next.icon;

  return (
    <aside className="onboarding-guide" aria-live="polite">
      <button className="onboarding-close" onClick={onSkip} aria-label="跳过全部引导"><X /></button>
      <span className="onboarding-icon"><Icon /></span>
      <div>
        <p><Sparkles /> 新入口</p>
        <b>{next.label}</b>
        <small>{descriptions[next.id]}</small>
      </div>
      <Button variant="seal" size="sm" onClick={() => onNavigate(next.id)}>去看看 <ArrowRight /></Button>
      <button className="onboarding-skip" onClick={onSkip}>跳过引导</button>
    </aside>
  );
}
