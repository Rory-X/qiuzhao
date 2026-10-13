import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, CircleDashed, GripVertical, Plus, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { statusConfig } from "@/data/config";
import { formatDate, uid, weekKey } from "@/lib/utils";
import type { Application, ApplicationStatus, WorkbenchState } from "@/types";

const columns: Array<{ id: ApplicationStatus; label: string; accepts: ApplicationStatus[] }> = [
  { id: "watch", label: "机会池", accepts: ["watch"] },
  { id: "applied", label: "已投递 / 测评", accepts: ["applied", "assess"] },
  { id: "oa", label: "笔试", accepts: ["oa"] },
  { id: "tech", label: "AI / 技术面", accepts: ["ai", "tech"] },
  { id: "hr", label: "HR / 终面", accepts: ["hr"] },
  { id: "offer", label: "Offer", accepts: ["offer"] },
];

function ReviewDialog({ open, state, onOpenChange, onSave }: {
  open: boolean;
  state: WorkbenchState;
  onOpenChange: (open: boolean) => void;
  onSave: (next: WorkbenchState) => void;
}) {
  const [wins, setWins] = useState("");
  const [bottleneck, setBottleneck] = useState("");
  const [nextChange, setNextChange] = useState("");
  const currentWeek = weekKey();
  const previous = [...state.reviews].reverse().find((review) => review.weekKey === currentWeek);

  useEffect(() => {
    if (!open) return;
    setWins(previous?.wins || "");
    setBottleneck(previous?.bottleneck || "");
    setNextChange(previous?.nextChange || "");
  }, [open, previous?.id]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (![wins, bottleneck, nextChange].some((value) => value.trim())) return;
    const review = {
      id: previous?.id || uid("review"),
      weekKey: currentWeek,
      createdAt: new Date().toISOString(),
      wins: wins.trim(),
      bottleneck: bottleneck.trim(),
      nextChange: nextChange.trim(),
    };
    onSave({ ...state, reviews: previous ? state.reviews.map((item) => item.id === previous.id ? review : item) : [...state.reviews, review] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>本周漏斗复盘</DialogTitle><DialogDescription>{currentWeek} · 记录事实，只选择一个下周变量。</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <label className="form-field"><span>本周有效进展</span><textarea className="form-textarea" rows={3} value={wins} onChange={(e) => setWins(e.target.value)} placeholder="获得了什么反馈或推进？" /></label>
          <label className="form-field"><span>当前瓶颈</span><textarea className="form-textarea" rows={3} value={bottleneck} onChange={(e) => setBottleneck(e.target.value)} placeholder="卡在哪个阶段，有什么证据？" /></label>
          <label className="form-field"><span>下周只改一个变量</span><textarea className="form-textarea" rows={3} value={nextChange} onChange={(e) => setNextChange(e.target.value)} placeholder="例如：重写简历首屏项目证据" /></label>
          <Button type="submit" variant="seal" className="w-full">保存本周复盘</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Pipeline({ state, onCreate, onStatusChange, onStateChange }: {
  state: WorkbenchState;
  onCreate: () => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onStateChange: (next: WorkbenchState, message?: string) => void;
}) {
  const { applications } = state;
  const [reviewOpen, setReviewOpen] = useState(false);
  const currentWeek = weekKey();
  const weeklyApplied = applications.filter((item) => item.appliedAt && weekKey(new Date(`${item.appliedAt}T12:00:00+08:00`)) === currentWeek).length;
  const entered = applications.filter((item) => !["watch", "reject"].includes(item.status)).length;
  const currentInterviews = applications.filter((item) => ["ai", "tech", "hr"].includes(item.status)).length;
  const reachedInterview = applications.filter((item) => ["ai", "tech", "hr", "offer"].includes(item.status)).length;
  const offers = applications.filter((item) => item.status === "offer").length;
  const conversion = entered ? Math.round((reachedInterview / entered) * 100) : null;
  const lastReview = [...state.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><p className="section-kicker">APPLICATION FLOW</p><h1>投递流水线</h1><p>拖动卡片或修改状态，所有阶段变化都会保存到本地。</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="sketch-button" onClick={() => setReviewOpen(true)}><RotateCcw /> 本周复盘</Button>
          <Button variant="seal" className="sketch-button" onClick={onCreate}><Plus /> 新建投递</Button>
        </div>
      </section>

      <section className="pipeline-summary">
        <div><span>本周新投递</span><b>{weeklyApplied}</b></div><ArrowRight />
        <div><span>当前面试流程</span><b>{currentInterviews}</b></div><ArrowRight />
        <div><span>拿到 Offer</span><b>{offers}</b></div>
        <p>面试转化率 <strong>{conversion === null ? "—" : `${conversion}%`}</strong><small>{entered ? `${reachedInterview} / ${entered} 条有效流程` : "有真实投递后自动计算"}</small></p>
      </section>

      {lastReview && <section className="review-strip"><RotateCcw /><span><b>{lastReview.weekKey} 复盘</b><small>{lastReview.nextChange || lastReview.bottleneck || lastReview.wins}</small></span><Button variant="ghost" size="sm" onClick={() => setReviewOpen(true)}>更新</Button></section>}

      <section className="kanban-board">
        {columns.map((column) => {
          const items = applications.filter((item) => column.accepts.includes(item.status));
          return (
            <div key={column.id} className="kanban-column" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              const id = event.dataTransfer.getData("application/id");
              if (id) onStatusChange(id, column.id);
            }}>
              <header><span className="kanban-dot" style={{ backgroundColor: statusConfig[column.id].color }} /><b>{column.label}</b><em>{items.length}</em></header>
              <div className="kanban-stack">
                {items.map((application) => (
                  <article key={application.id} className="kanban-ticket" draggable onDragStart={(event) => {
                    event.dataTransfer.setData("application/id", application.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}>
                    <div className="flex items-start gap-2"><GripVertical className="mt-0.5 size-4 text-faint" /><CompanyAvatar company={application.company} logoUrl={application.logo} className="pipeline-avatar" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><b className="truncate">{application.company}</b><Badge variant={application.tier === "A" ? "seal" : "soft"}>{application.tier}</Badge></div><p>{application.role}</p></div></div>
                    <div className="ticket-meta"><CalendarClock /><span>{application.nextAction || "未填写下一步"}</span><time>{formatDate(application.nextDate)}</time></div>
                    <select value={application.status} onChange={(event) => onStatusChange(application.id, event.target.value as ApplicationStatus)}>
                      {Object.entries(statusConfig).map(([id, option]) => <option key={id} value={id}>移动到：{option.short}</option>)}
                    </select>
                  </article>
                ))}
                {!items.length && <div className="kanban-empty"><CircleDashed /><span>可拖入岗位</span></div>}
              </div>
            </div>
          );
        })}
      </section>

      {applications.some((item) => item.status === "reject") && <div className="ended-strip"><span>已结束流程</span>{applications.filter((item) => item.status === "reject").map((item) => <Badge key={item.id} variant="soft">{item.company} · {item.role}</Badge>)}</div>}

      {!applications.length && <button className="empty-paper" onClick={onCreate}><CircleDashed /><b>流水线还没有真实记录</b><span>新增第一条岗位后即可开始跟踪。</span></button>}

      <ReviewDialog open={reviewOpen} state={state} onOpenChange={setReviewOpen} onSave={(next) => onStateChange(next, "本周复盘已保存")} />
    </div>
  );
}
