#!/usr/bin/env python3
"""端到端：采集 -> 合并 -> 渲染。验证 fork 后整条 pipeline 能闭环。

用法：
  python3 pipeline.py --pages 2 --max-articles 30
"""
import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import collector_spike as col          # noqa: E402
import merge as mg                     # noqa: E402
from publisher import render_readme, render_site  # noqa: E402


def collect(pages, max_articles, sleep, out):
    """复用 spike 的采集逻辑，产出标准化记录。"""
    import time
    from datetime import datetime
    seen, cand = set(), []
    for q in col.QUERIES:
        for pg in range(1, pages + 1):
            try:
                rows = col.search(q, pg)
            except Exception as e:
                print(f"  ! 搜索失败 {q} p{pg}: {type(e).__name__}")
                continue
            fresh = [r for r in rows if r["link"] not in seen]
            seen.update(r["link"] for r in fresh)
            cand += fresh
            time.sleep(sleep)
    cand = cand[:max_articles]

    recs = []
    today = date.today().isoformat()
    for i, c in enumerate(cand, 1):
        real = col.resolve(c["link"])
        time.sleep(sleep)
        if not real:
            continue
        body = col.article(real)
        time.sleep(sleep)
        blob = c["title"] + " " + body
        if not __import__("re").search(r"20\d\d\s*届|不限", blob):
            continue
        pub = (datetime.fromtimestamp(c["ts"]).date().isoformat()
               if c["ts"] else today)
        recs.append({
            "company": col.company_of(c["title"]),
            "cohort": col.cohort_of(blob),
            "batch": col.batch_of(blob),
            "program": None,
            "industry": col.industry_of(blob),
            "positions": col.positions_of(body),
            "locations": col.locations_of(body),
            "apply_url": col.url_of(body),
            "official_wechat": col.wechat_of(body),
            "qr_image": None,
            "deadline": col.deadline_of(body),
            "campus_only": False,
            "first_seen": pub,
            "last_seen": pub,
            "confirmed_by": 1,
        })
        print(f"  {i:3}/{len(cand)} {recs[-1]['company']} | {recs[-1]['industry']}")
    Path(out).write_text(json.dumps(recs, ensure_ascii=False, indent=2),
                         encoding="utf-8")
    return recs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default="../xixicc2027",
                    help="原仓库检出目录（提供 jobs.json / 模板）")
    ap.add_argument("--outdir", default="out")
    ap.add_argument("--pages", type=int, default=1)
    ap.add_argument("--max-articles", type=int, default=30)
    ap.add_argument("--sleep", type=float, default=1.2)
    ap.add_argument("--skip-collect", action="store_true",
                    help="复用已有 new.json，不重新抓取")
    a = ap.parse_args()

    repo, out = Path(a.repo), Path(a.outdir)
    out.mkdir(parents=True, exist_ok=True)
    raw_new = out / "new.json"

    print("=" * 60)
    print("① 采集")
    print("=" * 60)
    if a.skip_collect and raw_new.exists():
        new = json.loads(raw_new.read_text(encoding="utf-8"))
        print(f"  复用 {raw_new}（{len(new)} 条）")
    else:
        new = collect(a.pages, a.max_articles, a.sleep, raw_new)
    print(f"  抓到可结构化记录 {len(new)} 条")

    print()
    print("=" * 60)
    print("② 合并（与原库 history union + 截止清理）")
    print("=" * 60)
    base = json.loads((repo / "jobs.json").read_text(encoding="utf-8"))
    merged, st = mg.merge(base, new, date.today())
    mg.save(out / "jobs.json", merged)
    print(f"  基线 {len(base)} + 新抓 {len(new)} -> {st['total']}")
    print(f"  新增 {st['new']} ｜ 确认刷新 {st['bumped']} ｜ "
          f"字段补全 {st['updated']} ｜ 过期清理 {st['expired']}")

    print()
    print("=" * 60)
    print("③ 渲染（README + index.html）")
    print("=" * 60)
    updated = f"{date.today().isoformat()} 00:00"
    (out / "README.md").write_text(render_readme(merged, updated),
                                   encoding="utf-8")
    tpl = (repo / "site_template_heytea.html").read_text(encoding="utf-8")
    (out / "index.html").write_text(render_site(merged, tpl), encoding="utf-8")
    print(f"  ✅ README.md / index.html（{len(merged)} 条，更新 {updated}）")

    print()
    print("=" * 60)
    print("④ 校验")
    print("=" * 60)
    ok = True
    r = (out / "README.md").read_text(encoding="utf-8")
    for k in ["互联网", "央国企", "半导体/硬件"]:
        hit = k in r
        ok &= hit
        print(f"  README 含「{k}」: {hit}")
    h = (out / "index.html").read_text(encoding="utf-8")
    print(f"  index.html 含注入数据: {'const JOBS' in h}")
    # 截止清理正确性
    from datetime import date as _d
    stale = [j for j in merged
             if j.get("deadline") and _d.fromisoformat(j["deadline"]) < _d.today()]
    print(f"  残留过期条目: {len(stale)}（应为 0）")
    print(f"\n  产物目录: {out.resolve()}")
    return 0 if ok and not stale else 1


if __name__ == "__main__":
    sys.exit(main())
