# xuu 提交与代码设计实践历程

核对日期：2026-09-23。仓库：Rory-X/xuu。基线：44a00fe2edab0a966dd62f7e3b23271bf3ce0136。

这是仓库演进分析，不是个人贡献归属证明。提交作者有多位，部分含协作署名；未推定其与用户身份的对应关系。只读分析提交差异、历史源码与测试，不执行来源项目，也未复跑其测试。

抽样范围集中在 2026-09-08 至 09-22 的上下文、协作与运行可靠性，不代表穷尽仓库全部实践。早期窗口实现与后续策略分开叙述，避免将历史分支直接当成最新行为。

## 2026.09.08 · 让上下文切换成为可校验的流程

**触发问题**：模型提出 new_context，不代表工具已成功执行；反复主动重置和不完整摘要还可能丢掉尚未覆盖的进展。

**实现演进**：先将流程收敛为请求、准入、构建、提交，只有成功工具结果能触发切换；同日引入可选的 v3 无摘要窗口，由宿主归档历史，扩展维护持久笔记。

**取舍**：窗口生命周期与工作记忆分开管理。v3 是明确启用的路径，不能把它概括成所有模式都不再使用摘要；手动压缩仍保留 v2。

**回归契约**：context_transition_test.go / summary_free_window_test.go：拒绝的请求不得切换窗口；窗口策略有独立回归场景。

