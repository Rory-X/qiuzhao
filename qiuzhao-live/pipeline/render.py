#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把归一化后的 jobs.json 注入喜茶风格模板，生成可交互页面。

用法：
  python3 pipeline/render.py                 # 全量渲染
  python3 pipeline/render.py --industry 互联网  # 只看某行业（逗号分隔多个）
  python3 pipeline/render.py --days 14        # 只看 14 天内截止
  python3 pipeline/render.py --open           # 渲染后打开浏览器

模板契约：site_template 里 `const JOBS = /*__DATA__*/[];` 一行是数据占位符，
替换即可；模板自身不含外部依赖（GSAP 占位为空时自动降级为 IntersectionObserver）。
"""
from __future__ import annotations

import argparse
import json
import webbrowser
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "jobs.json"
TPL = ROOT / "templates" / "heytea.html"
OUT = ROOT / "dist" / "index.html"
PLACEHOLDER = "/*__DATA__*/[]"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--industry", help="行业过滤，逗号分隔，如: 互联网,游戏")
    ap.add_argument("--keyword", help="公司名/岗位关键词过滤")
    ap.add_argument("--days", type=int, help="只保留 N 天内截止")
    ap.add_argument("--out", help="输出 HTML 路径")
    ap.add_argument("--open", action="store_true", help="渲染后打开浏览器")
    args = ap.parse_args()

    if not DATA.exists():
        raise SystemExit(f"缺少 {DATA}，请先运行 pipeline/build.py")

    jobs = json.loads(DATA.read_text(encoding="utf-8"))
    tpl = TPL.read_text(encoding="utf-8")
    total = len(jobs)

    if args.industry:
        inds = {s.strip() for s in args.industry.split(",")}
        jobs = [j for j in jobs if (j.get("industry") or "其他") in inds]
    if args.keyword:
        kw = args.keyword
        jobs = [j for j in jobs if kw in json.dumps(
            [j["company"], j.get("program") or "", j.get("positions") or []],
            ensure_ascii=False)]
    if args.days is not None:
        today = date.today()
        jobs = [j for j in jobs if j.get("deadline")
                and 0 <= (date.fromisoformat(j["deadline"]) - today).days <= args.days]

    if PLACEHOLDER not in tpl:
        raise SystemExit("模板中未找到数据占位符，模板格式可能已变更")

    html = tpl.replace(
        PLACEHOLDER,
        json.dumps(jobs, ensure_ascii=False, separators=(",", ":")),
    )

    out = Path(args.out) if args.out else OUT
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")

    # 统计（给 agent / 终端汇报用）
    by_ind: dict[str, int] = {}
    for j in jobs:
        k = j.get("industry") or "其他"
        by_ind[k] = by_ind.get(k, 0) + 1
    urgent = sorted(
        (j for j in jobs if j.get("deadline")
         and 0 <= (date.fromisoformat(j["deadline"]) - date.today()).days <= 7),
        key=lambda j: j["deadline"])
    latest = sorted(
        (j for j in jobs if j.get("first_seen")),
        key=lambda j: j["first_seen"], reverse=True)[:10]

    print(f"数据 {total} 条，筛选后 {len(jobs)} 条")
    print("行业分布:", "、".join(f"{k}×{v}" for k, v in
                             sorted(by_ind.items(), key=lambda x: -x[1])))
    n_url = sum(1 for j in jobs if j.get("apply_url"))
    print(f"带投递直链 {n_url} 条")
    if urgent:
        print(f"\n⏰ 7天内截止（{len(urgent)}条）:")
        for j in urgent[:15]:
            print(f"  {j['deadline']} {j['company']}")
    print("\n🆕 最新收录:")
    for j in latest:
        print(f"  {j['first_seen']} {j['company']}"
              f"（{j.get('industry') or '其他'}·{j.get('batch')}）")
    print(f"\n页面: {out}")

    if args.open:
        webbrowser.open(out.as_uri())


if __name__ == "__main__":
    main()
