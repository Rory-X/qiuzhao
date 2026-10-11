import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CloudCog, Command, Database, LoaderCircle, Search, Wifi } from "lucide-react";
import { toast, Toaster } from "sonner";
import { AddApplicationDialog } from "@/components/AddApplicationDialog";
import { Interview } from "@/components/Interview";
import { Opportunities } from "@/components/Opportunities";
import { Overview } from "@/components/Overview";
import { OnboardingGuide } from "@/components/OnboardingGuide";
import { Pipeline } from "@/components/Pipeline";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { revealApp } from "@/boot";
import { isApplicationClosed, shanghaiDateKey, weekKey } from "@/lib/utils";
import type { Application, ApplicationStatus, Meta, Page, WorkbenchState } from "@/types";

const Materials = lazy(() =>
  import("@/components/Materials").then((module) => ({ default: module.Materials })),
);

const InterviewExperience = lazy(() =>
  import("@/components/InterviewExperience").then((module) => ({ default: module.InterviewExperience })),
);

const JobRadar = lazy(() =>
  import("@/components/JobRadar").then((module) => ({ default: module.JobRadar })),
);

const CommandPalette = lazy(() =>
  import("@/components/CommandPalette").then((module) => ({ default: module.CommandPalette })),
);

const pageMeta: Record<Page, { eyebrow: string; title: string }> = {
  overview: { eyebrow: "QIAN JIAHAO · AUTUMN RECRUITMENT", title: "今天，推进一小步" },
  radar: { eyebrow: "LIVE JOB RADAR", title: "从真实数据源发现机会" },
  opportunities: { eyebrow: "JOB PIPELINE", title: "收好每一个机会" },
  pipeline: { eyebrow: "CONVERSION FUNNEL", title: "看清流程，修正变量" },
  interview: { eyebrow: "INTERVIEW PRACTICE", title: "把卡顿练成证据" },
  experience: { eyebrow: "REAL INTERVIEW NOTES", title: "真题逐道拆解" },
  materials: { eyebrow: "LOCAL KNOWLEDGE", title: "材料都在手边" },
};

const pagePaths: Record<Page, string> = {
  overview: "/",
  radar: "/radar",
  opportunities: "/opportunities",
  pipeline: "/pipeline",
  interview: "/interview",
  experience: "/interview-experience",
  materials: "/materials",
};

