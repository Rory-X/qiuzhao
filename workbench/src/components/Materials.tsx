import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BookCopy,
  BookOpenText,
  Boxes,
  CalendarClock,
  Check,
  ClipboardCheck,
  FileQuestion,
  FolderOpen,
  ListTree,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Meta, WorkbenchState } from "@/types";

const docIcons = [BookOpenText, FileQuestion, Boxes, BookCopy];

interface DocumentDetail {
  id: string;
  title: string;
  file: string;
  blurb: string;
  markdown: string;
  headings: Array<{ depth: number; text: string; line: number }>;
  mtime: string;
}

function MaterialReader({ docId, onBack }: { docId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setError("");
    fetch(`/api/docs/${docId}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<DocumentDetail>;
      })
      .then(setDetail)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "材料读取失败");
      });
    return () => controller.abort();
  }, [docId]);

  if (error) {
    return (
      <div className="material-reader-state">
        <FileQuestion />
        <b>材料没有读出来</b>
        <p>{error}</p>
        <Button variant="outline" onClick={onBack}><ArrowLeft /> 返回材料库</Button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="material-reader-state">
        <LoaderCircle className="animate-spin" />
        <b>正在铺开材料…</b>
      </div>
    );
  }

  const scrollToHeading = (index: number) => {
    const headings = document.querySelectorAll(".material-prose h1, .material-prose h2, .material-prose h3");
    headings[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="material-reader">
      <header className="material-reader-top">
        <Button variant="ghost" onClick={onBack}><ArrowLeft /> 返回材料库</Button>
        <div className="min-w-0 flex-1">
          <p className="section-kicker">BATTLE NOTES · LOCAL MARKDOWN</p>
          <h1>{detail.title}</h1>
          <span>{detail.blurb}</span>
        </div>
        <div className="material-meta">
          <Badge variant="success"><ShieldCheck /> 本地材料</Badge>
          <small><CalendarClock /> 更新于 {new Date(detail.mtime).toLocaleDateString("zh-CN")}</small>
        </div>
      </header>

      <div className="material-layout">
        <aside className="material-toc">
          <div className="material-toc-title"><ListTree /> 文档目录</div>
          <nav>
            {detail.headings.map((heading, index) => (
              <button
                key={`${heading.line}-${heading.text}`}
                className={`depth-${heading.depth}`}
                onClick={() => scrollToHeading(index)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {heading.text}
              </button>
            ))}
          </nav>
        </aside>

        <article className="material-prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ children, href }) => (
                <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                  {children}
                </a>
              ),
              input: ({ type, checked, ...props }) => (
                <input type={type} checked={checked} readOnly {...props} />
              ),
            }}
          >
            {detail.markdown}
          </ReactMarkdown>
        </article>

        <aside className="material-reading-note">
          <Badge variant="seal">阅读原则</Badge>
          <p>不要背形容词，优先标出能被代码、数据或具体决定证明的内容。</p>
          <div>
            <b>{detail.headings.length}</b>
            <span>个章节锚点</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function Materials({ meta, state, initialDocId, onStateChange }: {
  meta: Meta | null;
  state: WorkbenchState;
  initialDocId?: string;
  onStateChange: (next: WorkbenchState, message?: string) => void;
}) {
  const [selectedDoc, setSelectedDoc] = useState<string | null>(initialDocId || null);
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>(null);

  useEffect(() => {
    if (initialDocId) setSelectedDoc(initialDocId);
  }, [initialDocId]);
  const checklistStats = useMemo(() => {
    if (!meta) return [];
    return Object.entries(meta.checklists).map(([id, pack]) => {
      const values = state.checklists[id] || [];
      const done = values.filter(Boolean).length;
      return { id, ...pack, done, total: pack.items.length };
    });
  }, [meta, state.checklists]);

  if (selectedDoc) {
    return <MaterialReader docId={selectedDoc} onBack={() => setSelectedDoc(null)} />;
  }

  const openWorkspace = async () => {
    try {
      const response = await fetch("/api/workspace/open", { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      toast.success("已在文件管理器中打开工作区");
    } catch (error) {
      toast.error("工作区打开失败", { description: error instanceof Error ? error.message : "未知错误" });
    }
  };

  const checklist = selectedChecklist ? meta?.checklists[selectedChecklist] : undefined;
  const checklistValues = selectedChecklist ? state.checklists[selectedChecklist] || [] : [];

  const toggleChecklist = (id: string, index: number) => {
    const pack = meta?.checklists[id];
    if (!pack) return;
    const current = state.checklists[id] || pack.items.map(() => false);
    onStateChange({
      ...state,
      checklists: {
        ...state.checklists,
        [id]: current.map((value, itemIndex) => itemIndex === index ? !value : value),
      },
    }, current[index] ? "检查项已恢复" : "检查项已完成");
  };

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <p className="section-kicker">KNOWLEDGE BASE</p>
          <h1>材料与清单</h1>
          <p>所有结论回到真实材料：手册、项目证据、问答题库和投递前检查。</p>
        </div>
        <Button variant="outline" className="sketch-button" onClick={openWorkspace}>
          <FolderOpen /> 打开工作区
        </Button>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <p className="section-kicker">LOCAL DOCUMENTS</p>
            <h2>作战材料</h2>
          </div>
          <Badge variant="success"><ShieldCheck /> 本地保存</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(meta?.docs || []).map((doc, index) => {
            const Icon = docIcons[index % docIcons.length];
            return (
              <Card key={doc.id} className="material-card">
                <CardHeader>
                  <span className="material-icon"><Icon /></span>
                  <CardTitle>{doc.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{doc.blurb}</p>
                  <button onClick={() => setSelectedDoc(doc.id)}>
                    阅读作战材料 <ArrowRight />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <p className="section-kicker">PRE-FLIGHT CHECK</p>
            <h2>投递与面试检查单</h2>
          </div>
          <Badge variant="outline"><ClipboardCheck /> {checklistStats.length} 组清单</Badge>
        </div>
        <div className="checklist-grid">
          {checklistStats.map((pack) => {
            const value = pack.total ? (pack.done / pack.total) * 100 : 0;
            return (
              <Card key={pack.id}>
                <CardHeader className="flex-row items-start justify-between">
                  <div>
                    <CardTitle>{pack.title}</CardTitle>
                    <p className="mt-1 text-xs text-muted">{pack.source}</p>
                  </div>
                  <span className="checklist-count">{pack.done}/{pack.total}</span>
                </CardHeader>
                <CardContent>
                  <Progress value={value} />
                  <div className="mt-4 space-y-2">
                    {pack.items.slice(0, 3).map((item, index) => (
                      <button
                        key={item}
                        type="button"
                        className={cn("checklist-line", state.checklists[pack.id]?.[index] && "done")}
                        aria-pressed={Boolean(state.checklists[pack.id]?.[index])}
                        onClick={() => toggleChecklist(pack.id, index)}
                      >
                        <span className="checklist-control" aria-hidden="true">
                          {state.checklists[pack.id]?.[index] && <Check />}
                        </span>
                        <p>{item}</p>
                      </button>
                    ))}
                  </div>
                  <Button variant="ghost" className="mt-3 w-full" onClick={() => setSelectedChecklist(pack.id)}>查看全部 {pack.total} 项</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Dialog open={Boolean(selectedChecklist)} onOpenChange={(open) => !open && setSelectedChecklist(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{checklist?.title || "检查单"}</DialogTitle>
            <DialogDescription>{checklist?.source} · 逐项确认后会立即保存。</DialogDescription>
          </DialogHeader>
          <div className="checklist-dialog-list">
            {(checklist?.items || []).map((item, index) => {
              const done = Boolean(checklistValues[index]);
              return (
                <button
                  key={item}
                  type="button"
                  className={cn("checklist-dialog-item", done && "done")}
                  aria-pressed={done}
                  onClick={() => selectedChecklist && toggleChecklist(selectedChecklist, index)}
                >
                  <span className="checklist-control" aria-hidden="true">{done && <Check />}</span>
                  <p>{item}</p>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{checklistValues.filter(Boolean).length} / {checklist?.items.length || 0} 已完成</span>
            <Button variant="outline" onClick={() => setSelectedChecklist(null)}>完成</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