- [d988ee7a · 切换协议](https://github.com/Rory-X/xuu/commit/d988ee7a5c6467c45ce1e9729adf8c1b989975c8) — 作者字段：Andy wu；[历史源码](https://github.com/Rory-X/xuu/blob/d988ee7a5c6467c45ce1e9729adf8c1b989975c8/internal/agent/fresh_context.go)
- [b3250dfe · 无摘要窗口与持久笔记](https://github.com/Rory-X/xuu/commit/b3250dfed6c36fb013b4c975342e00fdab7744ba) — 作者字段：Andy wu；[历史源码](https://github.com/Rory-X/xuu/blob/b3250dfed6c36fb013b4c975342e00fdab7744ba/plugins/notecompaction/notes.go)

## 2026.09.13 → 09.16 · 从“多个会话”走向明确的身份和控制权

**触发问题**：同一个 Agent 在不同房间和任务里容易产生多份执行上下文；人工接管后，旧的自动指令仍可能迟到。

**实现演进**：先让每个身份拥有一个持久对话，房间范围属于本次获准执行的 turn；再增加独立的 session_controls 表，用 manager、revision、state 校验控制权，并显式路由工作空间。

**取舍**：对话归属、父子关系、项目绑定与执行控制是不同概念。接管只改变控制状态；释放关系仍保留 revision，让旧请求无法恢复自动执行。

**回归契约**：TestControlFencesTakeoverAndDoesNotTransferOwnership：覆盖竞争管理者、旧指令、旧版本恢复和接管不改变资源归属。

- [57ac4331 · 身份级持久对话](https://github.com/Rory-X/xuu/commit/57ac4331d80aeae0806de1ef710861fde27223cd) — 作者字段：Andy wu；[历史源码](https://github.com/Rory-X/xuu/blob/57ac4331d80aeae0806de1ef710861fde27223cd/internal/channels/identity_conversation.go)
- [e64e1201 · 持久控制版本与工作空间路由](https://github.com/Rory-X/xuu/commit/e64e12017bae9130fc5eeb45fe1adee86404be29) — 作者字段：Andy wu；[历史源码](https://github.com/Rory-X/xuu/blob/e64e12017bae9130fc5eeb45fe1adee86404be29/internal/session/control.go)

## 2026.09.20 · 委派的不只是文字，还有不可丢失的证据

**触发问题**：用户在群聊里给了截图，执行会话若只收到文字描述，就可能在缺少关键依据的情况下继续工作。崩溃恢复时，已接收输入但未确认回执也会产生歧义。

**实现演进**：按来源房间解析被选中的附件，传递原始媒体内容与来源信息；附件标为 Required，在输入准入和模型编码边界检查能力。恢复时先查已接收凭据，再决定是否重新读取来源。

**取舍**：证据缺失应明确失败，不能悄悄降级成纯文本。传递附件不授予整个房间访问权；已交付的副本也不会随源消息删除而自动撤回。

**回归契约**：harness_media_test.go 与 media_policy_test.go：提交包含来源解析、交接恢复和必需媒体能力检查的测试。

- [7de1dc27 · 多模态证据交接 · #254](https://github.com/Rory-X/xuu/commit/7de1dc27eba872d9067c723adb5aed11c562ddaf) — 作者字段：Jiahe Wu；[历史源码](https://github.com/Rory-X/xuu/blob/7de1dc27eba872d9067c723adb5aed11c562ddaf/internal/appserver/harness_media.go)

## 2026.09.20 → 09.22 · 大上下文仍会溢出：从估算误差追到 usage 来源

**触发问题**：JSON 工具结果的 token 密度可能高于普通文本；部分提供方又不返回 usage，使助手输出和工具参数漏算，重启后还可能把局部估计当作真实基线。

**实现演进**：先修正工具结果估算，并在溢出后沿合法工具调用边界裁剪；请求确实缩小才允许继续恢复。随后在发送前补齐完整出站估算，但不覆盖已有的提供方实测 usage。

**取舍**：扩大窗口不能替代预算模型。估算与实测要保留来源差别，溢出恢复还要限制重试并检查是否已有部分输出，避免原样重复发送。

**回归契约**：context_window_recovery_test.go / usage_test.go / loop_test.go：覆盖无法缩小的历史、无 usage 的本地估算与运行恢复。

- [993fd4f4 · 估算修正与溢出恢复 · #240](https://github.com/Rory-X/xuu/commit/993fd4f413ec05d9d24f0ae39829e9ac74a20b51) — 作者字段：Jiahe Wu；[历史源码](https://github.com/Rory-X/xuu/blob/993fd4f413ec05d9d24f0ae39829e9ac74a20b51/internal/agent/loop.go)
- [e421baf1 · 发送前校准无 usage 的预算](https://github.com/Rory-X/xuu/commit/e421baf1a777ed93ad6cc54d2c3288a1d28435ce) — 作者字段：Andy wu；[历史源码](https://github.com/Rory-X/xuu/blob/e421baf1a777ed93ad6cc54d2c3288a1d28435ce/internal/agent/usage.go)

## 2026.09.21 · 兼容外部引擎：容忍迟到响应，同时保留协议检查

**触发问题**：ACP 的 session/prompt 仍在等待模型时，外部引擎可能发来不相关的 JSON-RPC result。原实现将 ID 不匹配直接视为当前任务失败。

**实现演进**：仅在等待 session/prompt 时忽略不匹配的响应 ID，继续等待当前请求；握手等其他调用仍对错位响应报错。

**取舍**：兼容性补丁应局部放宽，而不是对全部协议错误一律忽略。长任务的存活与握手的严格校验需要不同处理。

**回归契约**：rpc_test.go / acp_test.go：提交增加请求 ID 匹配和 prompt 等待相关回归覆盖。

- [d4160e8b · 过滤过期 ACP 响应](https://github.com/Rory-X/xuu/commit/d4160e8b710c840aeb0baa0838afc31300cb7c71) — 作者字段：Andy wu；[历史源码](https://github.com/Rory-X/xuu/blob/d4160e8b710c840aeb0baa0838afc31300cb7c71/internal/externalengine/rpc.go)

## 2026.09.22 · 并行任务变多以后，优化真正多余的界面工作

**触发问题**：后台 ACP 会话每次工具事件都立即进入 reducer，导致侧栏重复排序、当前对话重复协调，即使用户没有查看那个会话。

**实现演进**：后台会话的 started / completed / removed 事件按 150ms 窗口合并；其他事件到达或会话被打开时立即清空待处理队列。排序键不变时原位替换条目，不重新排序列表。

**取舍**：只延迟不可见会话的特定事件，前台与分屏会话保持及时更新。减少无效更新与改变真实执行速度是两回事，不据此宣称 Agent 执行更快。

**回归契约**：AppState.test.ts：提交增加后台事件判定与列表更新的回归覆盖；没有在本次提供帧率或性能提升百分比。

- [9db2e7d1 · 后台事件合并与稳定排序](https://github.com/Rory-X/xuu/commit/9db2e7d175f984d2da078f7a8596cd113426a6d1) — 作者字段：Andy wu；[历史源码](https://github.com/Rory-X/xuu/blob/9db2e7d175f984d2da078f7a8596cd113426a6d1/desktop/src/renderer/AppState.ts)
