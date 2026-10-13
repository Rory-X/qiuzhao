#!/usr/bin/env python3
"""xixicc2027 合并层：把新抓取的记录并入历史 jobs.json。

复刻原项目的两条核心规则，均由仓库 git 历史**回放验证**（68/68 天条数完全一致）：

1. 去重键 = (company, cohort, batch, program)  —— 注意：**不含 positions**。
   positions 会随渠道更新而变化（如汇川技术 6 项 -> 4 项），若进键会产生
   重复记录；原项目用「按公司+届别+批次+项目」归并，并保留较全的 positions。
2. 过期清理：deadline < 今天 -> 移除（截止当天仍保留）。
   实证：58/58 条带 deadline 的删除都发生在「截止日 +1 天」。

另：同一键再次出现时 confirmed_by += 1（README 的 ✅×N 即来于此），
last_seen 推进到最新一次被看到的日子。

纯标准库实现。
"""
import json
from datetime import date
from pathlib import Path

FIELDS = ["company", "cohort", "batch", "program", "industry", "positions",
          "locations", "apply_url", "official_wechat", "qr_image", "deadline",
          "campus_only", "first_seen", "last_seen", "confirmed_by"]


def key_of(j):
    """去重键：不含 positions（positions 会随渠道漂移，进键会产生重复记录）。"""
    return (j["company"], j["cohort"], j["batch"], j["program"])


def normalize(j, today):
    """补齐字段、统一类型，返回 (record, key)。"""
    r = {f: j.get(f) for f in FIELDS}
    r["positions"] = list(r.get("positions") or [])
    r["locations"] = list(r.get("locations") or [])
    r["campus_only"] = bool(r.get("campus_only"))
    r["confirmed_by"] = int(r.get("confirmed_by") or 1)
    r["first_seen"] = r.get("first_seen") or today
    r["last_seen"] = r.get("last_seen") or today
    if r.get("industry") is None:
        r["industry"] = "其他"
    return r


def merge(old, new, today):
    """把 new 并入 old，返回 (合并后列表, 统计)。"""
    pool = {}
    order = []
    for j in old:
        r = normalize(j, today)
        k = key_of(r)
        if k not in pool:
            pool[k] = r
            order.append(k)

    stats = {"new": 0, "bumped": 0, "updated": 0}
    for j in new:
        r = normalize(j, today)
        k = key_of(r)
        if k in pool:
            cur = pool[k]
            before = (cur["last_seen"], cur["confirmed_by"])
            cur["confirmed_by"] += 1
            cur["last_seen"] = max(cur["last_seen"], r["last_seen"])
            cur["first_seen"] = min(cur["first_seen"], r["first_seen"])
            if (cur["last_seen"], cur["confirmed_by"]) != before:
                stats["bumped"] += 1
            # 补全旧记录缺失的字段（不覆盖已有值）
            for f in ("apply_url", "official_wechat", "deadline", "program"):
                if not cur.get(f) and r.get(f):
                    cur[f] = r[f]
                    stats["updated"] += 1
            for f in ("positions", "locations"):
                if len(r.get(f) or []) > len(cur.get(f) or []):
                    cur[f] = r[f]
                    stats["updated"] += 1
        else:
            pool[k] = r
            order.append(k)
            stats["new"] += 1

    merged = [pool[k] for k in order]

    # 过期清理：今天 > deadline 即移除（实证规则）
    kept, expired = [], []
    for j in merged:
        dl = j.get("deadline")
        try:
            if dl and date.fromisoformat(dl) < today:
                expired.append(j)
                continue
        except ValueError:
            pass
        kept.append(j)
    stats["expired"] = len(expired)
    stats["expired_list"] = [j["company"] for j in expired]
    stats["total"] = len(kept)
    return kept, stats


def load(path):
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def save(path, jobs):
    Path(path).write_text(json.dumps(jobs, ensure_ascii=False, indent=2),
                          encoding="utf-8")


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="合并新抓取记录进 jobs.json")
    ap.add_argument("--base", default="jobs.json", help="历史库")
    ap.add_argument("--new", required=True, help="本次新抓取的 json（数组）")
    ap.add_argument("--out", default="jobs.json")
    ap.add_argument("--today", default=None)
    a = ap.parse_args()

    today = date.fromisoformat(a.today) if a.today else date.today()
    old = load(a.base)
    new = load(a.new)
    merged, st = merge(old, new, today)
    save(a.out, merged)

    print(f"基线 {len(old)} 条 + 新抓 {len(new)} 条 -> {st['total']} 条")
    print(f"  新增      {st['new']}")
    print(f"  确认/刷新 {st['bumped']}")
    print(f"  字段补全  {st['updated']}")
    print(f"  过期清理  {st['expired']}  {st['expired_list'][:8]}")
