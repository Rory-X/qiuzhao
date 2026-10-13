# 其余五个项目的提交与设计实践历程

核对日期：2026-09-23。基于本地仓库中的已提交对象与历史差异，未修改来源仓库，未运行来源测试。日期统一采用作者日期，不视为上线日期；作者字段不自动等同于个人独立贡献。仅对本次选取主题分析，不声称覆盖完整历史。

## e-pi

仓库：Rory-X/e-pi。读取基线：f2daf61dc3c94684329a58b49cd6f73010753755。

### 2026.08.08 · 从“有写入就等”改为识别大帧

**触发问题**：展开面板后终端出现黑边：持续的 spinner 小块输出让写队列一直非空，本地缩放因此被反复阻止。

**实现演进**：将本地重排的判断从是否存在待写入，改为待写入字节量；超过 4KB 才暂停本地重排，PTY 尺寸更新仍采用独立节奏。

**取舍**：区分小增量与完整重绘，才能兼顾即时跟随和解析一致性。4KB 是该版本的工程阈值，不是通用终端标准。

**核对范围**：xterm-resize-scheduler.test.ts 随提交调整大帧与小块输出场景；本次未重新执行终端性能测试。

- [f5e7e389](https://github.com/Rory-X/e-pi/commit/f5e7e389f42c554df7ed6bc7f0e0056a8dde05d2) · 作者字段：jiahaoqian · [历史源码](https://github.com/Rory-X/e-pi/blob/f5e7e389f42c554df7ed6bc7f0e0056a8dde05d2/src/lib/xtermResizeScheduler.ts)

### 2026.08.10 · 从缩放时序补丁走向明确的帧协议

**触发问题**：快速改变窗口尺寸时，新旧尺寸的 PTY 输出可能交错，仅靠延时无法判断哪一帧可以接替当前画面。

**实现演进**：桥接层在完整重绘前缀后写入不占终端格子的 APC 尺寸标记；解析结果区分 pending、untagged、invalid 和 tagged，并配合输出门控与视觉保护。

**取舍**：引入对 TUI 和桥接层的协议协作成本，换取可判断的帧归属；不能将任意到达的数据块都当成目标尺寸的完整画面。

**核对范围**：提交包含 resize protocol、output gate、visual guard 三组测试，以及 OSC52、重放缓冲与调度器回归。

- [1befcdf0](https://github.com/Rory-X/e-pi/commit/1befcdf06bb234fded7a0e9eb1faf615403eb603) · 作者字段：jiahaoqian · [历史源码](https://github.com/Rory-X/e-pi/blob/1befcdf06bb234fded7a0e9eb1faf615403eb603/src/lib/terminalResizeProtocol.ts)

### 2026.08.11 · 工作空间扩展后，文件操作也必须知道所属仓库

**触发问题**：一个项目关联多个仓库后，不同目录都可能出现 src 等相同路径；沿用单一根目录会让查找、展开和工作目录选择产生歧义。

**实现演进**：文件树变为多个根节点，使用绝对路径定位归属根，搜索结果在多根场景加仓库名；同一提交还稳定预览组件映射与回调，减少图片重新挂载闪动。

**取舍**：界面上的“一个项目”不再等于磁盘上的“一个目录”。显示名称可以聚合，但路径操作仍必须保持明确归属。

**核对范围**：file-tree.test.ts、project-workspace.test.ts 和桥接工作空间测试随提交新增；路径前缀使用目录分隔符避免同名前缀误匹配。

- [a84503d2](https://github.com/Rory-X/e-pi/commit/a84503d2eea51aea30ffbf706c0cacbf7f311e31) · 作者字段：jiahaoqian · [历史源码](https://github.com/Rory-X/e-pi/blob/a84503d2eea51aea30ffbf706c0cacbf7f311e31/src/lib/file-tree.ts)

## dsh-desktop

仓库：JustGenius-s/DSH-Desktop。读取基线：07edc9a5deef07da2871c1b1f9d80c17d8789030。

### 2026.08.24 · 插件更新后，不必退出整个桌面应用

**触发问题**：插件配置或 DSH 运行时更新只需要重载 Web 服务，重启 Electron 会同时中断桌面壳的使用体验。

**实现演进**：建立独立 Web 服务生命周期入口，菜单、IPC 与更新桥复用；通过网页弹窗确认重启，使用请求 ID、ACK 重试与超时处理提示送达。

**取舍**：原生壳继续运行不代表子服务任务无中断。用户选择稍后或网页未接住询问时，不强制执行重启。

**核对范围**：该提交可核对 dsh-lifecycle.ts 与主进程接线；没有据此宣称后来浮层崩溃问题已在此版本修复。

- [418b58f9](https://github.com/JustGenius-s/DSH-Desktop/commit/418b58f98901c9c3fd34ed304510668bd2cb1595) · 作者字段：jiahaoqian · [历史源码](https://github.com/JustGenius-s/DSH-Desktop/blob/418b58f98901c9c3fd34ed304510668bd2cb1595/src/dsh-lifecycle.ts)

### 2026.09.01 · 把更新策略迁出桌面壳

**触发问题**：检查发布版本、定时轮询与跳过版本属于更新策略；安装运行时和重启应用则依赖原生宿主，两类职责堆在一起使维护边界模糊。

**实现演进**：将检测迁到插件的 Node host，桌面桥只执行安装、下载入口和重启等动作；browser 半侧交换壳版本和执行结果。

**取舍**：这是这一历史提交的职责收缩，后续分支可能保留旧插件兼容层；不能用当时“删除检测”的描述断言所有现行路径都已删除。

**核对范围**：提交删除 app-updater.ts，并收缩 desktop-bridge 与 API；通过历史版本源码核对，不将删除行数作为质量指标。

- [04888a93](https://github.com/JustGenius-s/DSH-Desktop/commit/04888a9311665bb3115a961db52f76ae60166237) · 作者字段：JustGenius-s · [历史源码](https://github.com/JustGenius-s/DSH-Desktop/blob/04888a9311665bb3115a961db52f76ae60166237/src/desktop-bridge.ts)

### 2026.09.11 · 让冷启动保留浏览器偏好，同时清理过期 Cookie

**触发问题**：每次启动随机端口会改变 Origin，缩放等偏好随之失效；Cookie 却不按端口隔离，含旧端口的鉴权 Cookie 会不断积累。

**实现演进**：仅在成功启动后原子保存端口，下次可用则复用，被占用则另选；开发与安装版分别保存记录，加载前只清理 DSH 自己的回环鉴权 Cookie。

**取舍**：端口记录是 Chromium 邻接状态，不放进共享 DSH 配置。复用地址不等于接管占用该地址的未知进程，也不持久化带 token 的启动 URL。

**核对范围**：web-port.test.cjs 与 dsh-auth-cookies.test.cjs 随提交新增，分别覆盖端口记录与定向 Cookie 清理。

- [ac9ea4ba](https://github.com/JustGenius-s/DSH-Desktop/commit/ac9ea4bae62a84c85a835f7e30595111de10a0a5) · 作者字段：jiahaoqian · [历史源码](https://github.com/JustGenius-s/DSH-Desktop/blob/ac9ea4bae62a84c85a835f7e30595111de10a0a5/src/web-port.ts)

## fogot

仓库：JustGenius-s/Fogot。读取基线：5db79b4cd2b6d7267c172c1da8b48a892f59dff4。

### 2026.06.26 · 先为输出留空间，再决定如何压缩历史

**触发问题**：文件与场景工具结果不断进入对话，全部保留会挤占可用上下文；只看输入长度也会遗漏模型继续输出所需空间。

**实现演进**：独立预算函数从上下文窗口扣除预留输出空间，加入工具输出裁剪、锚定摘要与上下文管理，并接入主界面。

**取舍**：摘要和裁剪都有信息损失；预算管理解决容量约束，不保证长任务永远保留全部细节。此提交也不能证明固定比例的性能提升。

**核对范围**：核对 context-budget.ts 的 usableContext 和 compaction.ts；该提交未新增独立测试文件，本次只做实现阅读。

- [d56d3aff](https://github.com/JustGenius-s/Fogot/commit/d56d3aff30e5e96571cda4bf7783d03459bcfda3) · 作者字段：justgenius · [历史源码](https://github.com/JustGenius-s/Fogot/blob/d56d3aff30e5e96571cda4bf7783d03459bcfda3/editor/ai/chat-ui/src/ai/context-budget.ts)

### 2026.07.07 · 让无效设计文档在写入前失败

**触发问题**：模型生成的设计文档可能缺少 frontmatter、YAML 语法错误或必填字段，宽松解析会让资产列表出现损坏条目。

**实现演进**：write_design 在读取旧内容和写入之前检查 frontmatter 起止、YAML mapping 及 name/type，返回可供模型修正的明确错误。

**取舍**：格式检查只是一层准入，不能替代完整业务 Schema 与 Bible 一致性校验；模型生成的文字也必须通过数据约束。

**核对范围**：核对 checkDesignFormat 的返回分支与 execute 中先校验后写入的顺序；此提交没有新增测试，不将静态阅读写成测试通过。

- [607615c6](https://github.com/JustGenius-s/Fogot/commit/607615c6cae97f2d0f09623ad09c72f097892e2b) · 作者字段：justgenius · [历史源码](https://github.com/JustGenius-s/Fogot/blob/607615c6cae97f2d0f09623ad09c72f097892e2b/editor/ai/chat-ui/src/ai/tools/design.ts)

### 2026.07.07 · 把子任务结果从临时卡片变成可浏览线程

**触发问题**：子 Agent 的长执行记录不适合挤在主对话工具卡里；直接将大量记录写入 localStorage 又会触及容量限制。

**实现演进**：添加 parentID 与 agentType，以子线程展示委派过程；线程元数据保存到本地，详细 parts 放入内存缓存，并用订阅版本驱动界面更新。

**取舍**：内存缓存缓解配额压力，但该版本的详细子线程记录不能据此宣称刷新后仍持久可恢复。可浏览和持久保存是两个不同目标。

**核对范围**：核对 createSubAgentThread、subAgentDataCache 与 getChildThreads；提交增加专门子线程视图，未新增独立测试文件。

- [d823b6b8](https://github.com/JustGenius-s/Fogot/commit/d823b6b830305e1552fd11aa9ded28f7fb9ece51) · 作者字段：justgenius · [历史源码](https://github.com/JustGenius-s/Fogot/blob/d823b6b830305e1552fd11aa9ded28f7fb9ece51/editor/ai/chat-ui/src/lib/thread-storage.ts)

## intro-builder

仓库：Rory-X/intro-builder。读取基线：1567115e31ee86273e0822854f963971293723a8。

### 2026.06.21 · 审批之后，继续完成同一个任务

**触发问题**：Agent 遇到需确认的修改后暂停，用户批准只是决策完成；如果没有续跑上下文，任务会停留在一张已批准的卡片。

**实现演进**：按消息跟踪待审批状态与 continuation，保存批准/拒绝决定后恢复流程；新建或切换会话清空待续跑映射，避免跨会话残留。

**取舍**：审批状态与运行状态分开管理。点“批准”不能直接等同于整个任务已完成，历史审批也不应触发当前会话续跑。

**核对范围**：agent-panel-assistant-ui.test.tsx 与 floating chat route 测试随 #100 更新；本次核对 UI 状态与续跑分支，未执行来源测试。

- [af22319d](https://github.com/Rory-X/intro-builder/commit/af22319d55c8339a89f1635a26e8a6f58078ae8f) · 作者字段：Rory · [历史源码](https://github.com/Rory-X/intro-builder/blob/af22319d55c8339a89f1635a26e8a6f58078ae8f/apps/web/components/agent/floating-agent-chat.tsx)

### 2026.06.25 · 将“触发保存”升级为“等待保存完成”

**触发问题**：AI 修改、版本操作和普通输入共用自动保存；派发一次保存事件，不代表当前内容已经落库，保存期间的新输入还可能排在后面。

**实现演进**：在防抖和串行保存之上增加可等待的 flush，集中维护等待者；后续保存和重试完成后才 resolve，最终失败则 reject。

**取舍**：保存动作的完成语义成为业务边界，调用方需要处理失败。pagehide 发起保存不等于浏览器关闭前必定保存成功。

**核对范围**：use-resume-autosave.test.ts 随提交增加覆盖。来源为公开分支中的提交，不据此推定已合入 main 或上线。

- [fc9d1444](https://github.com/Rory-X/intro-builder/commit/fc9d1444eb8608d27ede6cee29a460e439a576ec) · 作者字段：intro-builder agent · [历史源码](https://github.com/Rory-X/intro-builder/blob/fc9d1444eb8608d27ede6cee29a460e439a576ec/apps/web/hooks/use-resume-autosave.ts)

### 2026.06.25 · 从保存当前内容走向可比较、可撤回的编辑

**触发问题**：自动保存解决落库，却不能让用户看懂 AI 改动或撤回误操作；纯文本比较还会破坏简历模板的阅读结构。

**实现演进**：增加完整简历快照的 Undo/Redo 栈，连续输入按时间窗口合并；持久版本与富文本 Diff 独立建模，在 A4 预览中查看变化。

**取舍**：会话级撤销与跨会话版本恢复解决不同问题。历史栈有容量边界，不能将当前差异算法说成能识别所有富文本块移动。

**核对范围**：use-resume-history.ts 明确 MAX_UNDO=50、MERGE_WINDOW_MS=2000；提交包含版本操作、Diff 预览和历史栈相关测试。

- [1567115e](https://github.com/Rory-X/intro-builder/commit/1567115e31ee86273e0822854f963971293723a8) · 作者字段：Rory · [历史源码](https://github.com/Rory-X/intro-builder/blob/1567115e31ee86273e0822854f963971293723a8/apps/web/hooks/use-resume-history.ts)

## r-api

仓库：Rory-X/r-api。读取基线：57900c4a916530bfbb9d23913964cec30731e4b3。

### 2026.08.13 · 撤掉全局代理钥匙，统一下游调用身份

**触发问题**：全局代理主密钥与托管下游 Key 并存，使调用统计、路由策略和文件资源归属存在两套路径。

**实现演进**：移除全局代理密钥配置与入口，外部调用统一走托管 Key；管理端测试通过独立 internal tester 交接，资源所有者区分 managed_key 与 internal_tester。

**取舍**：清理鉴权旁路需要同步配置、备份、UI 和资源归属，不能只删设置页面。管理员身份也不应自动成为通用代理凭证。

**核对范围**：提交包含全局 token 清理与架构约束测试，并调整 HTTP、文件和 WebSocket 相关测试。

- [796c56cc](https://github.com/Rory-X/r-api/commit/796c56cc14fadbb2c923afbfa34faac767ab1b7d) · 作者字段：jiahaoqian · [历史源码](https://github.com/Rory-X/r-api/blob/796c56cc14fadbb2c923afbfa34faac767ab1b7d/src/server/middleware/auth.ts)

### 2026.08.18 · 为流式输出建立明确的提交点

**触发问题**：一旦向客户端提交 SSE，失败后的换路由空间会收窄。过早输出与等待上游确认之间，需要明确的时间和状态边界。

**实现演进**：引入延迟输出封装，提交前缓存 chunk 和 end 意图，提供 commit/discard；可配置定时提交，同批变更增加路由观测数据。

**取舍**：该版本定义 250ms 的前输出宽限常量，这是延迟预算而非响应提速指标。committed 后不能撤回已发送内容，discard 也不再生效。

**核对范围**：deferredSseOutput.test.ts 随提交新增，路由观测 API 另有测试。代码存在缓冲机制不等于所有失败都可以安全重试。

- [b5f5b491](https://github.com/Rory-X/r-api/commit/b5f5b4913305b7c8ef8355a6c1fd503df7ecd4df) · 作者字段：jiahaoqian · [历史源码](https://github.com/Rory-X/r-api/blob/b5f5b4913305b7c8ef8355a6c1fd503df7ecd4df/src/server/proxy-core/deferredSseOutput.ts)

### 2026.08.18 · 区分本机已排队与 Agent 已接受

**触发问题**：Connector 已领取命令后，本机 Agent 仍可能繁忙；如果只保留成功/失败，队列等待会被误当成已执行，后续租约和回执也难以对账。

**实现演进**：新增 queued 回执与 connector_queued 状态，本地消息记录 queued/dispatching、尝试次数与下次执行时间；后续 accepted/rejected/unknown 仍校验活动租约。

**取舍**：排队成功不是任务成功；收到 turn 事件时也要考虑当前命令是否仍在队列。把这种差异写入协议，比仅在 UI 上增加“等待”标签更重要。

**核对范围**：queue.test.ts、runtime.bridge.test.ts 与 bridgeContinuationState.test.ts 同步增加覆盖；本次未进行断网或崩溃注入。

- [8ba09d92](https://github.com/Rory-X/r-api/commit/8ba09d9281337b963e39d9b80b1927f3fcc7c19d) · 作者字段：jiahaoqian · [历史源码](https://github.com/Rory-X/r-api/blob/8ba09d9281337b963e39d9b80b1927f3fcc7c19d/src/server/services/bridgeContinuationState.ts)
