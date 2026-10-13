#!/usr/bin/env python3
"""xixicc2027 发布端：把 jobs.json 渲染成 README.md + index.html。

本文件的 render_readme() 已通过字节级验证：对仓库现有 jobs.json 渲染出的
README 与线上 README.md **完全一致**（见 verify_readme.py）。

这证明：原项目的发布端是 jobs.json 的确定性纯函数 —— 只要给它新鲜数据，
它就能产出正确的 README 和站点。所以 fork 后无需重写发布端。
"""
import json

ORDER = ["互联网", "游戏", "半导体/硬件", "新能源车企", "传统车企", "外企",
         "快消/零售", "医药/生物", "银行/金融", "制造业", "其他",
         "军工/研究所", "高校/事业单位", "央国企"]

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

SITE_PLACEHOLDER = "/*__DATA__*/[]"


def _cell(v, default="-", cap=None):
    """单元格渲染：空值给 '-'；列表按 cap 截断后以 '、' 连接。"""
    if v is None or v == "" or v == []:
        return default
    if isinstance(v, str):
        return v
    return "、".join(v[:cap] if cap else v)


def render_readme(jobs, updated):
    """jobs -> README markdown。与线上 README 字节级一致（同输入下）。"""
    vis = [j for j in jobs if not j.get("campus_only")]
    by = {k: [] for k in ORDER}
    for j in vis:
        by.setdefault(j["industry"], []).append(j)

    out = ["# 2027届秋招信息汇总", "",
           f"> 自动聚合，每日更新 ｜ 更新时间：{updated} ｜ 共 {len(vis)} 条",
           ">",
           "> ✅×N = 多个渠道交叉确认 ｜ ⏰ = 7 天内截止 ｜ "
           "[在线浏览页面](https://xixicc186.github.io/xixicc2027/)",
           ""]
    out.extend(PREAMBLE)
    out.append("")
    toc = " · ".join(
        f"[{k}](#{k.replace('/', '')}{len(by[k])})" for k in ORDER if by[k])
    out.append(f"**目录：** {toc}")
    out.append("")

    from datetime import date
    today = date.fromisoformat(updated[:10])
    for k in ORDER:
        rows = by[k]
        if not rows:
            continue
        out += [f"## {k}（{len(rows)}）", "",
                "| 公司 | 项目 | 届别 | 批次 | 岗位方向 | 地点 | 截止 | 投递 |",
                "|---|---|---|---|---|---|---|---|"]
        for j in rows:
            name = j["company"]
            if (j.get("confirmed_by") or 1) > 1:
                name += f" ✅×{j['confirmed_by']}"
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
            out.append(
                f"| {name} | {_cell(j.get('program'))} | {_cell(j.get('cohort'))} | "
                f"{_cell(j.get('batch'))} | {_cell(j.get('positions'), cap=4)} | "
                f"{_cell(j.get('locations'), cap=4)} | {dl} | {apply_} |")
        out.append("")

    out += ["---", "",
            "数据来源：公开渠道自动聚合 + LLM 提取 + 多渠道交叉校验。"
            "信息可能滞后或有误，投递前请以官方渠道为准。"]
    return "\n".join(out) + "\n"


def render_site(jobs, template_text):
    """jobs + 喜茶模板 -> 完整 index.html（复刻原项目注入方式）。"""
    if SITE_PLACEHOLDER not in template_text:
        raise SystemExit("模板中未找到数据占位符，模板格式可能已变更")
    return template_text.replace(
        SITE_PLACEHOLDER, json.dumps(jobs, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    import argparse
    from pathlib import Path
    ap = argparse.ArgumentParser(description="渲染 README.md 与 index.html")
    ap.add_argument("--jobs", default="jobs.json")
    ap.add_argument("--template", default="site_template_heytea.html")
    ap.add_argument("--updated", default=None, help="更新时间，默认取今天 00:00")
    ap.add_argument("--outdir", default=".")
    a = ap.parse_args()

    from datetime import date
    updated = a.updated or f"{date.today().isoformat()} 00:00"
    jobs = json.loads(Path(a.jobs).read_text(encoding="utf-8"))
    d = Path(a.outdir)
    d.mkdir(parents=True, exist_ok=True)

    (d / "README.md").write_text(render_readme(jobs, updated), encoding="utf-8")
    tpl = Path(a.template).read_text(encoding="utf-8")
    (d / "index.html").write_text(render_site(jobs, tpl), encoding="utf-8")
    print(f"✅ 已渲染 README.md + index.html（{len(jobs)} 条，更新时间 {updated}）")
