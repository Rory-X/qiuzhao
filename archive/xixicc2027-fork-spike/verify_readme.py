#!/usr/bin/env python3
"""验证能否字节级复现 xixicc2027 的 README（证明完全掌握发布端 pipeline）。

若本脚本输出 == 仓库 README.md，则说明：
  README 是 jobs.json 的确定性纯函数（固定行业枚举 + 固定行格式）
  => 发布端每天都在跑，只是输入（jobs.json）自 07-17 起没再更新。
"""
import json
import re
import sys
from datetime import date

ORDER = ["互联网", "游戏", "半导体/硬件", "新能源车企", "传统车企", "外企",
         "快消/零售", "医药/生物", "银行/金融", "制造业", "其他",
         "军工/研究所", "高校/事业单位", "央国企"]

# README 第 7~41 行的固定前言（Agent Skill 介绍段），与 jobs.json 无关
PREAMBLE = """## 🤖 Agent Skill：qiuzhao-feed

本仓库自带一个 [Agent Skill](skill/qiuzhao-feed/SKILL.md)，装到 Claude Code（或任何支持 skill 的 agent）里之后，对 agent 说一句「看看最新秋招」，它就会自动抓取本仓库的最新数据、渲染成网页并在浏览器打开。

**它有什么用：**

- 📥 **数据永远最新** — 每次都从本仓库实时拉取 `jobs.json`，不存在本地过期缓存
- 🖥️ **一句话出页面** — 自动注入前端模板生成可交互网页，按时间轴浏览全部秋招信息
- 🔍 **按需过滤** — 支持按行业（互联网/央国企/银行金融…）、关键词（公司名/岗位）、截止天数筛选，比如「看看互联网里有算法岗的」「哪些 7 天内截止」
- 📋 **顺手出简报** — 终端同时输出统计：行业分布、临期清单、最新收录，agent 可直接整理成日报

**安装**（复制粘贴执行，只有两个文件，纯 Python 标准库，无需装依赖）：

```bash
mkdir -p ~/.claude/skills/qiuzhao-feed/scripts
curl -fsSL https://raw.githubusercontent.com/xixicc186/xixicc2027/main/skill/qiuzhao-feed/SKILL.md -o ~/.claude/skills/qiuzhao-feed/SKILL.md
curl -fsSL https://raw.githubusercontent.com/xixicc186/xixicc2027/main/skill/qiuzhao-feed/scripts/fetch_render.py -o ~/.claude/skills/qiuzhao-feed/scripts/fetch_render.py
```

**使用**：装好后在 Claude Code 里直接说自然语言即可触发，例如：

- 「看看最新秋招」「打开秋招页面」
- 「互联网有哪些在招的」「看看央国企的秋招」
- 「哪些公司快截止了」「有算法岗的秋招」

不用 agent 也能单独跑脚本：

```bash
python3 ~/.claude/skills/qiuzhao-feed/scripts/fetch_render.py                    # 全量渲染并打开浏览器
python3 ~/.claude/skills/qiuzhao-feed/scripts/fetch_render.py --industry 互联网   # 只看某行业
python3 ~/.claude/skills/qiuzhao-feed/scripts/fetch_render.py --keyword 算法      # 关键词过滤
python3 ~/.claude/skills/qiuzhao-feed/scripts/fetch_render.py --days 7           # 只看 7 天内截止
```

---""".split("\n")


def cell(v, default="-", cap=None):
    if v is None or v == "" or v == []:
        return default
    if isinstance(v, str):
        return v
    items = v[:cap] if cap else v
    return "、".join(items)


def render(jobs, updated="2026-09-22 00:00"):
    vis = [j for j in jobs if not j.get("campus_only")]
    by = {k: [] for k in ORDER}
    for j in jobs:
        if j.get("campus_only"):
            continue
        by.setdefault(j["industry"], []).append(j)

    out = []
    out.append("# 2027届秋招信息汇总")
    out.append("")
    out.append(f"> 自动聚合，每日更新 ｜ 更新时间：{updated} ｜ 共 {len(vis)} 条")
    out.append(">")
    out.append("> ✅×N = 多个渠道交叉确认 ｜ ⏰ = 7 天内截止 ｜ "
               "[在线浏览页面](https://xixicc186.github.io/xixicc2027/)")
    out.append("")
    out.extend(PREAMBLE)
    out.append("")
    # 目录（锚点去掉斜杠）
    toc = " · ".join(
        f"[{k}](#{k.replace('/', '')}{len(by[k])})" for k in ORDER if by[k])
    out.append(f"**目录：** {toc}")
    out.append("")

    today = date.fromisoformat(updated[:10])
    for k in ORDER:
        rows = by[k]
        if not rows:
            continue
        out.append(f"## {k}（{len(rows)}）")
        out.append("")
        out.append("| 公司 | 项目 | 届别 | 批次 | 岗位方向 | 地点 | 截止 | 投递 |")
        out.append("|---|---|---|---|---|---|---|---|")
        for j in rows:
            name = j["company"]
            n = j.get("confirmed_by") or 1
            if n > 1:
                name += f" ✅×{n}"
            dl = j.get("deadline") or "-"
            if j.get("deadline"):
                try:
                    if 0 <= (date.fromisoformat(j["deadline"]) - today).days <= 7:
                        dl += " ⏰"
                except ValueError:
                    pass
            if j.get("apply_url"):
                apply_ = f"[网申链接]({j['apply_url']})"
            elif j.get("official_wechat"):
                apply_ = f"[公众号入口]({j['official_wechat']})"
            else:
                apply_ = "搜索官方公众号"
            out.append(f"| {name} | {cell(j.get('program'))} | {cell(j.get('cohort'))} | "
                       f"{cell(j.get('batch'))} | {cell(j.get('positions'), cap=4)} | "
                       f"{cell(j.get('locations'), cap=4)} | {dl} | {apply_} |")
        out.append("")

    out.append("---")
    out.append("")
    out.append("数据来源：公开渠道自动聚合 + LLM 提取 + 多渠道交叉校验。"
               "信息可能滞后或有误，投递前请以官方渠道为准。")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    jobs = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "jobs.json",
                         encoding="utf-8"))
    got = render(jobs)
    want = open("README.md", encoding="utf-8").read()
    if got == want:
        print("✅ 字节级完全一致 —— README 确为 jobs.json 的确定性渲染")
        sys.exit(0)
    print("❌ 不一致")
    gl, wl = got.split("\n"), want.split("\n")
    print(f"   行数 生成={len(gl)} 仓库={len(wl)}")
    diff = 0
    for i in range(max(len(gl), len(wl))):
        g = gl[i] if i < len(gl) else "<缺>"
        w = wl[i] if i < len(wl) else "<缺>"
        if g != w:
            diff += 1
            if diff <= 12:
                print(f"   L{i+1}\n     生成: {g[:150]}\n     仓库: {w[:150]}")
    print(f"   差异行总数: {diff}")
    sys.exit(1)
