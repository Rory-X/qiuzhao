import type { ApplicationStatus } from "@/types";

export const statusConfig: Record<
  ApplicationStatus,
  { label: string; short: string; color: string; soft: string }
> = {
  watch: { label: "意向岗位", short: "意向", color: "#8a887f", soft: "#eceae2" },
  applied: { label: "已经投递", short: "已投", color: "#b98a14", soft: "#f7eccb" },
  assess: { label: "在线测评", short: "测评", color: "#4a7580", soft: "#dcebef" },
  oa: { label: "笔试阶段", short: "笔试", color: "#466b8c", soft: "#dde8f2" },
  ai: { label: "AI 面试", short: "AI 面", color: "#5f7d59", soft: "#e1ecdf" },
  tech: { label: "技术面试", short: "技术面", color: "#4e7454", soft: "#dbeadd" },
  hr: { label: "HR 面试", short: "HR 面", color: "#c36837", soft: "#f5e2d6" },
  offer: { label: "拿到 Offer", short: "Offer", color: "#2e7d62", soft: "#d8eee6" },
  reject: { label: "流程结束", short: "结束", color: "#98534b", soft: "#f0dfdc" },
};

export const trackOptions = ["AI全栈", "AI应用", "Agent", "后端开发", "其他"];
export const sourceOptions = ["公司官网", "内推", "招聘平台", "社群 / 社区", "其他"];
export const resumeOptions = ["待选择", "通用简历", "定向简历"];

export const weeklyRhythm = [
  { day: "一", title: "更新岗位池", note: "官网核验 15–25 个机会" },
  { day: "二", title: "投递日", note: "完成 5–8 个高匹配投递" },
  { day: "三", title: "笔试手撕", note: "计时套题 + 错题归因" },
  { day: "四", title: "项目深挖", note: "讲清决定、失败与验证" },
  { day: "五", title: "模拟面试", note: "AI / Vibe 各一轮" },
  { day: "末", title: "漏斗复盘", note: "只改一个关键变量" },
];
