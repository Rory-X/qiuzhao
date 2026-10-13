#!/usr/bin/env python3
"""Refresh qiuzhao-live, diff normalized jobs, and publish a concise update summary."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
LIVE_ROOT = Path(os.environ.get("QIUZHAO_LIVE_DIR") or ROOT.parent / "qiuzhao-live").expanduser().resolve()
JOBS_PATH = LIVE_ROOT / "data" / "jobs.json"
KNOWN_PATH = ROOT / "data" / "radar-known.json"
SUMMARY_PATH = ROOT / "data" / "radar-sync.json"
LATEST_PATH = ROOT / "data" / "radar-latest.md"
SHANGHAI = ZoneInfo("Asia/Shanghai")


def should_skip_today() -> bool:
    if "--if-due" not in sys.argv:
        return False
    summary = read_json(SUMMARY_PATH, {})
    if summary.get("status") != "ok" or not summary.get("last_run"):
        return False
    try:
        last_run = datetime.fromisoformat(summary["last_run"]).astimezone(SHANGHAI)
    except (TypeError, ValueError):
        return False
    return last_run.date() == datetime.now(SHANGHAI).date()


def send_notification(title: str, message: str) -> None:
    if "--notify" not in sys.argv or sys.platform != "darwin":
        return
    escaped_title = title.replace("\\", "\\\\").replace('"', '\\"')
    escaped_message = message.replace("\\", "\\\\").replace('"', '\\"')
    try:
        subprocess.run(
            ["/usr/bin/osascript", "-e", f'display notification "{escaped_message}" with title "{escaped_title}"'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        pass


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return fallback


def write_json_atomic(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def write_text_atomic(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(value, encoding="utf-8")
    tmp.replace(path)


def job_key(job: dict) -> str:
    return "::".join(str(job.get(field) or "") for field in ("company", "cohort", "batch"))


def fingerprint(job: dict) -> str:
    content = {
        field: job.get(field)
        for field in (
            "company", "cohort", "batch", "program", "industry", "positions",
            "announcement", "locations", "apply_url", "deadline", "campus_only",
            "confirmed_by",
        )
    }
    raw = json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def state_for(jobs: list[dict]) -> dict[str, dict]:
    return {
        job_key(job): {
            "company": job.get("company"),
            "fingerprint": fingerprint(job),
            "last_seen": job.get("last_seen"),
        }
        for job in jobs
    }


def compact_job(job: dict) -> dict:
    return {
        "key": job_key(job),
        "company": job.get("company"),
        "industry": job.get("industry"),
        "positions": job.get("positions") or [],
        "locations": job.get("locations") or [],
        "apply_url": job.get("apply_url"),
        "first_seen": job.get("first_seen"),
        "last_seen": job.get("last_seen"),
        "confirmed_by": job.get("confirmed_by") or 1,
    }


def markdown_report(summary: dict) -> str:
    lines = [
        "# 钱嘉豪秋招岗位雷达更新",
        "",
        f"更新时间：{summary['last_run_local']}",
        "",
        f"- 聚合岗位：{summary['total']} 条",
        f"- 本轮新增：{summary['new_count']} 条",
        f"- 内容变化：{summary['changed_count']} 条",
        f"- 活跃日期刷新：{summary['refreshed_count']} 条",
        f"- 本轮下线：{summary['removed_count']} 条",
        f"- 带投递直链：{summary['with_url']} 条",
        f"- 已同步 Logo：{summary.get('with_logo', 0)} 家",
        f"- 多源确认：{summary['multi_confirmed']} 条",
        f"- 数据源最新日期：{summary.get('latest_source_date') or '未知'}",
    ]
    new_jobs = summary.get("new_jobs") or []
    changed_jobs = summary.get("changed_jobs") or []
    if new_jobs:
        lines.extend(["", "## 新增岗位"])
        for job in new_jobs[:12]:
            position = " / ".join(job.get("positions") or []) or "岗位待核验"
            location = "、".join(job.get("locations") or []) or "地点待核验"
            suffix = f" · [来源]({job['apply_url']})" if job.get("apply_url") else " · 暂无直链"
            lines.append(f"- **{job['company']}**：{position} · {location}{suffix}")
    if changed_jobs:
        lines.extend(["", "## 内容有变化"])
        for job in changed_jobs[:12]:
            lines.append(f"- **{job['company']}**：岗位、地点、链接或确认来源发生变化")
    if not new_jobs and not changed_jobs:
        lines.extend(["", "本轮没有新增公司或岗位内容变化；数据活跃日期已正常刷新。"])
    lines.extend(["", "工作台：<http://127.0.0.1:8765/radar>", ""])
    return "\n".join(lines)


def fail(message: str, started: float, output: str = "") -> int:
    now = datetime.now(SHANGHAI)
    summary = {
        "status": "error",
        "last_run": now.isoformat(),
        "last_run_local": now.strftime("%Y-%m-%d %H:%M:%S"),
        "duration_seconds": round(time.time() - started, 2),
        "message": message,
        "source_output_tail": output[-4000:],
        "new_count": 0,
        "changed_count": 0,
        "refreshed_count": 0,
        "removed_count": 0,
        "new_keys": [],
    }
    write_json_atomic(SUMMARY_PATH, summary)
    report = f"# 钱嘉豪秋招岗位雷达更新失败\n\n{message}\n"
    write_text_atomic(LATEST_PATH, report)
    print(report)
    send_notification("秋招岗位雷达更新失败", message[:180])
    return 1


def main() -> int:
    started = time.time()
    if should_skip_today():
        summary = read_json(SUMMARY_PATH, {})
        print(f"岗位雷达今天已更新：{summary.get('last_run_local', summary.get('last_run'))}")
        return 0
    if not (LIVE_ROOT / "refresh.sh").is_file():
        return fail(f"找不到刷新脚本：{LIVE_ROOT / 'refresh.sh'}", started)

    before_jobs = read_json(JOBS_PATH, [])
    known = read_json(KNOWN_PATH, None)
    previous = known.get("jobs", {}) if isinstance(known, dict) else state_for(before_jobs)

    try:
        result = subprocess.run(
            [str(LIVE_ROOT / "refresh.sh"), "--no-serve"],
            cwd=LIVE_ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=8 * 60,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return fail(f"数据源刷新未完成：{exc}", started)
    if result.returncode != 0:
        return fail(f"数据源刷新退出码 {result.returncode}", started, result.stdout)

    jobs = read_json(JOBS_PATH, [])
    if not isinstance(jobs, list) or not jobs:
        return fail("刷新后 jobs.json 为空或格式错误，已停止发布", started, result.stdout)

    current = state_for(jobs)
    by_key = {job_key(job): job for job in jobs}
    new_keys = sorted(set(current) - set(previous))
    removed_keys = sorted(set(previous) - set(current))
    shared = set(current) & set(previous)
    changed_keys = sorted(key for key in shared if current[key]["fingerprint"] != previous[key].get("fingerprint"))
    refreshed_keys = sorted(key for key in shared if current[key].get("last_seen") != previous[key].get("last_seen"))
    now = datetime.now(SHANGHAI)
    last_seen = sorted(str(job.get("last_seen")) for job in jobs if job.get("last_seen"))
    summary = {
        "status": "ok",
        "last_run": now.isoformat(),
        "last_run_local": now.strftime("%Y-%m-%d %H:%M:%S"),
        "duration_seconds": round(time.time() - started, 2),
        "message": "两个数据源刷新、归一化与差异计算完成",
        "total": len(jobs),
        "with_url": sum(bool(job.get("apply_url")) for job in jobs),
        "with_logo": sum(bool(job.get("logo_path")) for job in jobs),
        "multi_confirmed": sum(int(job.get("confirmed_by") or 0) >= 2 for job in jobs),
        "latest_source_date": last_seen[-1] if last_seen else None,
        "new_count": len(new_keys),
        "changed_count": len(changed_keys),
        "refreshed_count": len(refreshed_keys),
        "removed_count": len(removed_keys),
        "new_keys": new_keys,
        "new_jobs": [compact_job(by_key[key]) for key in new_keys[:50]],
        "changed_jobs": [compact_job(by_key[key]) for key in changed_keys[:50]],
        "removed_companies": [previous[key].get("company") for key in removed_keys[:50]],
        "source_output_tail": result.stdout[-4000:],
    }
    known_value = {"updated_at": now.isoformat(), "jobs": current}
    report = markdown_report(summary)
    write_json_atomic(KNOWN_PATH, known_value)
    write_json_atomic(SUMMARY_PATH, summary)
    write_text_atomic(LATEST_PATH, report)
    print(report)
    send_notification(
        "秋招岗位雷达已更新",
        f"新增 {len(new_keys)} · 变化 {len(changed_keys)} · 下线 {len(removed_keys)} · 共 {len(jobs)} 条",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
