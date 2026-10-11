import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  AlertTriangle,
  Ban,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { statusConfig } from "@/data/config";
import { cn, formatDate, isApplicationClosed } from "@/lib/utils";
import type { Application, ApplicationStatus, Tier } from "@/types";

const statusOptions: Array<ApplicationStatus | "all"> = [
  "all",
  "watch",
  "applied",
  "assess",
  "oa",
  "ai",
  "tech",
  "hr",
  "offer",
  "reject",
];

export function Opportunities({
  applications,
  initialQuery,
  onCreate,
  onOpen,
  onStatusChange,
}: {
  applications: Application[];
  initialQuery?: string;
  onCreate: () => void;
  onOpen: (application: Application) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}) {
  const [query, setQuery] = useState(initialQuery || "");
  const [tier, setTier] = useState<Tier | "all">("all");
  const [status, setStatus] = useState<ApplicationStatus | "all">("all");
  const [alertOnly, setAlertOnly] = useState(false);

  useEffect(() => setQuery(initialQuery || ""), [initialQuery]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return applications.filter((item) => {
      const matchesText = !normalized || `${item.company} ${item.role} ${item.track}`.toLowerCase().includes(normalized);
      return matchesText
        && (tier === "all" || item.tier === tier)
        && (status === "all" || item.status === status)
        && (!alertOnly || isApplicationClosed(item));
    });
  }, [alertOnly, applications, query, status, tier]);

  const closedApplications = applications.filter((item) => isApplicationClosed(item));

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <p className="section-kicker">OPPORTUNITIES</p>
          <h1>机会与投递</h1>
          <p>先核验，再评分；只让高匹配岗位占用你的黄金时间。</p>
        </div>
        <Button variant="seal" className="sketch-button" onClick={onCreate}>
          <Plus /> 新建投递
        </Button>
      </section>

      {closedApplications.length > 0 && (
        <section className="closed-alert opportunity-alert">
          <span className="closed-alert-icon"><AlertTriangle /></span>
          <span className="min-w-0 flex-1">
            <b>发现 {closedApplications.length} 条网申结束数据</b>
            <small>截止日期已过或官网已经下线。建议归档记录，并暂停简历定向与跟进。</small>
          </span>
          <Button
            variant={alertOnly ? "seal" : "outline"}
            size="sm"
            className="sketch-button"
            onClick={() => setAlertOnly((value) => !value)}
          >
            <Ban /> {alertOnly ? "显示全部岗位" : "只看告警岗位"}
          </Button>
        </section>
      )}

      <section className="filter-paper">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            placeholder="搜索公司、岗位或方向"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="filter-group">
          <Filter />
          {(["all", "A", "B", "C"] as const).map((value) => (
            <button key={value} className={cn("filter-chip", tier === value && "active")} onClick={() => setTier(value)}>
              {value === "all" ? "全部等级" : `${value} 级`}
            </button>
          ))}
        </div>
        <div className="filter-group status-filters">
          <SlidersHorizontal />
          {statusOptions.map((value) => (
            <button key={value} className={cn("filter-chip", status === value && "active")} onClick={() => setStatus(value)}>
              {value === "all" ? "全部状态" : statusConfig[value].short}
            </button>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between text-sm">
        <span className="font-bold">共 {filtered.length} 个岗位</span>
        <span className="text-muted">A 级岗位建议 24 小时内完成投递</span>
      </div>

      <section className="application-table-wrap">
        <div className="application-table-head">
          <span>公司与岗位</span>
          <span>匹配</span>
          <span>当前状态</span>
          <span>下一步</span>
          <span>简历 / 来源</span>
          <span />
        </div>
        {filtered.map((application) => {
          const config = statusConfig[application.status];
          const closed = isApplicationClosed(application);
          return (
            <article key={application.id} className={cn("application-row", closed && "closed")}>
              <div className="application-company">
                <CompanyAvatar company={application.company} logoUrl={application.logo} />
                <div className="application-copy">
                  <div className="application-title-row">
                    <b className="flex items-center gap-2">
                      {application.company}
                      {closed && <span className="closed-marker"><Ban /> 网申结束</span>}
                    </b>
                    <div className="mobile-application-chips">
                      <Badge variant={application.tier === "A" ? "seal" : "outline"}>{application.tier}</Badge>
                      <span style={{ backgroundColor: config.soft, color: config.color }}>{config.short}</span>
                    </div>
                  </div>
                  <span className="application-role">{application.role}</span>
                  <small className="application-meta">
                    <span><MapPin /> {application.location || "地点待核验"}</span>
                    {application.deadline && <span><CalendarDays /> {formatDate(application.deadline)} 截止</span>}
                  </small>
                  <div className="mobile-next-action">
                    <Clock3 />
                    <span>
                      <em>下一步</em>
                      <b>{application.nextAction || "补充下一步"}</b>
                    </span>
                    <time>{formatDate(application.nextDate)}</time>
                  </div>
                </div>
              </div>
              <div className="match-cell">
                <Badge variant={application.tier === "A" ? "seal" : "outline"}>{application.tier}</Badge>
                <span>{application.score ?? "—"} 分</span>
                <small>{application.track}</small>
              </div>
              <div>
                <select
                  className="status-select"
                  style={{ backgroundColor: config.soft, color: config.color }}
                  value={application.status}
                  onChange={(event) => onStatusChange(application.id, event.target.value as ApplicationStatus)}
                >
                  {Object.entries(statusConfig).map(([id, option]) => (
                    <option key={id} value={id}>{option.short}</option>
                  ))}
                </select>
                <small className="mt-2 flex items-center gap-1 text-muted">
                  {closed ? <Ban /> : application.verify === "verified" ? <CheckCircle2 /> : <BriefcaseBusiness />}
                  {closed ? "官网下线 / 已截止" : application.verify === "verified" ? "官网已核验" : "等待核验"}
                </small>
              </div>
              <div className="next-cell">
                <b>{application.nextAction || "补充下一步"}</b>
                <span>{formatDate(application.nextDate)}</span>
              </div>
              <div className="resume-cell">
                <b>{application.resume}</b>
                <span>{application.source}</span>
              </div>
              <Button variant="ghost" size="icon" aria-label={`编辑 ${application.company}`} onClick={() => onOpen(application)}>
                <ArrowUpRight />
              </Button>
            </article>
          );
        })}
        {!filtered.length && (
          <button className="empty-paper m-4" onClick={onCreate}>
            <Search />
            <b>没有符合当前条件的岗位</b>
            <span>换一个筛选条件，或收下一条新机会。</span>
          </button>
        )}
      </section>
    </div>
  );
}
