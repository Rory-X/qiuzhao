import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { resumeOptions, sourceOptions, statusConfig, trackOptions } from "@/data/config";
import { shanghaiDateKey, uid } from "@/lib/utils";
import type { Application, ApplicationStatus, Tier } from "@/types";

type FormState = {
  company: string;
  role: string;
  tier: Tier;
  track: string;
  status: ApplicationStatus;
  source: string;
  verify: Application["verify"];
  resume: string;
  nextAction: string;
  nextDate: string;
  location: string;
  deadline: string;
  score: string;
  appliedAt: string;
  url: string;
  note: string;
};

function emptyForm(): FormState {
  return {
    company: "",
    role: "",
    tier: "A",
    track: "AI应用",
    status: "watch",
    source: "公司官网",
    verify: "pending",
    resume: "待选择",
    nextAction: "",
    nextDate: shanghaiDateKey(),
    location: "",
    deadline: "",
    score: "",
    appliedAt: "",
    url: "",
    note: "",
  };
}

function formFromApplication(application: Application): FormState {
  return {
    company: application.company,
    role: application.role,
    tier: application.tier,
    track: application.track,
    status: application.status,
    source: application.source,
    verify: application.verify,
    resume: application.resume,
    nextAction: application.nextAction,
    nextDate: application.nextDate,
    location: application.location || "",
    deadline: application.deadline || "",
    score: application.score === undefined ? "" : String(application.score),
    appliedAt: application.appliedAt || "",
    url: application.url || "",
    note: application.note || "",
  };
}

function formFromDraft(draft: Partial<Application>): FormState {
  const base = emptyForm();
  return {
    ...base,
    company: draft.company || base.company,
    role: draft.role || base.role,
    tier: draft.tier || base.tier,
    track: draft.track || base.track,
    status: draft.status || base.status,
    source: draft.source || base.source,
    verify: draft.verify || base.verify,
    resume: draft.resume || base.resume,
    nextAction: draft.nextAction ?? base.nextAction,
    nextDate: draft.nextDate || base.nextDate,
    location: draft.location || "",
    deadline: draft.deadline || "",
    score: draft.score === undefined ? "" : String(draft.score),
    appliedAt: draft.appliedAt || "",
    url: draft.url || "",
    note: draft.note || "",
  };
}

export function AddApplicationDialog({
  open,
  application,
  draft,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean;
  application?: Application | null;
  draft?: Partial<Application> | null;
  onOpenChange: (open: boolean) => void;
  onSave: (application: Application) => void;
  onDelete?: (id: string) => void;
}) {
  const editing = Boolean(application);
  const initial = useMemo(
    () => application ? formFromApplication(application) : draft ? formFromDraft(draft) : emptyForm(),
    [application, draft],
  );
  const [form, setForm] = useState<FormState>(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [initial, open]);

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  const remove = () => {
    if (!application || !onDelete) return;
    if (!window.confirm(`确定删除「${application.company} · ${application.role}」吗？此操作无法撤销。`)) return;
    onDelete(application.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-full bg-seal text-white">
            <BriefcaseBusiness className="size-5" />
          </div>
          <DialogTitle>{editing ? "编辑投递记录" : "收下一条新机会"}</DialogTitle>
          <DialogDescription>
            只记录真实信息。不确定的字段可以留空，后续核验后再补。
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.company.trim() || !form.role.trim()) return;
            const parsedScore = form.score === "" ? undefined : Math.max(0, Math.min(100, Number(form.score)));
            onSave({
              id: application?.id || uid("application"),
              company: form.company.trim(),
              role: form.role.trim(),
              tier: form.tier,
              track: form.track,
              status: form.status,
              source: form.source,
              verify: form.verify,
              resume: form.resume,
              nextAction: form.nextAction.trim(),
              nextDate: form.nextDate,
              location: form.location.trim() || undefined,
              deadline: form.deadline || undefined,
              score: Number.isFinite(parsedScore) ? parsedScore : undefined,
              appliedAt: form.appliedAt || undefined,
              url: form.url.trim() || undefined,
              note: form.note.trim() || undefined,
              logo: application?.logo || draft?.logo || undefined,
            });
            onOpenChange(false);
          }}
        >
          <label className="form-field">
            <span>公司 *</span>
            <Input required placeholder="公司全称或常用名" {...field("company")} />
          </label>
          <label className="form-field">
            <span>岗位 *</span>
            <Input required placeholder="岗位名称" {...field("role")} />
          </label>
          <label className="form-field">
            <span>匹配等级</span>
            <select {...field("tier")}>
              <option value="A">A · 优先推进</option>
              <option value="B">B · 可以尝试</option>
              <option value="C">C · 暂存观察</option>
            </select>
          </label>
          <label className="form-field">
            <span>匹配分（可选）</span>
            <Input type="number" min="0" max="100" placeholder="0–100" {...field("score")} />
          </label>
          <label className="form-field">
            <span>岗位方向</span>
            <select {...field("track")}>
              {trackOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>当前状态</span>
            <select {...field("status")}>
              {Object.entries(statusConfig).map(([value, option]) => (
                <option key={value} value={value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>信息来源</span>
            <Input list="application-source-options" placeholder="官网、内推人或平台" {...field("source")} />
          </label>
          <label className="form-field">
            <span>官网核验</span>
            <select {...field("verify")}>
              <option value="pending">等待核验</option>
              <option value="verified">官网已核验</option>
              <option value="offline">官网下线</option>
            </select>
          </label>
          <label className="form-field">
            <span>简历版本</span>
            <Input list="application-resume-options" placeholder="文件名或版本号" {...field("resume")} />
          </label>
          <label className="form-field">
            <span>工作地点</span>
            <Input placeholder="城市 / 远程" {...field("location")} />
          </label>
          <label className="form-field">
            <span>投递日期</span>
            <Input type="date" {...field("appliedAt")} />
          </label>
          <label className="form-field">
            <span>截止日期</span>
            <Input type="date" {...field("deadline")} />
          </label>
          <label className="form-field">
            <span>下一步日期</span>
            <Input type="date" {...field("nextDate")} />
          </label>
          <label className="form-field">
            <span>下一步行动</span>
            <Input placeholder="例如：核验官网 JD" {...field("nextAction")} />
          </label>
          <label className="form-field sm:col-span-2">
            <span>岗位链接</span>
            <div className="relative">
              <ExternalLink className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input className="pl-9" type="url" placeholder="https://…" {...field("url")} />
            </div>
          </label>
          <label className="form-field sm:col-span-2">
            <span>备注</span>
            <textarea className="form-textarea" rows={3} placeholder="联系人、面试信息、需要核验的事项…" {...field("note")} />
          </label>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            {editing ? (
              <Button type="button" variant="ghost" className="text-seal" onClick={remove}>
                <Trash2 /> 删除记录
              </Button>
            ) : <p className="text-xs text-muted">新记录默认保存在本地 data/state.json。</p>}
            <Button type="submit" variant="seal" className="ml-auto sketch-button">
              {editing ? "保存修改" : "加入工作台"}
              <ArrowRight />
            </Button>
          </div>
          <datalist id="application-source-options">{sourceOptions.map((option) => <option key={option} value={option} />)}</datalist>
          <datalist id="application-resume-options">{resumeOptions.map((option) => <option key={option} value={option} />)}</datalist>
        </form>
      </DialogContent>
    </Dialog>
  );
}
