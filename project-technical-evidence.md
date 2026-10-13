# 项目技术案例依据

核对日期：2026-09-22。此次只修改作品集，未修改或重新测试来源项目。实现核对指检查相关源码分支；文档记录的历史测试不等于此次执行。

## E-Pi

### 高频终端输出，如何避免每一帧都复制整段历史？

- 范围：实现核对
- 来源：[src/lib/terminalReplayBuffer.ts](https://github.com/JustGenius-s/e-pi/blob/master/src/lib/terminalReplayBuffer.ts)
- 本地来源：/Users/jiahaoqian/proj/e-pi/src/lib/terminalReplayBuffer.ts
- 依据：已核对 terminalReplayBuffer.ts 的分段存储、惰性拼接与 awaitingCheckpoint 分支。性能计划中的目标耗时不作为已验证收益展示。

### 窗口缩放时，旧画面和新终端尺寸如何交接？

- 范围：设计研究
- 来源：[docs/plan-terminal-performance.md](https://github.com/JustGenius-s/e-pi/blob/master/docs/plan-terminal-performance.md)
- 本地来源：/Users/jiahaoqian/proj/e-pi/docs/plan-terminal-performance.md
- 依据：依据终端性能实施计划整理，作为渲染流水线的设计取舍；不宣称整份优化计划已全部完成。

## DSH-Desktop

### 服务重启，为什么会导致整个桌面应用闪退？

- 范围：实现核对
- 来源：[docs/restart-service-crash-2026-09-15.md](https://github.com/JustGenius-s/DSH-Desktop/blob/main/docs/restart-service-crash-2026-09-15.md)
- 本地来源：/Users/jiahaoqian/proj/DSH-Desktop/docs/restart-service-crash-2026-09-15.md
- 依据：源码包含 generation 与双重销毁检查。2026-09-15 复盘记录：修复前隔离探针退出码 139，修复后连续完成 40 轮；这是历史记录，并非本次重新压测。

### 更新能力放在插件还是桌面壳？

- 范围：仓库文档
- 来源：[docs/desktop-api.md](https://github.com/JustGenius-s/DSH-Desktop/blob/main/docs/desktop-api.md)
- 本地来源：/Users/jiahaoqian/proj/DSH-Desktop/docs/desktop-api.md
- 依据：桌面 API 文档明确区分 updates / seats / notify / overlays，以及“检测在插件，执行在壳”的迁移边界。

## Fogot

### 长任务如何继续，同时保留关键工具上下文？

- 范围：实现核对
- 来源：[editor/ai/chat-ui/src/ai/compaction.ts](https://github.com/JustGenius-s/Fogot/blob/main/editor/ai/chat-ui/src/ai/compaction.ts)
- 本地来源：/Users/jiahaoqian/proj/Fogot/editor/ai/chat-ui/src/ai/compaction.ts
- 依据：已核对 context-budget.ts 与 compaction.ts。源码说明参考了 opencode 的两层策略，展示的是在编辑器中的集成实践。

### 如何把“改场景”变成可执行的编辑器动作？

- 范围：仓库文档
- 来源：[README.md](https://github.com/JustGenius-s/Fogot/blob/main/README.md)
- 本地来源：/Users/jiahaoqian/proj/Fogot/README.md
- 依据：仓库列出了场景节点、信号、骨骼等工具及 C++ / React 分层；不将 Godot 原有引擎能力作为独立原创成果。

## intro-builder

### AI 改完简历，用户如何看懂变化并撤回？

- 范围：实现核对
- 来源：[docs/superpowers/specs/2026-06-25-resume-version-diff-undo-redo-design.md](https://github.com/Rory-X/intro-builder/blob/main/docs/superpowers/specs/2026-06-25-resume-version-diff-undo-redo-design.md)
- 本地来源：/Users/jiahaoqian/proj/intro-builder/docs/superpowers/specs/2026-06-25-resume-version-diff-undo-redo-design.md
- 依据：已核对 use-resume-history.ts、resume-diff.ts、版本表迁移及相关测试文件。历史栈上限 50，连续输入合并窗口 2 秒。

### 多用户、多个标签页，如何避免新简历会话串线？

- 范围：设计研究
- 来源：[docs/superpowers/specs/2026-06-13-agent-security-session-boundary-design.md](https://github.com/Rory-X/intro-builder/blob/main/docs/superpowers/specs/2026-06-13-agent-security-session-boundary-design.md)
- 本地来源：/Users/jiahaoqian/proj/intro-builder/docs/superpowers/specs/2026-06-13-agent-security-session-boundary-design.md
- 依据：依据 Agent Security and Session Boundary Design。该案例展示设计约束，未在本次逐项核验所有安全分支。

## r-api

### 请求超时了，真的可以换一个渠道再发吗？

- 范围：实现核对
- 来源：[src/server/services/proxyRetryContract.ts](https://github.com/Rory-X/r-api/blob/main/src/server/services/proxyRetryContract.ts)
- 本地来源：/Users/jiahaoqian/Documents/Codex/2026-08-03/zoo-aiiipm-ios-cc-git-https/work/metapi-research/src/server/services/proxyRetryContract.ts
- 依据：已核对 proxyRetryContract.ts 的 canRetryLocally，以及请求账本运行时与 unknown 状态测试。未将代码分支核对等同于线上故障演练。

### 人工接管与自动续跑，谁有权推进同一个会话？

- 范围：实现核对
- 来源：[docs/local-connector.md](https://github.com/Rory-X/r-api/blob/main/docs/local-connector.md)
- 本地来源：/Users/jiahaoqian/Documents/Codex/2026-08-03/zoo-aiiipm-ios-cc-git-https/work/metapi-research/docs/local-connector.md
- 依据：Local Connector 协议描述了人工 Prompt 与续跑的统一状态机；实现中有 dispatch_outcome_unknown 分支及对应测试。

### 离线后补发，如何避免通知和回执重复推进状态？

- 范围：仓库文档
- 来源：[docs/local-connector.md](https://github.com/Rory-X/r-api/blob/main/docs/local-connector.md)
- 本地来源：/Users/jiahaoqian/Documents/Codex/2026-08-03/zoo-aiiipm-ios-cc-git-https/work/metapi-research/docs/local-connector.md
- 依据：协议同时约束本地队列、确认删除、结果优先级与服务端 deliveryId 唯一性，通知复用 Durable Outbox。

### 清理日志之后，成本报表为什么会“少一截”？

- 范围：设计研究
- 来源：[docs/research/operations-governance-gap-analysis.md](https://github.com/Rory-X/r-api/blob/main/docs/research/operations-governance-gap-analysis.md)
- 本地来源：/Users/jiahaoqian/Documents/Codex/2026-08-03/zoo-aiiipm-ios-cc-git-https/work/metapi-research/docs/research/operations-governance-gap-analysis.md
- 依据：2026-08-18 治理差距分析提出的演进方案。本页保留“设计研究”标识，不将归档、时间窗配额与完整告警闭环声称为全部上线。

## xuu

### 多个 Agent 协作，如何避免任务跑到错误的项目？

- 范围：仓库文档
- 来源：[docs/en/desktop/collaboration.md](https://github.com/Rory-X/xuu/blob/main/docs/en/desktop/collaboration.md)
- 本地来源：直接读取 Rory-X/xuu 公开仓库；没有以本机上游 wuu 代替该仓库
- 依据：已直接核对 Rory-X/xuu 的 Collaboration 文档；本机同名 wuu 目录属于上游仓库，未据此归属个人贡献。

### 任务已接收、某轮已结束，是否等于整个任务完成？

- 范围：仓库文档
- 来源：[docs/en/automation/app-server.md](https://github.com/Rory-X/xuu/blob/main/docs/en/automation/app-server.md)
- 本地来源：直接读取 Rory-X/xuu 公开仓库；没有以本机上游 wuu 代替该仓库
- 依据：app-server 文档明确要求初始化、运行准入、终态等待与显式中断，并区分 run 与 turn。


## xuu 深挖补充 · 2026-09-23

新增[提交与代码实践历程](./xuu-practice-journey.md)，以 `44a00fe2edab0a966dd62f7e3b23271bf3ce0136` 为读取基线，沿 9 个提交整理 6 条演进线。源码链接固定到对应 commit；不把后续修改追溯为历史版本已经具备的行为，也不把仓库历史自动归于个人。

## 其余项目实践历程 · 2026-09-23

新增 [五个项目的提交与设计实践历程](./project-practice-journeys.md)，各选 3 个阶段，共 15 个。引用文件均核对历史 Git 对象及公开可访问性。E-Pi 部分提交来自 Rory-X/e-pi；intro-builder 自动保存采用公开分支 fc9d1444，不推断已合入主线。此前本地 99b5dbcd / 12fcc68a 不作为公开时间线引用。
