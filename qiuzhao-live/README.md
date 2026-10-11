# qiuzhao-live · 秋招信息实时聚合站

用**活跃数据源**重建的 2027 届秋招信息站，输出与原 `xixicc2027` 一致的喜茶风格可交互页面。

## 为什么重建

上游 `xixicc2027` 的数据是**假更新**：README 写「每日更新 2026-09-22」，但 `jobs.json` 最后真实改动是 **2026-09-03**，自 09-04 起连续 18 次提交只改 README 里那一行时间戳；数据内 `last_seen` 最新只到 **2026-07-16**（8、9 月新增 0 条）。

本项目改接**经审计确认真实在更新**的数据源。

## 数据源

| 源 | 内容 | 更新情况 |
|---|---|---|
| [ruyi1/campus-radar](https://github.com/ruyi1/campus-radar) `data/jobs.db` | 京东/快手/小红书/拼多多/淘天/OfferStar，**1797 条岗位、965 家公司，全部带投递直链** | 每日 GitHub Actions，`last_seen` 持续刷新 |
| 龙哥27届秋招汇总表 | 腾讯文档 smartsheet，**187 家**，含工作地点 / 截止时间 / 内推码 | 公开 API，零凭据可拉 |
| [campus-jobs-radar MCP](https://github.com/setozjl/campus-jobs-radar-mcp)（可选） | 国央企校招，声称 4145 条 / 24 个官方源 | **需 API key**，见下 |

龙哥表抓取原理见 `sources/longge_fetch.py`：页面是 canvas 渲染，但底层有
`docs.qq.com/dop-api/get/sheet` 返回 base64+zlib 压缩的 JSON，解包即得全表。

### 国央企源（可选，需 API key）

`mcp.xjradar.com` 是国央企校招的结构化 MCP 服务，**免费 key 需用微信扫码**
在 [xjradar.com](https://xjradar.com) 获取（10 次/天，永久有效；¥29 赛季版 500 次/天）。

```bash
./set-xjradar-key.sh          # 交互式录入 key（不回显），写入 ~/.config/xjradar/api-key (600)
./set-xjradar-key.sh --check  # 查看状态并验证连通性

# 也可直接用命令行查询
python3 sources/xjradar_mcp.py --check          # 工具清单
python3 sources/xjradar_mcp.py --stats          # 数据总览
python3 sources/xjradar_mcp.py --deadlines 14   # 未来 14 天截止
python3 sources/xjradar_mcp.py --search --city 深圳 --major 计算机
python3 sources/xjradar_mcp.py --new 3          # 近 3 天动态
```

配置好 key 后，`pipeline/build.py` 会**自动**并入该源；无 key 或端点不可达时安静跳过，
不影响其它源。

**⚠️ 2026-09-22 实测：该端点在本网络环境下不可达。**
`xjradar.com` / `mcp.xjradar.com` 均解析到 `198.23.244.253`（美国 HostPapa），
TCP 443 可建连，但 **TLS 握手立即被 RST**（`unexpected eof while reading`），
换 TLS1.2、去 SNI、改 UA、走两条独立网络路径均失败；同期 cloudflare/vercel 等
其他境外站点正常。同一端点在**本次会话早些时候（约 16:30）曾成功调用**
（`tools/list` 正常返回 5 个工具），故判断为链路侧的间歇性 TLS 阻断，非服务下线、
也非本机配置问题。因此**该源的"每日刷新"声称仍未经独立验证**。

## 快速开始

```bash
./refresh.sh              # 拉数据 + 归一化 + 渲染 + 起服务（8901）
./refresh.sh 9000         # 指定端口
./refresh.sh --no-serve   # 只生成页面
```

单步执行：

```bash
python3 pipeline/build.py     # 多源 → data/jobs.json（归一化 + 去重 + 分类）
python3 pipeline/render.py    # data/jobs.json → dist/index.html
python3 pipeline/render.py --industry 互联网 --keyword 算法   # 过滤后渲染
python3 pipeline/render.py --days 14                          # 只看 14 天内截止
```

测试（不需要外网 / 真实 key，用本地 mock 端点）：

```bash
python3 tests/test_xjradar_client.py    # MCP 客户端 12 项自测
python3 tests/mock_xjradar.py           # 单独起 mock 端点（8977）
```

## 目录

```
pipeline/build.py     归一化管线：多源 → 统一 schema
pipeline/render.py    渲染：注入喜茶模板 → dist/index.html
sources/              各数据源抓取器
  longge_fetch.py     龙哥表抓取（腾讯文档公开 API）
  xjradar_mcp.py      国央企 MCP 客户端（标准库实现 initialize/tools/list/tools/call）
templates/heytea.html 前端模板（数据占位符 /*__DATA__*/[]）
tests/                mock MCP 端点 + 客户端自测
data/jobs.json        归一化产物
data/raw/             源数据缓存
dist/index.html       可浏览页面
set-xjradar-key.sh    录入国央企 MCP 的 API key
refresh.sh            一键刷新
```

## 统一 schema

与原 `xixicc2027` 对齐，模板无需改动：

```jsonc
{
  "company": "腾讯", "cohort": "2027届", "batch": "正式批",
  "program": null, "industry": "互联网",
  "positions": ["算法", "开发"], "announcement": "…公告原标题…",
  "locations": ["深圳", "北京"], "apply_url": "https://…",
  "deadline": "2026-11-30", "campus_only": true,
  "first_seen": "2026-09-22", "last_seen": "2026-09-22",
  "confirmed_by": 2,
  "logo_path": "logos/si-xiaohongshu.svg",
  "logo_source": "simple-icons:xiaohongshu"
}
```

## 公司 Logo 同步

`pipeline/build.py` 会在岗位归一化后同步公司 Logo，并缓存到 `data/logos/`：

1. 精确匹配 Simple Icons 的品牌使用本地缓存 SVG；
2. 已人工确认官网域名的公司，从官网发现并缓存 favicon；
3. 无法可靠确认的公司不做模糊匹配，交给前端显示双字简称。

映射结果记录在 `data/logo_manifest.json`，岗位条目写入 `logo_path` 与
`logo_source`。如设置 `LOGO_DEV_PUBLISHABLE_KEY`，长尾公司会额外使用
Logo.dev 公司名查询；未设置时不影响正常刷新。

## 管线做的清洗

- **合并去重**：按规范化公司名合并两源，`confirmed_by` 记录交叉确认渠道数
- **行业分类**：两级判定（精确表优先 → 关键词），解决「中信出版」因"中信"落入金融这类误判
- **岗位名清洗**：聚合源的「岗位」字段实际是推文标题（如「BOSS 直聘 2027 届校园招聘启动啦！」），公告文案移入 `announcement`，并从标题括号内/顿号分隔处抽取真实岗位
- **截止日规范化**：`9.30日截止`/`11.30日` → `YYYY-MM-DD`；`招完即止`/`尽快投递` 等语义文本 → `null`（归入「截止待定」）
- **已过期截止日不展示**：提前批已截止的（7.27/7.31/8.07）置 `null`，避免负数倒计时
- **诚实标注**：龙哥表无可靠首见日期，`first_seen` 置 `null` 并显示为「收录日期未知」，而非灌水成「今日新收录」

## 前端行为

- 默认按**收录日期**分组（因为 99% 的条目没有明确截止日，按截止日期会全挤进一组）
- 支持**关键词搜索**（公司/岗位/地点）、行业筛选、只看 2027 届
- **XSS 防护**：所有外源文本经 HTML 转义；`apply_url` 只放行 `http(s)://`，挡掉 `javascript:` 伪协议，非 http(s) 的链接降级为不可点击卡片
- GSAP 缺席时自动降级为 IntersectionObserver，模板零外部依赖

## 已知限制

- **截止日期覆盖率极低**：上游数据本身不含未来截止日（龙哥表「截止时间」列 99% 是「尽快投递/招完即止」），仅 1 条有明确日期。这是数据源的真实状态。
- **`apply_url` 覆盖 960/1066**：龙哥表的「内推链接」列当前为空，这 106 条无直链，卡片提示搜官方公众号。
- 行业分类基于公司名规则，长尾公司（303 条）仍归「其他」。
