# xuu Coding Agent：实现模块、真实问题与提交解法

核对日期：2026-09-23。仓库：[Rory-X/xuu](https://github.com/Rory-X/xuu)；只读分析基线 [`44a00fe2`](https://github.com/Rory-X/xuu/commit/44a00fe2edab0a966dd62f7e3b23271bf3ce0136)。

这份梳理按实现责任组织提交，而不是按提交时间重排。资料来自该仓库的历史 diff、对应版本源码和测试文本；“验证”描述提交中已有的回归契约，本次没有运行来源项目测试或真实模型评测。仓库有多位作者与协作提交，以下不推定个人贡献归属。

## 实现链路

用户任务 → 会话与控制权 → Agent 循环 / 上下文预算 → Provider 协议 → 工具执行 / 文件与浏览器 → 历史持久化 → 桌面呈现与评测。

这条链路的关键在于边界一致：模型说“继续”不等于任务完成；工具排队不等于执行成功；流里出现答案不等于消息已定稿；输入被接受不等于回复已交付；界面显示的文本也不等于可安全写回历史。

## 模块速览

| 层面 | 模块 | 问题案例 |
| --- | --- | ---: |
| 核心运行 | [Agent 循环与终止语义](#module-agent-loop) | 2 |
| 核心运行 | [上下文窗口、预算与压缩](#module-context-budget) | 2 |
| 核心运行 | [Prompt Cache 与动态上下文](#module-prompt-cache) | 2 |
| 核心运行 | [历史持久化与运行恢复](#module-session-storage) | 3 |
| 核心运行 | [多模态输入与证据交接](#module-media-evidence) | 1 |
| 核心运行 | [评测、观测与结果证据](#module-eval-observability) | 2 |
| 工具与协议 | [文件读取、精确编辑与代码搜索](#module-file-tools) | 2 |
| 工具与协议 | [命令生命周期与权限边界](#module-execution-boundary) | 2 |
| 工具与协议 | [外部引擎与流式 Provider 协议](#module-provider-protocol) | 2 |
| 产品与协作 | [协作编排与控制权](#module-collaboration-control) | 2 |
| 产品与协作 | [插件生命周期与扩展](#module-plugin-lifecycle) | 2 |
| 产品与协作 | [桌面呈现与浏览器控制](#module-desktop-browser) | 2 |

合计 **12 个模块、24 个案例**。缓存的六个前缀问题另见 [xuu 缓存专题](./xuu-cache-design.md)，这里保留与整体 Agent 链路直接相关的两例。

## 核心运行

<a id="module-agent-loop"></a>
### Agent 循环与终止语义

拥有模型轮次、工具循环和结束条件；不能把暂时暂停、输出截断或开始回答都当成任务完成。

#### 1. 没有工具调用，仍可能需要协议续跑

提交：[ee91b80e](https://github.com/Rory-X/xuu/commit/ee91b80ef9ec23be7a1445f97df2814887ff3ca1) · 作者日期：2026-09-20

**实际问题：** 提供方要求继续长回合时，旧逻辑可能提前结束；若无条件继续，又可能形成无限计费循环。

**成因：** 不同提供方的结束信号被混同为 stop；仅凭空文本或工具数量无法判定是否继续。

**解法：** 在提供方边界规范化 FinishReasonContinue；仅明确的非截断续跑信号允许无工具下一轮，连续次数设上限，即使 MaxSteps 未设也受控。

**代价与边界：** 续跑不是传输重试，也不是业务完成。上限是防失控约束，不保证长任务一定完成。

**验证范围：** loop_continuation_test.go 包含连续上限、工具进展后重置以及两次续跑之间取消的测试；本次阅读代码，未执行。

历史文件：
- [`internal/agent/loop.go`](https://github.com/Rory-X/xuu/blob/ee91b80ef9ec23be7a1445f97df2814887ff3ca1/internal/agent/loop.go)
- [`internal/providers/types.go`](https://github.com/Rory-X/xuu/blob/ee91b80ef9ec23be7a1445f97df2814887ff3ca1/internal/providers/types.go)
- [`internal/agent/loop_continuation_test.go`](https://github.com/Rory-X/xuu/blob/ee91b80ef9ec23be7a1445f97df2814887ff3ca1/internal/agent/loop_continuation_test.go)

#### 2. 流里出现 final_answer，不立即交付最终答案

提交：[f211ba46](https://github.com/Rory-X/xuu/commit/f211ba461071a88264623fb3de7070c8a96752ea) · 作者日期：2026-09-16

**实际问题：** 兼容提供方先把输出标记 final_answer，随后又改成 commentary 并发起工具调用，界面过早进入最终答案区域。

**成因：** 增量事件中的 phase 只是临时元数据，旧实现收到 delta 就设置 Terminal。

**解法：** 将答案晋升推迟到完整 message 事件，流式 delta/replace 保留内容但不触发最终交接。

**代价与边界：** “文字出现”“消息完成”“整个任务完成”有不同边界。较晚确认终态可避免误报，但仍需让中间进度可见。

**验证范围：** TestThreadStateDoesNotPromoteProvisionalFinalAnswer 模拟阶段修订与随后的工具调用，检查 message 完成前不设置 AnswerReadyAt。

历史文件：
- [`internal/appserver/model.go`](https://github.com/Rory-X/xuu/blob/f211ba461071a88264623fb3de7070c8a96752ea/internal/appserver/model.go)
- [`internal/appserver/model_test.go`](https://github.com/Rory-X/xuu/blob/f211ba461071a88264623fb3de7070c8a96752ea/internal/appserver/model_test.go)

<a id="module-context-budget"></a>
### 上下文窗口、预算与压缩

管理可发送的窗口、Token 来源及压缩事务；保留原始历史与工作记忆之间的边界。

#### 1. 提供方没有 usage，不能把遗漏的输入当零

提交：[e421baf1](https://github.com/Rory-X/xuu/commit/e421baf1a777ed93ad6cc54d2c3288a1d28435ce) · 作者日期：2026-09-22

**实际问题：** 部分提供方不报告用量，助手输出与工具参数未进入累计预算，运行重建后还可能把局部统计视为权威基线。

**成因：** 增量追踪依赖已知历史长度和提供方总量；缺少真实总量时，已提交消息可能被跳过。

**解法：** 发送前以完整出站请求估算抬高无权威基线的本地预算；无 usage 的助手消息进入待统计增量；保留提供方真实 usage 优先级。

**代价与边界：** 估算只在缺失实测基线时兜底，不能用悲观估算覆盖已报告的用量。Token 估算改进还需验证任务质量与成本。

**验证范围：** usage_test.go 验证 RaiseLocalEstimate 补齐局部总量且不覆盖 provider baseline；loop 与 appserver 同步补测试。

历史文件：
- [`internal/agent/usage.go`](https://github.com/Rory-X/xuu/blob/e421baf1a777ed93ad6cc54d2c3288a1d28435ce/internal/agent/usage.go)
- [`internal/agent/usage_test.go`](https://github.com/Rory-X/xuu/blob/e421baf1a777ed93ad6cc54d2c3288a1d28435ce/internal/agent/usage_test.go)
- [`internal/appserver/context_composition_test.go`](https://github.com/Rory-X/xuu/blob/e421baf1a777ed93ad6cc54d2c3288a1d28435ce/internal/appserver/context_composition_test.go)

#### 2. 新上下文提交失败时，恢复整套旧窗口状态

提交：[06ba346b](https://github.com/Rory-X/xuu/commit/06ba346b0749b3ad018708c386a3525e9ccd1534) · 作者日期：2026-09-08

**实际问题：** 构建新窗口后可能在参数校验或持久化阶段失败；若只恢复消息数组，缓存状态和预算仍可能指向未提交的新窗口。

**成因：** 旧回滚逻辑分散在个别失败分支，没有覆盖所有提前退出路径和上下文派生状态。

**解法：** 建立统一 rollbackFreshContext，在提交前保存历史、provider messages、retained context 和发送去重状态；defer 覆盖提前退出，成功提交后解除回滚。

**代价与边界：** 窗口替换是事务式操作，不能先对外确认再持久化。成功推进后才重置新窗口溢出恢复机会，避免连续失败无限重试。

**验证范围：** context_window_recovery_test.go 随提交覆盖失败保留原窗口和恢复次数；后续裁剪机制继续演进，此处解释该历史修复。

历史文件：
- [`internal/agent/loop.go`](https://github.com/Rory-X/xuu/blob/06ba346b0749b3ad018708c386a3525e9ccd1534/internal/agent/loop.go)
- [`internal/agent/context_window_recovery_test.go`](https://github.com/Rory-X/xuu/blob/06ba346b0749b3ad018708c386a3525e9ccd1534/internal/agent/context_window_recovery_test.go)

<a id="module-prompt-cache"></a>
### Prompt Cache 与动态上下文

拥有请求组装和稳定前缀；不能为缓存命中保留已经失效的业务上下文。

#### 1. 工具循环内部命中，进入新 turn 却断掉

提交：[830d02f3](https://github.com/Rory-X/xuu/commit/830d02f3f86dc9b39e28f851fa18dd4961c6f23b) · 作者日期：2026-07-15

**实际问题：** 桌面每轮入口调用 ResetConversationUsage，连带清空 retained context，导致跨轮前缀连续性失效。

**成因：** 预算统计重置与请求上下文生命周期被耦合；简单取消清空又会留下旧目标、旧权限策略等临时内容。

**解法：** 拆开两类生命周期，基于 durable history 指纹判断能否复用；新轮第一请求对照新鲜上下文，只有重新确认的内容才复用旧位置。

**代价与边界：** 编辑、fork 或历史重写必须允许缓存失效。这是 7 月 15 日的一步修复，后续类型化更新流进一步扩展了连续性。

**验证范围：** 不仅覆盖 agent 单元测试，还加入 ensureThreadRuntimeAfterAdmission 的真实接线测试，避免只测内循环漏掉桌面入口。

历史文件：
- [`internal/agent/request_assembler.go`](https://github.com/Rory-X/xuu/blob/830d02f3f86dc9b39e28f851fa18dd4961c6f23b/internal/agent/request_assembler.go)
- [`internal/agent/stream_runner_test.go`](https://github.com/Rory-X/xuu/blob/830d02f3f86dc9b39e28f851fa18dd4961c6f23b/internal/agent/stream_runner_test.go)
- [`internal/appserver/retained_context_turn_entry_test.go`](https://github.com/Rory-X/xuu/blob/830d02f3f86dc9b39e28f851fa18dd4961c6f23b/internal/appserver/retained_context_turn_entry_test.go)

#### 2. 渐进工具加载反而破坏长循环缓存

提交：[e81af507](https://github.com/Rory-X/xuu/commit/e81af507d1d8baf87da9cf3d0ef8a07a2769ead0) · 作者日期：2026-07-30

**实际问题：** 运行过程中将新工具 Schema 加入顶层 tools 数组，会改变请求前缀，增加重复输入开销。

**成因：** 减少首请求工具体积的局部优化，与后续请求复用固定工具定义的目标冲突。

**解法：** 撤掉 Wuu 本地渐进加载模式，支持原生发现则 native，否则 flat；保留本地目录搜索执行器服务原生发现，旧配置映射兼容并提示。

**代价与边界：** 固定 Schema 有额外首轮成本，是否更省需要真实使用量对照；工具定义稳定不代表外部缓存一定命中。

**验证范围：** runtime/session_test.go 与 tool_loading_notice_test.go 覆盖模式选择及兼容提示。更完整缓存演进保留在缓存专题。

历史文件：
- [`internal/runtime/session.go`](https://github.com/Rory-X/xuu/blob/e81af507d1d8baf87da9cf3d0ef8a07a2769ead0/internal/runtime/session.go)
- [`internal/runtime/session_test.go`](https://github.com/Rory-X/xuu/blob/e81af507d1d8baf87da9cf3d0ef8a07a2769ead0/internal/runtime/session_test.go)
- [`internal/config/tool_loading_notice_test.go`](https://github.com/Rory-X/xuu/blob/e81af507d1d8baf87da9cf3d0ef8a07a2769ead0/internal/config/tool_loading_notice_test.go)

<a id="module-session-storage"></a>
### 历史持久化与运行恢复

分别保存用户可见消息、完整工具历史和驱动状态；不能把聊天记录等同于全部执行状态。

#### 1. 失败 turn 不应留下半截工具调用

提交：[1bc3de96](https://github.com/Rory-X/xuu/commit/1bc3de96bfbde261382a74de8ab4af46dabf895b) · 作者日期：2026-07-01

**实际问题：** 提供方在发出工具调用片段后失败，旧代码仍保存新增 assistant/tool 消息，重试时回放不完整协议历史。

**成因：** 无论 turn 成败都追加 NewMessages 并尝试修复工具历史，持久化边界过于宽松。

**解法：** 该历史版本在 turn 错误时不追加部分工具历史，但仍保存用户输入与 usage，并合并执行和持久化错误。

**代价与边界：** 这是早期保守策略，后续不再简单丢掉所有可见输出；下一条提交补充“保留文本、剥离未完成工具结构”。

**验证范围：** TestServerFailedTurnDoesNotPersistPartialToolHistory 检查失败时仅保存用户提示而不保存半截工具消息。

历史文件：
- [`internal/appserver/turn_handlers.go`](https://github.com/Rory-X/xuu/blob/1bc3de96bfbde261382a74de8ab4af46dabf895b/internal/appserver/turn_handlers.go)
- [`internal/appserver/server_test.go`](https://github.com/Rory-X/xuu/blob/1bc3de96bfbde261382a74de8ab4af46dabf895b/internal/appserver/server_test.go)

#### 2. 修复“历史干净了，但已看到的回答丢了”

提交：[375b0c38](https://github.com/Rory-X/xuu/commit/375b0c383394f1e279078022ef6d3337e40db36c) · 作者日期：2026-07-16

**实际问题：** 用户中断或流式失败后，已经展示在界面的部分回答没有被保存，重开会话时消失。

**成因：** 错误返回只传 error 或空 StepResult；工具结构完整性和纯文本可保留性没有分别处理。

**解法：** 失败时返回已积累文本，持久化为部分 assistant 消息；主动剥离不完整的工具调用、provider identity 和 reasoning 字段。

**代价与边界：** 保存部分回答不表示任务成功，也不表示执行副作用已回滚；必须保留失败终态。

**验证范围：** TestRunToolLoopPreservesVisiblePartialAssistantOnStepError 断言可见文本存在且不带不完整 provider/tool 状态。

历史文件：
- [`internal/agent/loop.go`](https://github.com/Rory-X/xuu/blob/375b0c383394f1e279078022ef6d3337e40db36c/internal/agent/loop.go)
- [`internal/agent/stream_runner.go`](https://github.com/Rory-X/xuu/blob/375b0c383394f1e279078022ef6d3337e40db36c/internal/agent/stream_runner.go)
- [`internal/agent/loop_test.go`](https://github.com/Rory-X/xuu/blob/375b0c383394f1e279078022ef6d3337e40db36c/internal/agent/loop_test.go)

#### 3. 给运行驱动增加独立 checkpoint

提交：[3b046d4b](https://github.com/Rory-X/xuu/commit/3b046d4b09298f93d48f90dabe6e9cc2dbbf0090) · 作者日期：2026-08-09

**实际问题：** 仅恢复聊天历史不足以重建驱动内部状态；新增 checkpoint 接线体现了将驱动状态持久化的设计需求，而非已记录线上事故。

**成因：** 消息历史与 loop driver 状态属于不同数据面，不能从最后一条回答推导执行位置。

**解法：** 新增 session_driver_checkpoints，保存契约版本、驱动 ID/版本和 JSON 状态，以会话为键事务 upsert，并在 ThreadRuntime 注入读写适配器。

**代价与边界：** 驱动快照不等于外部工具事务；仍需副作用幂等、版本兼容和真实崩溃恢复验证。

**验证范围：** 已核对会话表、Load/Save 和 runtime 接线；该提交没有新增独立测试文件，不将实现阅读写成恢复实验通过。

历史文件：
- [`internal/session/driver_checkpoint.go`](https://github.com/Rory-X/xuu/blob/3b046d4b09298f93d48f90dabe6e9cc2dbbf0090/internal/session/driver_checkpoint.go)
- [`internal/runtime/session.go`](https://github.com/Rory-X/xuu/blob/3b046d4b09298f93d48f90dabe6e9cc2dbbf0090/internal/runtime/session.go)
- [`internal/appserver/turn_handlers.go`](https://github.com/Rory-X/xuu/blob/3b046d4b09298f93d48f90dabe6e9cc2dbbf0090/internal/appserver/turn_handlers.go)

<a id="module-media-evidence"></a>
### 多模态输入与证据交接

让截图、文件与来源身份跟随委派任务；模型能力校验不能静默丢掉必需证据。

#### 1. 群聊给了截图，执行者却只收到文字

提交：[7de1dc27](https://github.com/Rory-X/xuu/commit/7de1dc27eba872d9067c723adb5aed11c562ddaf) · 作者日期：2026-09-20

**实际问题：** 委派只传 Prompt，附件没有完整进入工作会话；在输入已接收但 ACK 丢失时，重试还可能无法重新读取原来源。

**成因：** 将媒体当作可选展示附件，未把源房间、权限、字节内容和交付收据纳入同一契约。

**解法：** 在源 turn 的房间内解析选定媒体，附带 provenance 并标记 Required；输入与 provider 边界校验能力；恢复优先识别已接收收据，再读取源引用。

**代价与边界：** 已交付副本不因源删除而自动撤回；文件引用不授予整个房间权限，不支持媒体时明确失败而不是文本降级。

**验证范围：** harness_media_test.go 覆盖撤权后的已送达恢复、排队后重新鉴权、目标能力不兼容和证据不可用不执行。

历史文件：
- [`internal/appserver/harness_media.go`](https://github.com/Rory-X/xuu/blob/7de1dc27eba872d9067c723adb5aed11c562ddaf/internal/appserver/harness_media.go)
- [`internal/appserver/harness_media_test.go`](https://github.com/Rory-X/xuu/blob/7de1dc27eba872d9067c723adb5aed11c562ddaf/internal/appserver/harness_media_test.go)
- [`internal/providers/media_policy_test.go`](https://github.com/Rory-X/xuu/blob/7de1dc27eba872d9067c723adb5aed11c562ddaf/internal/providers/media_policy_test.go)

<a id="module-eval-observability"></a>
### 评测、观测与结果证据

让 grader 在真正完成的状态上工作，并把契约回归与真实模型收益分开报告。

#### 1. 评测自己存在竞态：主 Agent 结束不等于子任务完成

提交：[9e01a5cd](https://github.com/Rory-X/xuu/commit/9e01a5cd93152bcdb0c77417d5f8587ec70a086d) · 作者日期：2026-07-12

**实际问题：** multi_agent_worker 的验证可能在子 Agent 尚未写完文件时运行，成绩受执行时序影响。

**成因：** grader 紧接主 Agent turn 返回执行，没有等待后台子任务终态。

**解法：** 评分前轮询 AgentControl 快照直到所有子任务进入终态，并受每个任务的 context 超时约束；超时明确报未静止而不是继续误判。

**代价与边界：** 等待全部终态只保证判分时机，不保证子任务结果正确，也不能没有上限地等待。

**验证范围：** 提交记录自述此前 3/6 波动、随后连续 5/5；这是历史小样本说明，本次未复跑，也不作为整体性能提升证据。

历史文件：
- [`cmd/wuu/eval.go`](https://github.com/Rory-X/xuu/blob/9e01a5cd93152bcdb0c77417d5f8587ec70a086d/cmd/wuu/eval.go)
- [`internal/evalharness/tasks.go`](https://github.com/Rory-X/xuu/blob/9e01a5cd93152bcdb0c77417d5f8587ec70a086d/internal/evalharness/tasks.go)

#### 2. 多 Agent 更复杂，如何证明额外成本有价值

提交：[99e1f9b1](https://github.com/Rory-X/xuu/commit/99e1f9b18477e247c2131f32fb181c168d52a4b9) · 作者日期：2026-08-28

**实际问题：** 只统计创建了多少会话不能证明任务更快或质量更好；并行也可能重复调查、丢失证据或误拦截结果。

**成因：** 编排机制的确定性测试不能直接回答真实模型和产品结果是否改善。

**解法：** 新增四配置协作对照方案，覆盖独立任务、串行任务、部分失败、目标中途修改等八场景；固定 fixture/模型/权限，记录成本、质量、排队与人工干预。

**代价与边界：** 这是实验设计，不是已得出的收益。fixture 仍需可分发实现；基线快照的公开 results 只有说明文件。

**验证范围：** 核对 matrix.json、prompts 与对照要求；每个组合至少重复五次的规定是实验门槛，不表示已经执行。

历史文件：
- [`evals/cases/collaboration-orchestration/README.md`](https://github.com/Rory-X/xuu/blob/99e1f9b18477e247c2131f32fb181c168d52a4b9/evals/cases/collaboration-orchestration/README.md)
- [`evals/cases/collaboration-orchestration/matrix.json`](https://github.com/Rory-X/xuu/blob/99e1f9b18477e247c2131f32fb181c168d52a4b9/evals/cases/collaboration-orchestration/matrix.json)
- [`internal/channels/collaboration_orchestration_test.go`](https://github.com/Rory-X/xuu/blob/99e1f9b18477e247c2131f32fb181c168d52a4b9/internal/channels/collaboration_orchestration_test.go)

## 工具与协议

<a id="module-file-tools"></a>
### 文件读取、精确编辑与代码搜索

把工作区转换成模型可操作的证据，保证读取格式不污染编辑内容，并让降级搜索保持完整结果与一致语义。

#### 1. 行号分隔符混入缩进，导致精确编辑反复失败

提交：[afb5efdf](https://github.com/Rory-X/xuu/commit/afb5efdf0f2d845d10ff99f8f0261d1a985e5d62) · 作者日期：2026-09-22

**实际问题：** 模型从 read_file 输出复制 old_text 时，可能把行号后的展示 Tab 当作源码缩进；多一个 Tab、把 Tab 换成空格或混合缩进都会让精确匹配失败。

**成因：** 旧输出使用“行号 + Tab + 原文”，展示元数据和真实空白没有明确边界；普通 old_text_not_found 也不能解释是缩进错误还是代码已变化。

**解法：** 统一为 NUMBER|CONTENT，并在工具说明中明确只复制首个竖线后的原文；仅当候选各行正文相同、差异全在前导空白时，返回显示精确空白字节的 indentation_mismatch 提示。

**代价与边界：** 诊断只帮助重新读取后重试，不放宽精确替换规则；这样保留了一次重试成本，但不会通过忽略空白误改代码。

**验证范围：** 提交中的测试覆盖额外 Tab、Tab/空格替换、混合缩进，断言失败不写文件、重新读取后准确修改；另有用例确认正文已过期时不误报缩进问题。本次仅核查测试代码，未运行。

历史文件：
- [`internal/tools/tool_files.go`](https://github.com/Rory-X/xuu/blob/afb5efdf0f2d845d10ff99f8f0261d1a985e5d62/internal/tools/tool_files.go)
- [`internal/tools/tool_apply_patch.go`](https://github.com/Rory-X/xuu/blob/afb5efdf0f2d845d10ff99f8f0261d1a985e5d62/internal/tools/tool_apply_patch.go)
- [`internal/tools/edit_indentation_test.go`](https://github.com/Rory-X/xuu/blob/afb5efdf0f2d845d10ff99f8f0261d1a985e5d62/internal/tools/edit_indentation_test.go)

#### 2. 没有 ripgrep 时，一条超长生成代码让后续搜索失效

提交：[53d01c7b](https://github.com/Rory-X/xuu/commit/53d01c7b47e8f1dba5fe46e2a0ab8228844339ec) · 作者日期：2026-09-22

**实际问题：** 降级搜索遇到无关的超长行会中断，后面的有效匹配无法返回；长行中超过展示限额的位置也可能含有真正的命中。

**成因：** 原实现使用 Scanner 默认 token 长度限制，并且不同搜索模式各自遍历文件，难以统一忽略规则、按行匹配和分页行为。

**解法：** 抽出完整行扫描与文件遍历：先匹配完整行，再裁剪展示内容；目录搜索通过 Git 批量 check-ignore 处理嵌套规则与否定规则，内容、文件列表和计数模式复用同一遍历。

**代价与边界：** 新实现用 ReadFile 读取单个文件，避开行长上限但引入随文件体积增长的内存开销；Git 不可用或目录不是仓库时，无法提供 Git 忽略规则过滤。

**验证范围：** 测试通过移除 PATH 中的 rg 覆盖真实降级分支，构造 128 KiB 长行并检查匹配总数、分页不重不漏、按行计数与锚定匹配；另覆盖嵌套 gitignore、否定规则及显式文件路径。本次未运行。

历史文件：
- [`internal/tools/search_fallback.go`](https://github.com/Rory-X/xuu/blob/53d01c7b47e8f1dba5fe46e2a0ab8228844339ec/internal/tools/search_fallback.go)
- [`internal/tools/tool_search.go`](https://github.com/Rory-X/xuu/blob/53d01c7b47e8f1dba5fe46e2a0ab8228844339ec/internal/tools/tool_search.go)
- [`internal/tools/search_fallback_test.go`](https://github.com/Rory-X/xuu/blob/53d01c7b47e8f1dba5fe46e2a0ab8228844339ec/internal/tools/search_fallback_test.go)

<a id="module-execution-boundary"></a>
### 命令生命周期与权限边界

命令执行既要可取消，也要保留准确终态；声明了受限执行时，还必须确保系统实际具备落实边界的能力。

#### 1. 取消 shell 只结束父进程，子进程仍继续运行

提交：[bcd9653a](https://github.com/Rory-X/xuu/commit/bcd9653a601b7d213b53a59905a2cb18519a8ee0) · 作者日期：2026-07-18

**实际问题：** 同步命令被取消或超时后，派生子进程可能残留；父 shell 的清理逻辑和最终状态也不能仅靠直接杀死父进程保证。

**成因：** 旧同步路径交给 exec.CommandContext 管理单个命令，缺少与后台进程一致的进程树生命周期；父进程退出不代表忽略 SIGTERM 的后代已经退出。

**解法：** 抽出 ProcessTree 与 CommandHandle，启动时隔离进程组；取消时先给整棵树发送终止信号，经过有界等待后仍执行强杀，并把取消、超时与自然退出分别映射到结果。

**代价与边界：** 优雅停止需要等待窗口，取消不再是立即返回；Unix 进程组与 Windows taskkill /T 仍是不同平台机制，提交中新增的实际进程测试只在非 Windows 环境编译。

**验证范围：** 测试构造会执行清理的父 shell 和忽略 TERM 的子进程，检查清理标记、后代退出及取消不报成功；另覆盖超时、自然退出码和危险进程树 ID 拒绝。本次仅阅读测试，未运行。

历史文件：
- [`internal/process/command.go`](https://github.com/Rory-X/xuu/blob/bcd9653a601b7d213b53a59905a2cb18519a8ee0/internal/process/command.go)
- [`internal/tools/tool_shell.go`](https://github.com/Rory-X/xuu/blob/bcd9653a601b7d213b53a59905a2cb18519a8ee0/internal/tools/tool_shell.go)
- [`internal/tools/tool_shell_process_test.go`](https://github.com/Rory-X/xuu/blob/bcd9653a601b7d213b53a59905a2cb18519a8ee0/internal/tools/tool_shell_process_test.go)

#### 2. 沙箱后端缺失时，受限命令静默退化为不受限执行

提交：[306ab31d](https://github.com/Rory-X/xuu/commit/306ab31d55cb5610fa054e921ba2b2eb97dc6b3b) · 作者日期：2026-08-11

**实际问题：** 平台没有内置沙箱、也没有自定义沙箱 provider 时，普通受限环境可能返回空策略，让执行边界实际落空。

**成因：** 旧代码把“显式 Unconfined”和“没有任何沙箱后端”放在同一个提前返回条件中，混淆了用户选择与系统能力缺失。

**解法：** 分开这两个分支：没有后端时返回 ErrUnavailable，要求配置 sandbox.process@1 或显式使用 unconfined；配置了自定义 provider 时仍按工作区边界生成策略。

**代价与边界：** 选择 fail closed 后，缺少沙箱能力的平台会阻止命令继续运行，需要先补齐后端或明确切换模式；该修复针对策略生成入口，不等于证明所有平台均有同等隔离能力。

**验证范围：** TestProcessSandboxPolicyFailsClosedWithoutBackend 覆盖无后端报错、显式 unconfined 放行、自定义 provider 继续生成 workspace-write 策略三种分支。本次未执行测试。

历史文件：
- [`internal/tools/process_sandbox.go`](https://github.com/Rory-X/xuu/blob/306ab31d55cb5610fa054e921ba2b2eb97dc6b3b/internal/tools/process_sandbox.go)
- [`internal/tools/process_sandbox_test.go`](https://github.com/Rory-X/xuu/blob/306ab31d55cb5610fa054e921ba2b2eb97dc6b3b/internal/tools/process_sandbox_test.go)

<a id="module-provider-protocol"></a>
### 外部引擎与流式 Provider 协议

把外部 Agent 的 JSON-RPC 和模型流式事件转换成统一回合语义，处理迟到消息、缺失增量及最终快照纠正。

#### 1. ACP 的迟到响应误伤仍在等待模型的回合

提交：[d4160e8b](https://github.com/Rory-X/xuu/commit/d4160e8b710c840aeb0baa0838afc31300cb7c71) · 作者日期：2026-09-21

**实际问题：** Grok 在 session/prompt 尚未结束时发出无关 JSON-RPC result，原逻辑把 ID 不匹配视为内部错误，提前中止正常回合。

**成因：** 客户端把所有 RPC 阶段都按严格的一问一答处理，没有区分握手阶段的协议失步和长时间 prompt 中的迟到响应。

**解法：** 提取请求 ID 匹配函数，prompt 等待期间忽略不匹配的 result 并继续等待当前请求；初始化、加载等其他 RPC 仍保留不匹配即失败的行为。

**代价与边界：** 容错只开放给 session/prompt，避免把所有协议错误都吞掉；忽略迟到结果本身不会产生成功终态，仍需要当前请求的有效响应或原有退出条件。

**验证范围：** 新增集成式 helper 用例先发 unrelated ID 再发正确答案，断言回合仍返回 Hello world；ID 单测覆盖错字符串、null、空值和数值。原有 malformed、EOF 等失败用例仍保留，本次未运行。

历史文件：
- [`internal/externalengine/rpc.go`](https://github.com/Rory-X/xuu/blob/d4160e8b710c840aeb0baa0838afc31300cb7c71/internal/externalengine/rpc.go)
- [`internal/externalengine/rpc_test.go`](https://github.com/Rory-X/xuu/blob/d4160e8b710c840aeb0baa0838afc31300cb7c71/internal/externalengine/rpc_test.go)
- [`internal/externalengine/acp_test.go`](https://github.com/Rory-X/xuu/blob/d4160e8b710c840aeb0baa0838afc31300cb7c71/internal/externalengine/acp_test.go)

#### 2. 流式增量缺失或被修正，最终答案不能丢失或重复

提交：[b20fdfa8](https://github.com/Rory-X/xuu/commit/b20fdfa87194321919e10d6c3db1511c2143a58b) · 作者日期：2026-09-20

**实际问题：** Responses 兼容端可能不发送完整 text delta，只在 done/completed 给最终正文；直接依赖增量会让用户看到空白、缺后缀或旧草稿，并可能让续接历史与最终答案不一致。

**成因：** 旧 SSE/WebSocket 路径主要消费文本增量与消息元信息，没有统一协调消息快照、重复事件、多个 output item 及工具调用边界。

**解法：** 引入按 item ID/output index 管理的 responsesTextStream，以最终内容快照校正文本：若只是延长则补后缀，若发生改写则发 ContentReplace；WebSocket 仅在重放文本与最终正文一致时保存续接基线。

**代价与边界：** 需要维护逐消息缓冲和替换语义，客户端也必须正确处理替换；重放基线不完整时放弃增量续接、退回完整请求，用更多传输换取上下文一致性。

**验证范围：** 同一套测试分别覆盖 SSE 与 WebSocket 的缺失增量、缺后缀、重复快照、交错消息、拒绝回答和显式清空，断言可见文本等于持久结果且只发一次请求。本次核查源码与测试，未运行。

历史文件：
- [`internal/providers/openai/responses_text.go`](https://github.com/Rory-X/xuu/blob/b20fdfa87194321919e10d6c3db1511c2143a58b/internal/providers/openai/responses_text.go)
- [`internal/providers/openai/responses_websocket_stream.go`](https://github.com/Rory-X/xuu/blob/b20fdfa87194321919e10d6c3db1511c2143a58b/internal/providers/openai/responses_websocket_stream.go)
- [`internal/providers/openai/responses_text_test.go`](https://github.com/Rory-X/xuu/blob/b20fdfa87194321919e10d6c3db1511c2143a58b/internal/providers/openai/responses_text_test.go)

## 产品与协作

<a id="module-collaboration-control"></a>
### 协作编排与控制权

把任务、会话、人工操作和跨会话消息连成可恢复的执行链，重点处理取消隔离与不确定投递。

#### 1. 取消一个任务，旧指令却可能继续执行

提交：[dc7ef1a1](https://github.com/Rory-X/xuu/commit/dc7ef1a12cfe307bb83db5cede3eea823d12f3d0) · 作者日期：2026-09-16

**实际问题：** 用户取消任务后，绑定的普通 Harness 会话需要立即停止；迟到的续跑请求不能恢复执行，也不能连带打断同一管理者的其他任务。

**成因：** 原先取消目标查询没有覆盖 harness_session_links；部分 run 入口未同步切换控制状态，过期 steer 请求还可能先撤销自动管理再被拒绝。

**解法：** 取消查询补入任务绑定的 Harness 会话，暂停时撤销排队输入并发布控制状态；run 开始/中断统一切换接管状态，steer 在接管前校验目标回合。

**代价与边界：** 任务状态、会话控制状态和执行租约需要共同维护，不能把取消简化成一个 UI 标志；接管前后保留校验以处理状态变化。

**验证范围：** 提交中的 TestHarnessTaskCancellationStopsOnlyItsExecution 断言取消事件直接释放目标执行租约、无须等待维护轮询、其他任务仍运行且迟到 send 被拒绝；本次只读核查，未运行测试。

历史文件：
- [`internal/appserver/turn_handlers.go`](https://github.com/Rory-X/xuu/blob/dc7ef1a12cfe307bb83db5cede3eea823d12f3d0/internal/appserver/turn_handlers.go)
- [`internal/channels/work.go`](https://github.com/Rory-X/xuu/blob/dc7ef1a12cfe307bb83db5cede3eea823d12f3d0/internal/channels/work.go)
- [`internal/appserver/harness_sessions_test.go`](https://github.com/Rory-X/xuu/blob/dc7ef1a12cfe307bb83db5cede3eea823d12f3d0/internal/appserver/harness_sessions_test.go)

#### 2. 发送报错不等于未送达，回复入队也不等于已交付

提交：[80d7c4ec](https://github.com/Rory-X/xuu/commit/80d7c4ec544db7aa7174d436807d85236ee7a585) · 作者日期：2026-09-20

**实际问题：** peer 消息已被接收时调用仍可能返回取消错误；回复只是排队成功，宿主退出又会丢弃队列，过早标记完成导致结果丢失。

**成因：** 短时内容去重不足以覆盖重启和迟到回执，旧逻辑混淆了队列接收与持久送达，也没有区分用户取消和宿主退出。

**解法：** 用会话 ID 与 CallID 生成稳定请求标识并持久化关联，发送异常后保留记录，通过 inspect 与生命周期回执对账；回复开始运行或取得不可重试终态后才结算，宿主退出的 discarded 显式标为可重试。

**代价与边界：** 恢复依赖持久回执、重试期限和回复认领租约；用户取消不能自动复活，跨工作区 peer 也被限制在有明确路由能力的范围内。

**验证范围：** delivery_test.go 覆盖接收前后取消、超出去重窗口后同标识重试、回复排队后重启恢复与用户取消不重试；appserver 测试另断言旧丢弃回执不遮蔽新队列以及重试不重复入队，未在本次运行。

历史文件：
- [`plugins/peers/plugin.go`](https://github.com/Rory-X/xuu/blob/80d7c4ec544db7aa7174d436807d85236ee7a585/plugins/peers/plugin.go)
- [`plugins/peers/delivery_test.go`](https://github.com/Rory-X/xuu/blob/80d7c4ec544db7aa7174d436807d85236ee7a585/plugins/peers/delivery_test.go)
- [`internal/appserver/plugin_delivery_recovery_test.go`](https://github.com/Rory-X/xuu/blob/80d7c4ec544db7aa7174d436807d85236ee7a585/internal/appserver/plugin_delivery_recovery_test.go)

<a id="module-plugin-lifecycle"></a>
### 插件生命周期与扩展

插件不仅贡献工具，也承载 hooks、MCP、服务和后台任务，因此更新与退出都必须维持在途执行的一致性。

#### 1. 运行中的会话让插件启停变成全局阻塞

提交：[e6c356f0](https://github.com/Rory-X/xuu/commit/e6c356f002ab4a9d17c2181dc1fda639f126490d) · 作者日期：2026-09-21

**实际问题：** 启用、停用或调整插件授权原先会被运行中的会话拦住；直接替换并关闭旧插件代际，又会破坏旧会话仍在使用的工具和 hooks。

**成因：** Session 的当前插件配置与每个 ThreadRuntime 的运行依赖没有独立生命周期，策略发布和资源退休被绑定成同一步操作。

**解法：** 会话固定持有创建时的 PluginGeneration，把 host、hooks、skills 等依赖绑定到该代；新策略发布新代并用引用计数延迟回收旧代，只有删除包文件仍要求排他操作。

**代价与边界：** 多个代际可能暂时共存并占用资源，已开始的会话要到重建时才应用新插件配置；这里的停用语义不是立即撤销所有在途会话权限。

**验证范围：** 新增代际测试断言发布后旧会话固定的代际仍存活、最后引用释放才关闭；服务端测试区分运行中允许策略变更与禁止删除包，未在本次运行。

历史文件：
- [`internal/runtime/plugin_generation.go`](https://github.com/Rory-X/xuu/blob/e6c356f002ab4a9d17c2181dc1fda639f126490d/internal/runtime/plugin_generation.go)
- [`internal/runtime/plugin_generation_test.go`](https://github.com/Rory-X/xuu/blob/e6c356f002ab4a9d17c2181dc1fda639f126490d/internal/runtime/plugin_generation_test.go)
- [`internal/appserver/plugin_package_handlers_test.go`](https://github.com/Rory-X/xuu/blob/e6c356f002ab4a9d17c2181dc1fda639f126490d/internal/appserver/plugin_package_handlers_test.go)

#### 2. 先撤销宿主服务，插件反而无法安全退出

提交：[179f7eb4](https://github.com/Rory-X/xuu/commit/179f7eb42ccb3f5418dac6abe56626cfebec1149) · 作者日期：2026-09-08

**实际问题：** 插件退出钩子需要保存状态、取消后台会话；如果服务注册表先被撤销，清理阶段调用宿主服务就会失败。

**成因：** 原先 RetirePlugin 和整代关闭路径把服务撤销放在客户端 Close 之前，资源释放顺序与清理依赖相反。

**解法：** 先摘除插件贡献并取消执行，再运行客户端关闭逻辑，最后撤销服务路由；整代退休同样把服务注册表关闭移到所有插件退出之后。

**代价与边界：** 清理窗口仍保留已声明的服务访问，但插件已不再对外注册；整代清理沿用有时限的上下文，并记录关闭错误与撤销阶段。

**验证范围：** TestRetirementAllowsCleanupBeforeRevokingServices 检查插件退出时已从状态列表移除、仍可调用服务、退出后服务不可用；另有整代持久化清理测试，本次未执行。

历史文件：
- [`internal/pluginhost/host.go`](https://github.com/Rory-X/xuu/blob/179f7eb42ccb3f5418dac6abe56626cfebec1149/internal/pluginhost/host.go)
- [`internal/pluginhost/host_retirement_test.go`](https://github.com/Rory-X/xuu/blob/179f7eb42ccb3f5418dac6abe56626cfebec1149/internal/pluginhost/host_retirement_test.go)
- [`internal/runtime/plugin_generation.go`](https://github.com/Rory-X/xuu/blob/179f7eb42ccb3f5418dac6abe56626cfebec1149/internal/runtime/plugin_generation.go)

<a id="module-desktop-browser"></a>
### 桌面呈现与浏览器控制

把高频 Agent 事件和网页观测转成用户与模型都能消费的信息，分别约束渲染开销与上下文体积。

#### 1. 后台工具事件拖累正在阅读的会话

提交：[9db2e7d1](https://github.com/Rory-X/xuu/commit/9db2e7d175f984d2da078f7a8596cd113426a6d1) · 作者日期：2026-09-22

**实际问题：** 后台 ACP 会话每次工具开始、完成或移除都触发状态更新，使用户正在阅读的会话也反复协调渲染，侧栏会话列表反复排序。

**成因：** 事件处理不区分可见与后台会话，updateThreadByID/upsertThread 即使排序键未变也对整张列表重新排序。

**解法：** 仅对已知且不在主/副面板显示的会话聚合工具事件，150 ms 后批量应用，其他事件到达或打开会话时立即刷出；运行标志和侧栏时间未变时原位替换条目。

**代价与边界：** 后台显示允许短暂延迟，前台和副面板仍即时更新；保留事件顺序与切换时刷出比简单丢弃中间状态更重要。

**验证范围：** AppState.test.ts 检查工具事件不改变侧栏顺序及无关条目引用，并区分可聚合后台事件与前台事件；150 ms 调度/切换刷出由实现核对，本次没有运行计时或性能实验。

历史文件：
- [`desktop/src/renderer/App.tsx`](https://github.com/Rory-X/xuu/blob/9db2e7d175f984d2da078f7a8596cd113426a6d1/desktop/src/renderer/App.tsx)
- [`desktop/src/renderer/AppState.ts`](https://github.com/Rory-X/xuu/blob/9db2e7d175f984d2da078f7a8596cd113426a6d1/desktop/src/renderer/AppState.ts)
- [`desktop/src/renderer/AppState.test.ts`](https://github.com/Rory-X/xuu/blob/9db2e7d175f984d2da078f7a8596cd113426a6d1/desktop/src/renderer/AppState.test.ts)

#### 2. 浏览器能点按钮，却读不到页面正文

提交：[86be0377](https://github.com/Rory-X/xuu/commit/86be0377704f619d0f4d53113630e9d954242bff) · 作者日期：2026-09-22

**实际问题：** observe 只返回交互节点，模型看不到发布页的标题、段落和表格，导致页面虽可操作却缺少回答所需证据。

**成因：** DOM 快照投影只保留可点击控件；把全部 DOM 直接送回又会膨胀上下文，并可能超过宿主协议的消息体限制。

**解法：** 从同一份 Chromium 快照生成可读文本块及控件映射，段落/表格先切分，再按 content_offset 分页；每片限制文本与块数，正文链接沿用同一快照中的 node_id。

**代价与边界：** 默认每片最多 6000 字符、20 个块，读取长页需要多次 observe；node_id 仅对当前观察有效，导航/footer 正文会被筛掉但控件仍保留。

**验证范围：** 桌面测试覆盖非控件正文、表格链接映射、按块分页与长段落拆分；Go 工具测试核对 content_offset 传递、输出中的可点击引用和凭据脱敏，均为源码核查而非本次运行。

历史文件：
- [`desktop/src/main/browserHostWindows.ts`](https://github.com/Rory-X/xuu/blob/86be0377704f619d0f4d53113630e9d954242bff/desktop/src/main/browserHostWindows.ts)
- [`desktop/src/main/browserHostWindows.test.ts`](https://github.com/Rory-X/xuu/blob/86be0377704f619d0f4d53113630e9d954242bff/desktop/src/main/browserHostWindows.test.ts)
- [`internal/tools/tool_browser_test.go`](https://github.com/Rory-X/xuu/blob/86be0377704f619d0f4d53113630e9d954242bff/internal/tools/tool_browser_test.go)

## 跨模块的三条设计线索

1. **终态要由正确的边界决定。** Agent loop 区分继续、停止和工具进展；Provider 流区分 delta 与完整 message；会话历史区分可见文本与完整工具协议；协作交付区分入队与真正送达。把这些状态混成一个 `done`，会产生提前结案、丢失回答或重复执行。
2. **失败恢复必须证明不会扩大副作用。** 命令取消要终止进程树，沙箱缺失要明确拒绝执行；精确编辑保持严格匹配；跨会话重试用稳定标识和持久回执对账。恢复是有条件的续跑，不是原样再执行一遍。
3. **缓存与预算优化受正确性约束。** 复用稳定工具面和上下文前缀可以减少变化，但工作区内容、用户意图与控制状态必须保持新鲜。缺少 usage 要估算，失败的上下文切换要回滚；不能为了命中率保留过期输入。

## 下一轮可以怎样验证

先把这些提交对应的确定性测试在固定版本跑通，再选“超长代码搜索 → 精确编辑 → 失败恢复”“用户取消 → 子进程停止 → 会话恢复”“上下文改写 → 缓存前缀 → 过期读取恢复”三条端到端任务做对照。记录任务成功率、工具错误、超时与取消后副作用、Token 用量、缓存读写、首 Token 延迟和总耗时，保留原始 trace 与失败样例。仓库已有评测入口和协作 A/B/C/D 方案，详见 [xuu 评测能力](./xuu-evaluation-capabilities.md)；当前基线的公开 `evals/results` 没有可引用的量化结果，因此本文不声称已有性能收益。
