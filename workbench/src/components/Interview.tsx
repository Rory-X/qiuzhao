import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  Clock3,
  Code2,
  Mic2,
  Play,
  Plus,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { formatDateTime, shanghaiDateTimeLocal, uid } from "@/lib/utils";
import type { Application, InterviewSession, WorkbenchState } from "@/types";

const questionBank = [
  "介绍一下你的 AI 项目架构情况？",
  "AI 调用工具失败了怎么解决？",
  "怎么确认 RAG 召回的数据准确性？",
  "单个 Agent 可以分配多个职能，为什么还需要多 Agent？",
  "SSE 断线后如何续传？",
];

const scoreMeta = [
  { key: "project" as const, icon: BrainCircuit, title: "项目深挖", note: "决定、失败、取舍与证据" },
  { key: "system" as const, icon: Code2, title: "系统设计", note: "状态、工具、评测与生产边界" },
  { key: "communication" as const, icon: Mic2, title: "结构表达", note: "结论优先，用证据展开" },
];

function ScheduleDialog({ open, applications, sessions, onOpenChange, onSave, onDelete, onStart }: {
  open: boolean;
  applications: Application[];
  sessions: InterviewSession[];
  onOpenChange: (open: boolean) => void;
  onSave: (session: InterviewSession) => void;
  onDelete: (id: string) => void;
  onStart: (session: InterviewSession) => void;
}) {
  const [title, setTitle] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState("45");
  const [focus, setFocus] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setApplicationId("");
    setScheduledAt(shanghaiDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
    setDuration("45");
    setFocus("");
  }, [open]);

  const planned = [...sessions].filter((session) => session.status === "planned").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>训练计划</DialogTitle><DialogDescription>安排真实训练时间；完成后会进入复盘和能力统计。</DialogDescription></DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim() || !scheduledAt) return;
          onSave({ id: uid("interview"), applicationId: applicationId || undefined, title: title.trim(), scheduledAt, durationMinutes: Math.max(5, Number(duration) || 45), focus: focus.trim(), status: "planned", notes: "", strengths: "", gaps: "" });
          setTitle(""); setFocus("");
        }}>
          <label className="form-field sm:col-span-2"><span>训练主题 *</span><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：项目深挖模拟" /></label>
          <label className="form-field"><span>关联岗位</span><select value={applicationId} onChange={(e) => setApplicationId(e.target.value)}><option value="">不关联岗位</option>{applications.map((item) => <option key={item.id} value={item.id}>{item.company} · {item.role}</option>)}</select></label>
          <label className="form-field"><span>训练时长</span><select value={duration} onChange={(e) => setDuration(e.target.value)}><option value="20">20 分钟</option><option value="30">30 分钟</option><option value="45">45 分钟</option><option value="60">60 分钟</option></select></label>
          <label className="form-field"><span>开始时间 *</span><Input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label>
          <label className="form-field"><span>训练重点</span><Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="本轮只补强什么？" /></label>
          <Button type="submit" variant="seal" className="sm:col-span-2"><Plus /> 添加训练计划</Button>
        </form>
        <div className="dialog-list">
          <b>待训练 · {planned.length}</b>
          {planned.length ? planned.map((session) => (
            <div key={session.id}>
              <span><strong>{session.title}</strong><small>{formatDateTime(session.scheduledAt)} · {session.durationMinutes} 分钟</small></span>
              <Button variant="outline" size="sm" onClick={() => onStart(session)}><Play /> 开始</Button>
              <Button variant="ghost" size="icon" aria-label={`删除 ${session.title}`} onClick={() => onDelete(session.id)}><Trash2 /></Button>
            </div>
          )) : <p>还没有安排训练。</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PracticeDialog({ open, session, initialQuestion, onOpenChange, onComplete }: {
  open: boolean;
  session: InterviewSession | null;
  initialQuestion: string;
  onOpenChange: (open: boolean) => void;
  onComplete: (session: InterviewSession) => void;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [notes, setNotes] = useState("");
  const [strengths, setStrengths] = useState("");
  const [gaps, setGaps] = useState("");
  const [project, setProject] = useState("");
  const [system, setSystem] = useState("");
  const [communication, setCommunication] = useState("");
  const [startedAt, setStartedAt] = useState(Date.now());

  useEffect(() => {
    if (!open) return;
    setQuestion(session?.question || initialQuestion || questionBank[0]);
    setNotes(session?.notes || "");
    setStrengths(session?.strengths || "");
    setGaps(session?.gaps || "");
    setProject(session?.scores ? String(session.scores.project) : "");
    setSystem(session?.scores ? String(session.scores.system) : "");
    setCommunication(session?.scores ? String(session.scores.communication) : "");
    setStartedAt(Date.now());
  }, [initialQuestion, open, session]);

  const clamp = (value: string) => Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{session?.title || "单题自练"}</DialogTitle><DialogDescription>先口述，再记录要点。这里不伪装 AI 语音，只保存你真实完成的训练证据。</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          const now = new Date();
          onComplete({
            ...(session || { id: uid("interview"), title: "单题自练", scheduledAt: shanghaiDateTimeLocal(now), focus: question, notes: "", strengths: "", gaps: "" }),
            question,
            status: "completed",
            durationMinutes: session?.durationMinutes || Math.max(1, Math.round((Date.now() - startedAt) / 60000)),
            notes: notes.trim(), strengths: strengths.trim(), gaps: gaps.trim(),
            scores: { project: clamp(project), system: clamp(system), communication: clamp(communication) },
            completedAt: now.toISOString(),
          });
          onOpenChange(false);
        }}>
          <label className="form-field"><span>本轮问题</span><select value={question} onChange={(e) => setQuestion(e.target.value)}>{questionBank.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="form-field"><span>回答提纲 / 证据</span><textarea className="form-textarea" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="结论、场景、你的动作、结果与取舍…" /></label>
          <div className="grid grid-cols-3 gap-3">
            <label className="form-field"><span>项目深挖 *</span><Input required type="number" min="0" max="100" value={project} onChange={(e) => setProject(e.target.value)} /></label>
            <label className="form-field"><span>系统设计 *</span><Input required type="number" min="0" max="100" value={system} onChange={(e) => setSystem(e.target.value)} /></label>
            <label className="form-field"><span>结构表达 *</span><Input required type="number" min="0" max="100" value={communication} onChange={(e) => setCommunication(e.target.value)} /></label>
          </div>
          <label className="form-field"><span>这次讲清楚了什么</span><Input value={strengths} onChange={(e) => setStrengths(e.target.value)} /></label>
          <label className="form-field"><span>下一次只补强什么</span><Input value={gaps} onChange={(e) => setGaps(e.target.value)} /></label>
          <Button type="submit" variant="seal" className="w-full"><BookOpenCheck /> 完成并写入复盘</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Interview({ state, onStateChange }: {
  state: WorkbenchState;
  onStateChange: (next: WorkbenchState, message?: string) => void;
}) {
  const { applications, interviewSessions } = state;
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null);
  const [activeQuestion, setActiveQuestion] = useState(questionBank[0]);
  const planned = [...interviewSessions].filter((item) => item.status === "planned").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const next = planned[0];
  const nextApplication = applications.find((item) => item.id === next?.applicationId);
  const completed = [...interviewSessions].filter((item) => item.status === "completed").sort((a, b) => (b.completedAt || b.scheduledAt).localeCompare(a.completedAt || a.scheduledAt));
  const last = completed[0];

  const scores = useMemo(() => Object.fromEntries(scoreMeta.map((meta) => {
    const values = completed.map((item) => item.scores?.[meta.key]).filter((value): value is number => typeof value === "number");
    return [meta.key, values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null];
  })) as Record<"project" | "system" | "communication", number | null>, [completed]);

  const saveSessions = (sessions: InterviewSession[], message: string) => onStateChange({ ...state, interviewSessions: sessions }, message);
  const start = (session: InterviewSession | null, question = questionBank[0]) => {
    setActiveSession(session); setActiveQuestion(question); setScheduleOpen(false); setPracticeOpen(true);
  };

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><p className="section-kicker">INTERVIEW LAB</p><h1>面试训练室</h1><p>安排训练、完成一题、写下证据和复盘；只展示真实完成的数据。</p></div>
        <Button variant="seal" className="sketch-button" onClick={() => start(next || null, next?.question || questionBank[0])}><Play /> {next ? "开始下一场训练" : "开始单题自练"}</Button>
      </section>

      <section className="interview-hero">
        <div className="interview-orbit" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" />{nextApplication ? <CompanyAvatar company={nextApplication.company} logoUrl={nextApplication.logo} className="interview-company-avatar" /> : <Bot />}</div>
        <div className="min-w-0 flex-1">
          <Badge variant="seal">{next ? "NEXT SESSION" : "NO SESSION YET"}</Badge>
          <h2>{next ? nextApplication ? `${nextApplication.company} · ${next.title}` : next.title : "还没有安排训练"}</h2>
          <p>{next ? next.focus || "训练重点待补充" : "安排一次训练，时间、岗位和复盘都会保存在本地。"}</p>
          {next && <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold"><span><CalendarDays /> {formatDateTime(next.scheduledAt)}</span><span><Clock3 /> {next.durationMinutes} 分钟</span><span><BookOpenCheck /> 本地记录</span></div>}
        </div>
        <Button variant="outline" className="sketch-button" onClick={() => setScheduleOpen(true)}>管理训练计划 <ArrowRight /></Button>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="border-b border-dashed border-faint"><p className="section-kicker">SKILL RADAR</p><CardTitle className="text-xl">真实训练均分</CardTitle></CardHeader>
          <CardContent className="space-y-5 p-5">
            {scoreMeta.map((module) => { const Icon = module.icon; const score = scores[module.key]; return (
              <div key={module.title} className="practice-row"><span className="practice-icon"><Icon /></span><div className="min-w-0 flex-1"><div className="mb-1.5 flex items-center justify-between gap-3"><b>{module.title}</b><span>{score === null ? "未训练" : `${score}%`}</span></div><Progress value={score || 0} /><small>{module.note}</small></div><ChevronRight /></div>
            ); })}
          </CardContent>
        </Card>

        <Card className="mistake-card">
          <CardHeader><div className="flex items-center justify-between"><div><p className="section-kicker">LAST DEBRIEF</p><CardTitle className="text-xl">上一轮复盘</CardTitle></div><BookOpenCheck className="size-6 text-seal" /></div></CardHeader>
          <CardContent>
            {last ? <><blockquote>“{last.gaps || last.notes || "这轮已完成，继续补充复盘。"}”</blockquote><div className="debrief-grid"><span><b>讲清楚</b><em>{last.strengths || "待补充"}</em></span><span><b>需补强</b><em>{last.gaps || "待补充"}</em></span></div><Button variant="outline" className="mt-5 w-full sketch-button" onClick={() => start(last, last.question)}>继续这道题 <ArrowRight /></Button></> : <button className="inline-empty" onClick={() => start(null)}><Sparkles /><b>还没有训练复盘</b><span>完成第一道题后，这里才会出现真实结果。</span></button>}
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="section-heading"><div><p className="section-kicker">REAL QUESTION BANK</p><h2>来自真实面经的追问卡</h2></div><Badge variant="outline"><Target /> {questionBank.length} 道可练</Badge></div>
        <div className="question-grid">
          {questionBank.map((question, index) => <button key={question} onClick={() => start(null, question)}><span>{String(index + 1).padStart(2, "0")}</span><b>{question}</b><Sparkles /></button>)}
        </div>
      </section>

      <ScheduleDialog open={scheduleOpen} applications={applications} sessions={interviewSessions} onOpenChange={setScheduleOpen} onSave={(session) => saveSessions([...interviewSessions, session], "训练计划已保存")} onDelete={(id) => saveSessions(interviewSessions.filter((item) => item.id !== id), "训练计划已删除")} onStart={(session) => start(session, session.question || questionBank[0])} />
      <PracticeDialog open={practiceOpen} session={activeSession} initialQuestion={activeQuestion} onOpenChange={setPracticeOpen} onComplete={(session) => saveSessions(interviewSessions.some((item) => item.id === session.id) ? interviewSessions.map((item) => item.id === session.id ? session : item) : [...interviewSessions, session], "训练复盘已保存")} />
    </div>
  );
}
