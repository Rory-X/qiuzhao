# 秋招工作区归档清单

2026-10-12 将现有秋招工作区整合到 [Rory-X/qiuzhao](https://github.com/Rory-X/qiuzhao)。原目录保留，本仓库中的副本作为统一维护入口。

| 原工作区 | 仓库位置 | 内容与维护状态 |
| --- | --- | --- |
| `proj/qiuzhao` | 根目录与 `workbench/` | 当前秋招手册、面试训练、简历经历整理、Agent 工程研究和作品集工作台 |
| `proj/SPACES/qiuzhao-live` | `qiuzhao-live/` | 当前岗位聚合管线、公开岗位数据与 Logo 快照、模板、MCP 客户端及本地 mock 测试 |
| `proj/SPACES/research` | `research/` | 京东测评与国央企笔试调研，保留来源和置信度说明 |
| `proj/SPACES/xixicc2027` | `archive/xixicc2027/` | 上游 [xixicc186/xixicc2027](https://github.com/xixicc186/xixicc2027) 的旧站副本和本地调研，作为历史基线 |
| `proj/SPACES/xixicc2027-fork-spike` | `archive/xixicc2027-fork-spike/` | 旧站的采集器验证、合并/发布实现、诊断报告、`out/` 与 `week/` 样例快照；保留与旧站相邻的目录关系 |
| `proj/SPACES/qiuzhao-live-*.png`、`xixicc2027-deployed.png` | `docs/assets/screenshots/` | 2026-09-22 已有站点截图 |
| `Documents/Fool/Fool/autumn-recruitment-playbook.md` | `archive/materials/autumn-recruitment-playbook-2026-09-01.md` | 旧手册历史副本，以根目录的新版为准 |

## 使用与边界

- 工作台和刷新脚本默认读取仓库内的 `qiuzhao-live/`；`QIUZHAO_LIVE_DIR` 可覆盖该位置。
- `qiuzhao-live/data/jobs.json` 与公司 Logo 是公开来源的导入快照：1281 条岗位，数据源最新活跃日期为 2026-10-11。刷新后由管线重新生成，仓库整理日期不代表数据源更新时间。
- `archive/` 中的数据、上游 README 和诊断结论保留原记录，不作为当前招聘状态依据。采集实验仍可在其目录中按原说明运行。
- 工作台的个人求职状态、雷达同步报告、API key、原始数据库缓存、日志、依赖、编译产物和浏览器验证记录留在本地，不进入 Git。
- 作品集涉及的 e-pi、DSH、xuu、简历助手等独立产品保留原仓库；这里收录已有项目分析、经历材料和链接。
- 原机器的 LaunchAgent 与任务调度不随仓库自动安装。启动、刷新和校验命令见根目录及各子项目的 README。