function pageFromPath(pathname: string): Page {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return (Object.entries(pagePaths).find(([, path]) => path === normalized)?.[0] as Page | undefined) || "overview";
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export default function App() {
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname));
  const [state, setState] = useState<WorkbenchState | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState<Application | null>(null);
  const [draftApplication, setDraftApplication] = useState<Partial<Application> | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [routeSearch, setRouteSearch] = useState(window.location.search);
  const [loadError, setLoadError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return window.localStorage.getItem("qiuzhao-sidebar-collapsed") === "1"; }
    catch { return false; }
  });
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveRevision = useRef(0);

  useEffect(() => {
    Promise.all([api<WorkbenchState>("/api/state"), api<Meta>("/api/meta")])
      .then(([nextState, nextMeta]) => {
        setState(nextState);
        setMeta(nextMeta);
      })
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  useEffect(() => {
    if (state || loadError) revealApp();
  }, [state, loadError]);

  useEffect(() => {
    try { window.localStorage.setItem("qiuzhao-sidebar-collapsed", sidebarCollapsed ? "1" : "0"); }
    catch { /* The menu still works when storage is unavailable. */ }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handlePopState = () => {
      setPage(pageFromPath(window.location.pathname));
      setRouteSearch(window.location.search);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.title = "钱嘉豪秋招工作台";
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const navigate = (nextPage: Page, search = "") => {
    const target = `${pagePaths[nextPage]}${search}`;
    if (`${window.location.pathname}${window.location.search}` !== target) window.history.pushState({}, "", target);
    setPage(nextPage);
    setRouteSearch(search);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const persist = (next: WorkbenchState, message?: string) => {
    setState(next);
    const revision = ++saveRevision.current;
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const saved = await api<WorkbenchState>("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (revision === saveRevision.current) setState(saved);
        if (message) toast.success(message);
      } catch (error) {
        toast.error("本地保存失败", { description: error instanceof Error ? error.message : "未知错误" });
      }
    });
  };

  useEffect(() => {
    if (!state || state.onboarding.skipped || state.onboarding.visited.includes(page)) return;
    persist({ ...state, onboarding: { ...state.onboarding, visited: [...state.onboarding.visited, page] } });
  }, [page, state?.onboarding.skipped, state?.onboarding.visited.join("|")]);

  const saveApplication = (application: Application) => {
    if (!state) return;
    const exists = state.applications.some((item) => item.id === application.id);
    persist({ ...state, applications: exists ? state.applications.map((item) => item.id === application.id ? application : item) : [application, ...state.applications] }, exists ? "投递记录已更新" : "岗位已加入机会池");
  };

  const deleteApplication = (id: string) => {
    if (!state) return;
    persist({
      ...state,
      applications: state.applications.filter((item) => item.id !== id),
      interviewSessions: state.interviewSessions.map((session) => session.applicationId === id ? { ...session, applicationId: undefined } : session),
    }, "投递记录已删除");
  };

  const updateStatus = (id: string, status: ApplicationStatus) => {
    if (!state) return;
    persist(
      {
        ...state,
        applications: state.applications.map((item) => (item.id === id ? {
          ...item,
          status,
          appliedAt: item.appliedAt || (status !== "watch" ? shanghaiDateKey() : undefined),
        } : item)),
      },
      "投递状态已更新",
    );
  };

  const applications = state?.applications || [];
  const closedCount = applications.filter((item) => isApplicationClosed(item)).length;
  const headerMeta = useMemo(() => pageMeta[page], [page]);
  const params = useMemo(() => new URLSearchParams(routeSearch), [routeSearch]);
  const currentRhythm = state?.rhythm[weekKey()] || [false, false, false, false, false, false];

  const openCreate = () => {
    setEditingApplication(null);
    setDraftApplication(null);
    setCreateOpen(true);
  };

  const openApplication = (application: Application) => {
    setDraftApplication(null);
    setEditingApplication(application);
    setCreateOpen(true);
  };

  const openDraftApplication = (draft: Partial<Application>) => {
    setEditingApplication(null);
    setDraftApplication(draft);
    setCreateOpen(true);
  };

  if (loadError) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6 text-ink">
        <div className="sketch-panel max-w-md bg-card p-8 text-center shadow-[6px_6px_0_var(--ink)]">
          <CloudCog className="mx-auto mb-4 size-10 text-seal" />
          <h1 className="text-xl font-black">本地服务没有接上</h1>
          <p className="mt-2 text-sm text-muted">请运行 npm run dev，同时启动 Vite 和状态服务。</p>
          <pre className="mt-5 overflow-auto bg-ink p-3 text-left text-xs text-paper">{loadError}</pre>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper text-ink">
        <div className="flex items-center gap-3 font-bold"><LoaderCircle className="animate-spin text-seal" /> 正在铺开工作台…</div>
      </main>
    );
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <Sidebar page={page} onPageChange={(next) => navigate(next)} onCreate={openCreate} onboarding={state.onboarding} rhythm={currentRhythm} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((value) => !value)} />
      <main className="workspace-main">
        <header className="workspace-header">
          <div>
            <p>{headerMeta.eyebrow}</p>
            <h2>{headerMeta.title}</h2>
          </div>
          <div className="header-actions">
            <button className="command-search" onClick={() => setCommandOpen(true)}>
              <Search />
              <span>搜索岗位、材料与面经</span>
              <kbd><Command /> K</kbd>
            </button>
            {closedCount > 0 && <Badge variant="seal" className="header-alert"><AlertTriangle /> {closedCount} 条网申结束</Badge>}
            <Badge variant="success"><Wifi /> 本地服务在线</Badge>
            <Badge variant="soft"><Database /> {applications.length} 条记录</Badge>
          </div>
        </header>

        <div className="workspace-content">
          {page === "overview" && <Overview state={state} onStateChange={persist} onNavigate={(next) => navigate(next)} onCreate={openCreate} onOpenApplication={openApplication} />}
          {page === "radar" && (
            <Suspense fallback={<div className="material-reader-state"><LoaderCircle className="animate-spin" /><b>正在接入岗位雷达…</b></div>}>
              <JobRadar applications={applications} onAdd={openDraftApplication} />
            </Suspense>
          )}
          {page === "opportunities" && <Opportunities applications={applications} initialQuery={params.get("q") || ""} onCreate={openCreate} onOpen={openApplication} onStatusChange={updateStatus} />}
          {page === "pipeline" && <Pipeline state={state} onCreate={openCreate} onStatusChange={updateStatus} onStateChange={persist} />}
          {page === "interview" && <Interview state={state} onStateChange={persist} />}
          {page === "experience" && (
            <Suspense fallback={<div className="material-reader-state"><LoaderCircle className="animate-spin" /><b>正在铺开真实面经…</b></div>}>
              <InterviewExperience initialQuery={params.get("q") || ""} />
            </Suspense>
          )}
          {page === "materials" && (
            <Suspense fallback={<div className="material-reader-state"><LoaderCircle className="animate-spin" /><b>正在打开材料库…</b></div>}>
              <Materials meta={meta} state={state} initialDocId={params.get("doc") || undefined} onStateChange={persist} />
            </Suspense>
          )}
        </div>
      </main>

      <AddApplicationDialog open={createOpen} application={editingApplication} draft={draftApplication} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) {
          setEditingApplication(null);
          setDraftApplication(null);
        }
      }} onSave={saveApplication} onDelete={deleteApplication} />
      {commandOpen && (
        <Suspense fallback={null}>
          <CommandPalette open={commandOpen} applications={applications} meta={meta} onOpenChange={setCommandOpen} onNavigate={navigate} />
        </Suspense>
      )}
      <OnboardingGuide onboarding={state.onboarding} onNavigate={(next) => navigate(next)} onSkip={() => persist({ ...state, onboarding: { ...state.onboarding, skipped: true } }, "已跳过入口引导")} />
      <Toaster position="bottom-right" richColors toastOptions={{ className: "font-sans" }} />
    </div>
  );
}
