import { useEffect, useMemo, useState } from "react";
import { BookOpenText, BriefcaseBusiness, CornerDownLeft, FileQuestion, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { navigation } from "@/components/Sidebar";
import { interviewExperienceSections } from "@/data/interviewExperience";
import type { Application, Meta, Page } from "@/types";

type DocHit = { doc: string; title: string; line: number; text: string };

export function CommandPalette({ open, applications, meta, onOpenChange, onNavigate }: {
  open: boolean;
  applications: Application[];
  meta: Meta | null;
  onOpenChange: (open: boolean) => void;
  onNavigate: (page: Page, search?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [docHits, setDocHits] = useState<DocHit[]>([]);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setDocHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(normalized)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : { hits: [] })
        .then((payload: { hits?: DocHit[] }) => setDocHits((payload.hits || []).slice(0, 5)))
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) setDocHits([]);
        });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  const applicationHits = useMemo(() => normalized ? applications.filter((item) => `${item.company} ${item.role} ${item.track} ${item.note || ""}`.toLocaleLowerCase("zh-CN").includes(normalized)).slice(0, 6) : [], [applications, normalized]);
  const questionHits = useMemo(() => normalized ? interviewExperienceSections.flatMap((section) => section.questions).filter((question) => question.toLocaleLowerCase("zh-CN").includes(normalized)).slice(0, 6) : [], [normalized]);
  const metadataHits = useMemo(() => normalized ? (meta?.docs || []).filter((doc) => `${doc.title} ${doc.blurb}`.toLocaleLowerCase("zh-CN").includes(normalized)) : [], [meta, normalized]);
  const hasResults = applicationHits.length + questionHits.length + docHits.length + metadataHits.length > 0;

  const go = (page: Page, search = "") => {
    onNavigate(page, search);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="command-palette max-w-2xl">
        <DialogHeader><DialogTitle>搜索工作台</DialogTitle><DialogDescription>查岗位、材料、真实面经，或直接跳转页面。</DialogDescription></DialogHeader>
        <div className="command-input"><Search /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入公司、问题或材料关键词…" /></div>

        {!normalized ? (
          <div className="command-section"><p>页面入口</p>{navigation.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => go(item.id)}><Icon /><span><b>{item.label}</b><small>打开页面</small></span><CornerDownLeft /></button>; })}</div>
        ) : (
          <div className="command-results">
            {applicationHits.length > 0 && <div className="command-section"><p>投递记录</p>{applicationHits.map((item) => <button key={item.id} onClick={() => go("opportunities", `?q=${encodeURIComponent(item.company)}`)}><BriefcaseBusiness /><span><b>{item.company} · {item.role}</b><small>{item.track}</small></span><CornerDownLeft /></button>)}</div>}
            {questionHits.length > 0 && <div className="command-section"><p>真实面经</p>{questionHits.map((question) => <button key={question} onClick={() => go("experience", `?q=${encodeURIComponent(question)}`)}><FileQuestion /><span><b>{question}</b><small>展开题库搜索结果</small></span><CornerDownLeft /></button>)}</div>}
            {(metadataHits.length > 0 || docHits.length > 0) && <div className="command-section"><p>本地材料</p>{metadataHits.map((doc) => <button key={`meta-${doc.id}`} onClick={() => go("materials", `?doc=${doc.id}`)}><BookOpenText /><span><b>{doc.title}</b><small>{doc.blurb}</small></span><CornerDownLeft /></button>)}{docHits.map((hit) => <button key={`${hit.doc}-${hit.line}`} onClick={() => go("materials", `?doc=${hit.doc}`)}><BookOpenText /><span><b>{hit.title} · 第 {hit.line} 行</b><small>{hit.text}</small></span><CornerDownLeft /></button>)}</div>}
            {!hasResults && <div className="command-empty"><Search /><b>没有匹配内容</b><span>换一个更短的关键词试试。</span></div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
