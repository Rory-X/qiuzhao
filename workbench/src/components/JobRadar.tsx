import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Link2,
  LoaderCircle,
  MapPin,
  Plus,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import type { Application } from "@/types";

export interface RadarJob {
  key: string;
  company: string;
  cohort: string;
  batch: string;
  program: string | null;
  industry: string;
  positions: string[];
  announcement: string | null;
  locations: string[];
  apply_url: string | null;
  deadline: string | null;
  first_seen: string | null;
  last_seen: string | null;
  confirmed_by: number;
  logo_url: string | null;
  logo_source: string | null;
  is_new: boolean;
}

interface RadarPayload {
  items: RadarJob[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  industries: Array<{ name: string; count: number }>;
  stats: { total: number; withUrl: number; withLogo: number; multiConfirmed: number; latestSourceDate: string | null; fileUpdatedAt: string };
  sync: null | {
    last_run?: string;
    status?: string;
    new_count?: number;
    changed_count?: number;
    refreshed_count?: number;
    removed_count?: number;
    message?: string;
  };
  source: { root: string; sources: string[] };
}

function inferTrack(job: RadarJob) {
  const text = `${job.positions.join(" ")} ${job.announcement || ""}`.toLowerCase();
  if (/agent|智能体/.test(text)) return "Agent";
  if (/大模型|人工智能|\bai\b|算法|机器学习|深度学习|nlp|rag/.test(text)) return "AI应用";
  if (/后端|服务端/.test(text)) return "后端开发";
  return "其他";
}

function Stat({ label, value, note, icon: Icon }: { label: string; value: string | number; note: string; icon: React.ElementType }) {
  return <Card><CardContent className="radar-stat"><span><Icon /></span><div><small>{label}</small><b>{value}</b><em>{note}</em></div></CardContent></Card>;
}

export function JobRadar({ applications, onAdd }: {
  applications: Application[];
  onAdd: (draft: Partial<Application>) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [industry, setIndustry] = useState("");
  const [withUrl, setWithUrl] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RadarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => setPage(1), [debouncedQuery, industry, newOnly, withUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "30" });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (industry) params.set("industry", industry);
    if (withUrl) params.set("withUrl", "1");
    if (newOnly) params.set("newOnly", "1");
    setLoading(true);
    setError("");
    fetch(`/api/jobs?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<RadarPayload>;
      })
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "岗位雷达读取失败");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [debouncedQuery, industry, newOnly, page, withUrl]);

  const tracked = useMemo(() => new Set(applications.map((item) => item.company.trim().toLocaleLowerCase("zh-CN"))), [applications]);
  const latestSync = data?.sync?.last_run ? new Date(data.sync.last_run).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hourCycle: "h23" }) : "尚未执行自动同步";

  const add = (job: RadarJob) => onAdd({
    company: job.company,
    role: job.positions.length ? job.positions.join(" / ") : job.announcement || "岗位待核验",
    track: inferTrack(job),
    source: `岗位雷达 · ${job.confirmed_by || 1} 个源`,
    verify: "pending",
    status: "watch",
    nextAction: "核验官网 JD 与岗位要求",
    location: job.locations.join(" / "),
    deadline: job.deadline || undefined,
    url: job.apply_url || undefined,
    logo: job.logo_url || undefined,
    note: [job.cohort, job.batch, job.announcement].filter(Boolean).join(" · "),
  });

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><p className="section-kicker">LIVE JOB RADAR</p><h1>岗位雷达</h1><p>聚合 qiuzhao-live 的真实数据源；先筛选与核验，再加入个人机会池。</p></div>
        <Badge variant={data?.sync?.status === "ok" ? "success" : "outline"}><Radar /> {latestSync}</Badge>
      </section>

      {data && <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="聚合岗位" value={data.stats.total} note={`${data.stats.withLogo} 家已同步 Logo`} icon={Building2} />
        <Stat label="带投递直链" value={data.stats.withUrl} note={`${Math.round((data.stats.withUrl / Math.max(1, data.stats.total)) * 100)}% 覆盖`} icon={Link2} />
        <Stat label="多源确认" value={data.stats.multiConfirmed} note="至少两个来源交叉确认" icon={ShieldCheck} />
        <Stat label="本轮新增" value={data.sync?.new_count ?? 0} note={`源最新 ${data.stats.latestSourceDate || "未知"}`} icon={Sparkles} />
      </section>}

      {data?.sync && <section className="radar-sync-strip"><CheckCircle2 /><span><b>最近一次数据同步</b><small>新增 {data.sync.new_count || 0} · 内容变化 {data.sync.changed_count || 0} · 活跃刷新 {data.sync.refreshed_count || 0} · 下线 {data.sync.removed_count || 0}</small></span></section>}

      <section className="radar-filters">
        <label><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司、岗位、地点或公告" /></label>
        <select value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="">全部行业</option>{(data?.industries || []).map((item) => <option key={item.name} value={item.name}>{item.name} · {item.count}</option>)}</select>
        <button className={withUrl ? "active" : ""} onClick={() => setWithUrl((value) => !value)}><Link2 /> 只看有直链</button>
        <button className={newOnly ? "active" : ""} onClick={() => setNewOnly((value) => !value)}><Sparkles /> 只看本轮新增</button>
      </section>

      <div className="radar-result-line"><b>{data?.total || 0} 条匹配结果</b><span>数据仅用于候选发现，加入机会池前请核验官网。</span></div>

      {error ? <section className="experience-empty"><Radar /><h2>岗位雷达暂时不可用</h2><p>{error}</p></section> : loading && !data ? <section className="material-reader-state"><LoaderCircle className="animate-spin" /><b>正在读取聚合数据…</b></section> : (
        <section className="radar-list" aria-label="岗位列表" aria-busy={loading}>
          <div className="radar-list-heading" aria-hidden="true"><span>公司与岗位</span><span>地点与时间</span><span>核验与操作</span></div>
          {(data?.items || []).length === 0 && <div className="radar-list-empty">没有匹配的岗位，试试调整搜索或筛选条件。</div>}
          {(data?.items || []).map((job) => {
            const isTracked = tracked.has(job.company.trim().toLocaleLowerCase("zh-CN"));
            return <article key={job.key} className="radar-row">
              <div className="radar-row-primary">
                <CompanyAvatar company={job.company} logoUrl={job.logo_url || undefined} className="radar-company-avatar" />
                <div className="radar-row-summary">
                  <div className="radar-row-title"><h2>{job.company}</h2>{job.is_new && <span className="radar-new-marker">本轮新增</span>}</div>
                  <p className="radar-row-context"><span>{job.industry}</span><span>{job.announcement || `${job.cohort} · ${job.batch}`}</span></p>
                  <div className="radar-tags">{(job.positions.length ? job.positions : ["岗位待核验"]).map((position) => <span key={position}>{position}</span>)}</div>
                </div>
              </div>
              <div className="radar-row-meta"><span><MapPin /> {job.locations.length ? job.locations.join("、") : "地点待核验"}</span><span><CalendarDays /> {job.deadline ? `${formatDate(job.deadline)} 截止` : "截止待核验"}</span></div>
              <div className="radar-row-actions">
                <Badge variant={job.confirmed_by >= 2 ? "success" : "soft"}>{job.confirmed_by >= 2 ? `${job.confirmed_by} 源确认` : "单源收录"}</Badge>
                <Button variant="outline" size="sm" disabled={isTracked} onClick={() => add(job)}>{isTracked ? <CheckCircle2 /> : <Plus />}{isTracked ? "已在机会池" : "加入机会池"}</Button>
                {job.apply_url ? <a href={job.apply_url} target="_blank" rel="noreferrer">查看来源 <ExternalLink /></a> : <span>暂无直链</span>}
              </div>
            </article>;
          })}
        </section>
      )}

      {data && data.pages > 1 && <div className="radar-pagination"><Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}><ArrowLeft /> 上一页</Button><span>第 {data.page} / {data.pages} 页</span><Button variant="outline" disabled={page >= data.pages || loading} onClick={() => setPage((value) => Math.min(data.pages, value + 1))}>下一页 <ArrowRight /></Button></div>}
    </div>
  );
}
