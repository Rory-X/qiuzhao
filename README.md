# 秋招项目工作区

秋招准备材料、个人工作台、岗位聚合管线与历史验证实验的统一项目。完整来源与目录对应关系见 [工作区清单](./WORKSPACES.md)。

## 项目结构

| 目录 | 用途 |
| --- | --- |
| [workbench/](./workbench/) | React + TypeScript 秋招工作台与本地状态服务 |
| [qiuzhao-live/](./qiuzhao-live/) | 多源岗位聚合、公司 Logo 同步与独立招聘站 |
| [research/](./research/) | 京东测评、国央企笔试和行测题型调研 |
| [archive/xixicc2027/](./archive/xixicc2027/) | 旧版秋招信息站、原始数据快照和 qiuzhao-feed Skill |
| [archive/xixicc2027-fork-spike/](./archive/xixicc2027-fork-spike/) | 采集、合并、发布管线的验证实验与诊断报告 |
| [archive/materials/](./archive/materials/) | 2026-09-01 的旧版手册，保留作历史参考 |
| [docs/assets/screenshots/](./docs/assets/screenshots/) | 已有站点截图 |

## 秋招作战材料

| 文件 | 用途 |
| --- | --- |
| [agent-observability-evaluation-roadmap.md](./agent-observability-evaluation-roadmap.md) | Agent 可观测性与评测学习路线、官方案例、12 个业务用例和实验口径 |
| [resume-project-profile.md](./resume-project-profile.md) | 简历项目与实习提取、成长路线、指标待核对项及下一步优先级 |
| [autumn-recruitment-playbook.md](./autumn-recruitment-playbook.md) | 主手册：节奏、简历、投递、笔试、AI/Vibe 面试、三类岗位 JD/面经 |
| [interview-qa-bank.md](./interview-qa-bank.md) | 可背答案：上下文压缩、生产 ReAct、失败/取消/评测 |
| [coding-agent-base.md](./coding-agent-base.md) | 手搓 Coding Agent 基座的工程与面试清单 |
| [workbench/](./workbench/) | Vite 秋招工作台：今日作战、机会池、投递流水线、面试训练、材料清单 |

权威副本以本目录为准；`archive/materials/` 中的旧版手册不再维护。

## 工作台

需要 Node.js 20.19+（或 22.12+）以及 Python 3.10+。本机服务只绑定 `127.0.0.1`，状态写在 `workbench/data/state.json`。

```bash
git clone https://github.com/Rory-X/qiuzhao.git
cd qiuzhao/workbench
npm ci
npm run dev
# 打开 http://127.0.0.1:5173
```

仓库包含 1281 条公开岗位数据快照，数据源最新活跃日期为 2026-10-11；最新岗位须运行刷新脚本获取。以下命令在 `workbench/` 目录执行：

```bash
python3 scripts/refresh_job_radar.py
npm run build
npm start
# 打开 http://127.0.0.1:8765
```

岗位聚合站也可独立运行：在仓库根目录执行 `cd qiuzhao-live && ./refresh.sh`，访问 `http://127.0.0.1:8901`。可选数据源凭证配置见 [岗位聚合站说明](./qiuzhao-live/README.md)。

个人投递、任务、训练记录、API key、日志、依赖及构建产物由 `.gitignore` 排除；本地已有数据会保留。历史快照和调研中的数量、截止日期、服务状态均以原记录日期为准。

## 校验

```bash
cd workbench
npm run check
npm run build
cd ../qiuzhao-live
python3 tests/test_xjradar_client.py
python3 pipeline/render.py
```

## 下一步（按这个顺序）

1. **先收敛主案例与个人证据**：按 [简历项目资产与成长路线](./resume-project-profile.md) 核对职责与指标，选三个主案例；优先在现有 Agent 项目做一个可测量的工程闭环。需要补独立实现能力时，再按 `coding-agent-base.md` §12 做最小基座练习。
2. **补过程证据，不补第三个 Demo**：评测曲线、一次取消/UNKNOWN 演练、一篇「为什么不做多 Agent」的 ADR。对照 `interview-qa-bank.md` §7。
3. **投递仍走官网 JD**：用 xixicc2027 / 官网核验，A/B/C 分层，人工投。不要上 BOSS 无人值守海投。
4. **补齐精投输入**：真实目标 JD，以及已有经历资产卡中的个人职责、结果证据与待核对指标；项目初版资产卡已从简历截图提取。
5. **题库 §8 其余项按需补**：召回验证、K8s 多租户、成本延迟、RAG vs NL2SQL——有对口 JD 再写，不要先堆百科。

## 项目作品集

从工作台侧栏「项目作品集」进入，或直接访问 `/projects`。包含 6 个独立详情页，采用统一的极简布局，支持深浅主题与移动端。

- 内容与仓库链接：`workbench/src/portfolio/projects.ts`
- 每个项目预留 3 张真实截图，场景建议见 [项目截图清单](./project-screenshot-guide.md)。
- 截图放入 `workbench/src/assets/project-shots/`，按 `<slug>-01.png` 等命名即可；无需改组件。
- 作品集不依赖工作台状态 API，可用 `npm run preview` 单独预览构建产物。现有服务上直接访问 `http://127.0.0.1:8765/projects`。
- 项目资料依据 2026-09-22 的公开 README 整理；没有虚构贡献比例、用户量或性能收益。

技术深度内容位于 `workbench/src/portfolio/caseStudies.ts`：6 个项目共 14 个难点案例，按难点、设计选择、取舍与边界组织。[技术案例依据](./project-technical-evidence.md) 记录来源与核验范围。研究方案保持显式标记，不作为已上线成果或个人独立贡献证明。

全部项目现已接入统一的“实践历程”区块。其余五个项目新增 15 个提交阶段，连同 xuu 共 21 个阶段，数据位于 `workbench/src/portfolio/projectJourneys.ts`。详见 [五个项目的实践历程](./project-practice-journeys.md)。公开源码链接已按具体 commit 验证；时间采用作者日期，不作为发布或上线日期。

xuu 详情页新增 Coding Agent 模块解法索引：按 12 个实现模块拆解 24 个真实提交问题，并给出成因、代码解法、取舍和验证依据。可阅读独立的 [xuu Coding Agent 模块研究](./xuu-coding-agent-modules.md)，缓存与评测分别见 [缓存专题](./xuu-cache-design.md) 和 [评测能力](./xuu-evaluation-capabilities.md)。
