import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDot,
  ClipboardPen,
  Clock3,
  Flame,
  Goal,
  MapPin,
  MessageCircleQuestion,
  MoveUpRight,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { statusConfig, weeklyRhythm } from "@/data/config";
import { cn, formatDate, isApplicationClosed, shanghaiDateKey, uid, weekKey, weekNumber } from "@/lib/utils";
import type { Application, Page, WorkbenchState, WorkbenchTask } from "@/types";

function StatCard({ label, value, note, icon: Icon, accent }: {
  label: string;
  value: string | number;
  note: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card className={cn("stat-card", accent && "stat-card-accent")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold text-muted">{label}</span>
          <span className={cn("stat-icon", accent && "accent")}><Icon /></span>
        </div>
        <strong className="mt-4 block text-3xl font-black tracking-tight">{value}</strong>
        <span className="mt-1 block text-xs text-muted">{note}</span>
      </CardContent>
    </Card>
  );
}

function ApplicationCard({ application, onOpen }: { application: Application; onOpen: () => void }) {
  const status = statusConfig[application.status];
  return (
    <button className="priority-card text-left" onClick={onOpen}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <CompanyAvatar company={application.company} logoUrl={application.logo} />
            <h3>{application.company}</h3>
          </div>
          <p>{application.role}</p>
        </div>
        <Badge variant={application.tier === "A" ? "seal" : "outline"}>{application.tier} 级匹配</Badge>
      </div>
      <div className="my-4 flex flex-wrap gap-2">
        <Badge variant="soft">{application.track}</Badge>
        {application.location && <Badge variant="soft"><MapPin /> {application.location}</Badge>}
        <Badge className="border-transparent" style={{ backgroundColor: status.soft, color: status.color }}>
          {status.short}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-dashed border-faint pt-3 text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <Clock3 className="size-3.5" />
          {application.nextAction || "未填写下一步"} · {formatDate(application.nextDate)}
        </span>
        <MoveUpRight className="size-4" />
      </div>
    </button>
  );
}

function TaskDialog({ open, tasks, onOpenChange, onCreate, onToggle, onDelete }: {
  open: boolean;
  tasks: WorkbenchTask[];
  onOpenChange: (open: boolean) => void;
  onCreate: (task: WorkbenchTask) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [date, setDate] = useState(shanghaiDateKey());
  const [time, setTime] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDetail("");
    setDate(shanghaiDateKey());
    setTime("");
  }, [open]);

  const managedTasks = [...tasks]
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>安排推进任务</DialogTitle>
          <DialogDescription>任务会写入本地状态，到期后出现在“今天的作战清单”。</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onCreate({ id: uid("task"), title: title.trim(), detail: detail.trim(), date, time, done: false, createdAt: new Date().toISOString() });
          setTitle("");
          setDetail("");
          setTime("");
        }}>
          <label className="form-field"><span>任务 *</span><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="今天要推进什么？" /></label>
          <label className="form-field"><span>完成标准</span><Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="什么结果算完成" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-field"><span>日期</span><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="form-field"><span>时间</span><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          </div>
          <Button className="w-full" variant="seal" type="submit"><Plus /> 添加任务</Button>
        </form>
        <div className="dialog-list">
          <b>全部任务 · {managedTasks.length}</b>
          {managedTasks.length ? managedTasks.map((task) => (
            <div key={task.id}>
              <span><strong>{task.done ? `✓ ${task.title}` : task.title}</strong><small>{formatDate(task.date)} {task.time} · {task.done ? "已完成" : "待完成"}</small></span>
              <Button variant="outline" size="sm" onClick={() => onToggle(task.id)}>{task.done ? "恢复" : "完成"}</Button>
              <Button variant="ghost" size="icon" aria-label={`删除 ${task.title}`} onClick={() => onDelete(task.id)}><Trash2 /></Button>
            </div>
          )) : <p>还没有未来任务。</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Overview({ state, onStateChange, onNavigate, onCreate, onOpenApplication }: {
  state: WorkbenchState;
  onStateChange: (next: WorkbenchState, message?: string) => void;
  onNavigate: (page: Page) => void;
  onCreate: () => void;
  onOpenApplication: (application: Application) => void;
}) {
  const { applications, tasks } = state;
  const [taskOpen, setTaskOpen] = useState(false);
  const [note, setNote] = useState(state.note);
  const today = shanghaiDateKey();
  const currentWeek = weekKey();
  const rhythm = state.rhythm[currentWeek] || weeklyRhythm.map(() => false);
  const weekday = new Date(`${today}T12:00:00+08:00`).getDay();
  const currentRhythmIndex = weekday >= 1 && weekday <= 5 ? weekday - 1 : 5;

  useEffect(() => setNote(state.note), [state.note]);

  const todayTasks = useMemo(() => tasks
    .filter((task) => task.date === today)
    .sort((a, b) => a.time.localeCompare(b.time)), [tasks, today]);
  const doneCount = todayTasks.filter((task) => task.done).length;

  const stats = useMemo(() => {
    const applied = applications.filter((item) => item.status !== "watch").length;
    const interviews = applications.filter((item) => ["ai", "tech", "hr"].includes(item.status)).length;
    const followups = applications.filter((item) => item.nextDate && item.nextDate <= today && !["offer", "reject"].includes(item.status)).length;
    const offers = applications.filter((item) => item.status === "offer").length;
    return { applied, interviews, followups, offers };
  }, [applications, today]);

  const priorities = [...applications]
    .filter((item) => item.status !== "reject")
    .sort((a, b) => a.tier.localeCompare(b.tier) || (a.nextDate || "9999").localeCompare(b.nextDate || "9999"))
    .slice(0, 3);
  const closedApplications = applications.filter((item) => isApplicationClosed(item));
  const funnelStages = ["watch", "applied", "oa", "tech", "hr", "offer"] as const;
  const funnelCounts = funnelStages.map((stage) => applications.filter((item) => {
    if (stage === "watch") return item.status === "watch";
    if (stage === "applied") return !["watch", "reject"].includes(item.status);
    if (stage === "oa") return ["oa", "ai", "tech", "hr", "offer"].includes(item.status);
    if (stage === "tech") return ["ai", "tech", "hr", "offer"].includes(item.status);
    if (stage === "hr") return ["hr", "offer"].includes(item.status);
    return item.status === "offer";
  }).length);
  const funnelMax = Math.max(1, ...funnelCounts);
  const datedLabel = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit" }).format(new Date());

  const save = (partial: Partial<WorkbenchState>, message?: string) => onStateChange({ ...state, ...partial }, message);

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="hero-copy">
          <Badge variant="seal" className="rotate-[-1deg]">第 {weekNumber()} 周 · 秋招推进中</Badge>
          <h1>把每一次机会，<span>变成明确的下一步。</span></h1>
          <p>发现岗位、证据匹配、人工投递、面试复盘——数据为空时不造数，所有进展由你真实记录。</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="seal" size="lg" className="sketch-button" onClick={onCreate}><Send /> 新建一条投递</Button>
            <Button variant="outline" size="lg" className="sketch-button" onClick={() => setTaskOpen(true)}><Plus /> 安排今天任务</Button>
          </div>
        </div>
        <div className="hero-doodle" aria-hidden="true">
          <div className="target-rings"><span /><span /><span /><Target /></div>
          <p>求职方向</p><strong>AI 应用 / Agent</strong><small>真实经历 · 可验证价值</small>
        </div>
      </section>

      {closedApplications.length > 0 && (
        <button className="closed-alert" onClick={() => onNavigate("opportunities")}>
          <span className="closed-alert-icon"><AlertTriangle /></span>
          <span className="min-w-0 flex-1 text-left"><b>网申结束数据告警 · {closedApplications.length} 条</b><small>{closedApplications.slice(0, 2).map((item) => item.company).join("、")} 已过截止日期或官网标记下线，请完成归档。</small></span>
          <span className="closed-alert-action">查看告警 <ArrowRight /></span>
        </button>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="有效投递" value={stats.applied} note={`机会池共 ${applications.length} 条`} icon={Send} accent />
        <StatCard label="到期行动" value={stats.followups} note={stats.followups ? "今天需要处理" : "当前没有逾期动作"} icon={CalendarClock} />
        <StatCard label="面试进行中" value={stats.interviews} note="来自真实投递状态" icon={MessageCircleQuestion} />
        <StatCard label="Offer / 转化" value={stats.offers || "—"} note={stats.applied ? `投递转化 ${Math.round((stats.offers / stats.applied) * 100)}%` : "投递后自动计算"} icon={TrendingUp} />
      </section>

      <section className="dashboard-grid">
        <Card className="today-card">
          <CardHeader className="flex-row items-center justify-between border-b border-dashed border-faint">
            <div><p className="section-kicker">TODAY · {datedLabel}</p><CardTitle className="text-xl">今天的作战清单</CardTitle></div>
            <Badge variant="soft">{doneCount} / {todayTasks.length} 完成</Badge>
          </CardHeader>
          <CardContent className="p-5">
            {todayTasks.length ? <div className="action-timeline">
              {todayTasks.map((task) => (
                <button key={task.id} className={cn("action-item", task.done && "done")} onClick={() => save({ tasks: tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item) }, task.done ? "任务已恢复" : "任务已完成") }>
                  <span className="action-check">{task.done ? <Check /> : <CircleDot />}</span>
                  <span className="min-w-0 flex-1 text-left"><b>{task.title}</b><small>{task.detail || "点击标记完成"}</small></span>
                  <time>{task.time || "今天"}</time>
                </button>
              ))}
            </div> : <button className="inline-empty" onClick={() => setTaskOpen(true)}><ClipboardPen /><b>今天还没有安排任务</b><span>新增一项真实、可完成的推进动作</span></button>}
            <div className="mt-5 rounded-xl bg-wash p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-bold"><span>今日推进度</span><span>{todayTasks.length ? Math.round((doneCount / todayTasks.length) * 100) : 0}%</span></div>
              <Progress value={todayTasks.length ? (doneCount / todayTasks.length) * 100 : 0} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-dashed border-faint">
            <div className="flex items-center justify-between"><div><p className="section-kicker">PIPELINE</p><CardTitle className="text-xl">投递漏斗</CardTitle></div><Button variant="ghost" size="sm" onClick={() => onNavigate("pipeline")}>详情 <ChevronRight /></Button></div>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {funnelStages.map((stage, index) => {
              const config = statusConfig[stage];
              const count = funnelCounts[index];
              return <div key={stage} className="funnel-row"><span>{config.short}</span><div className="funnel-track"><i style={{ width: `${count ? Math.max(10, (count / funnelMax) * 100) : 0}%`, backgroundColor: config.color }} /></div><b>{count}</b></div>;
            })}
            <div className="funnel-note"><Flame /><span><b>{applications.length ? "漏斗按真实状态计算" : "等待第一条真实投递"}</b><small>{applications.length ? "进入流水线记录复盘与下一步" : "新增岗位后，这里会显示各阶段转化"}</small></span></div>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="section-heading"><div><p className="section-kicker">FOCUS NOW</p><h2>优先推进</h2></div><Button variant="ghost" onClick={() => onNavigate("opportunities")}>查看全部 <ArrowRight /></Button></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {priorities.length ? priorities.map((application) => <ApplicationCard key={application.id} application={application} onOpen={() => onOpenApplication(application)} />) : (
            <button className="empty-paper lg:col-span-3" onClick={onCreate}><Sparkles /><b>机会池还是空的</b><span>从公司官网、内推或可信招聘渠道录入第一条真实岗位</span></button>
          )}
        </div>
      </section>

      <section>
        <div className="section-heading"><div><p className="section-kicker">WEEKLY RHYTHM</p><h2>本周推进节奏</h2></div><Badge variant="outline"><Goal /> 第 {weekNumber()} 周 · {rhythm.filter(Boolean).length}/6</Badge></div>
        <div className="rhythm-strip">
          {weeklyRhythm.map((item, index) => (
            <button key={item.day} className={cn(index === currentRhythmIndex && "current", rhythm[index] && "done")} onClick={() => save({ rhythm: { ...state.rhythm, [currentWeek]: rhythm.map((value, itemIndex) => itemIndex === index ? !value : value) } }, rhythm[index] ? "已取消本周节点" : "本周节点已完成") }>
              <span>{rhythm[index] ? <Check /> : item.day}</span><b>{item.title}</b><small>{item.note}</small>
            </button>
          ))}
        </div>
      </section>

      <Card className="strategy-note-card">
        <CardHeader><p className="section-kicker">PERSONAL NOTE</p><CardTitle className="text-xl">本周作战备注</CardTitle></CardHeader>
        <CardContent>
          <textarea className="form-textarea" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录本周只想验证的一件事、需要回避的风险或下一步…" />
          <div className="mt-3 flex justify-end"><Button variant="outline" onClick={() => save({ note }, "作战备注已保存")}>保存备注</Button></div>
        </CardContent>
      </Card>

      <TaskDialog open={taskOpen} tasks={tasks} onOpenChange={setTaskOpen} onCreate={(task) => save({ tasks: [...tasks, task] }, "任务已加入作战清单")} onToggle={(id) => save({ tasks: tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task) }, "任务状态已更新")} onDelete={(id) => save({ tasks: tasks.filter((task) => task.id !== id) }, "任务已删除")} />
    </div>
  );
}
