export type CaseStudy = {
  title: string;
  status: '实现核对' | '文档复盘' | '设计研究' | '仓库文档';
  problem: string;
  decision: string;
  tradeoff: string;
  evidence: string;
  source: string;
};
export type ProjectDepth = { focus: string; cases: CaseStudy[] };
export const projectDepth: Record<string, ProjectDepth> = {
  'e-pi': {
    focus: '终端流重放 · 渲染一致性',
    cases: [
      {
        title: '高频终端输出，如何避免每一帧都复制整段历史？', status: '实现核对',
        problem: '多个会话持续输出 PTY 数据，即使会话不在前台，重放缓冲仍需更新。逐块拼接完整历史并扫描重绘标记，会让后台任务争抢界面主线程。',
        decision: '将终端流按段存储，读取重放内容时才合并；检测重绘边界时保留有限前缀，处理控制序列恰好被拆到两个数据块的情况。',
        tradeoff: '优化目标是减少重复复制，同时保留 VT 控制序列语义。缓冲超限后等待完整重绘检查点，不能截取任意尾部字节冒充有效终端画面。',
        evidence: '已核对 terminalReplayBuffer.ts 的分段存储、惰性拼接与 awaitingCheckpoint 分支。性能计划中的目标耗时不作为已验证收益展示。',
        source: 'src/lib/terminalReplayBuffer.ts',
      },
      {
        title: '窗口缩放时，旧画面和新终端尺寸如何交接？', status: '设计研究',
        problem: 'PTY 尺寸更新、全帧重绘和 xterm 异步解析并不同时完成。直接拉伸旧画布，会在快速反向缩放时产生变形或闪动。',
        decision: '设计以完整重绘帧为交接点，用写入队列屏障确认解析顺序；过渡快照保持原生画布尺寸，外层负责裁剪与背景填充。',
        tradeoff: '需要同时管理渲染尺寸、输出时序和快照寿命。仅调整 CSS 或节流 resize 不足以保证帧的一致性。',
        evidence: '依据终端性能实施计划整理，作为渲染流水线的设计取舍；不宣称整份优化计划已全部完成。',
        source: 'docs/plan-terminal-performance.md',
      },
    ],
  },
  'dsh-desktop': {
    focus: '原生生命周期 · 插件职责分离',
    cases: [
      {
        title: '服务重启，为什么会导致整个桌面应用闪退？', status: '实现核对',
        problem: '浮层导航尚未完成时重启服务，窗口对象可能还未销毁，但内部 WebContents 已失效。此时显示窗口会触发原生崩溃，JavaScript 异常捕获无法兜底。',
        decision: '同一插件的打开操作串行执行，关闭时使排队请求失效；每个异步边界检查操作归属、窗口与 WebContents 存活状态，用代际标识隔离旧鉴权结果。',
        tradeoff: '重点不是反复重试打开，而是阻止迟到操作影响新窗口。导航失败不能当作可以继续显示的成功结果。',
        evidence: '源码包含 generation 与双重销毁检查。2026-09-15 复盘记录：修复前隔离探针退出码 139，修复后连续完成 40 轮；这是历史记录，并非本次重新压测。',
        source: 'docs/restart-service-crash-2026-09-15.md',
      },
      {
        title: '更新能力放在插件还是桌面壳？', status: '仓库文档',
        problem: '版本检测需要后台运行与跨窗口共享，而安装和重启只能由原生宿主执行。全部堆进桌面壳，会让策略和平台能力相互耦合。',
        decision: '插件 host 负责检测与策略，桌面壳负责更新执行；browser 半侧传递壳版本和执行结果。菜单、托盘、通知、浮层按不同生命周期建模。',
        tradeoff: '增加了跨层回执，但避免把 Electron 对象暴露给页面。旧插件接口保留兼容期，新插件依赖明确的能力契约。',
        evidence: '桌面 API 文档明确区分 updates / seats / notify / overlays，以及“检测在插件，执行在壳”的迁移边界。',
        source: 'docs/desktop-api.md',
      },
    ],
  },
  fogot: {
    focus: '上下文预算 · 编辑器工具桥接',
    cases: [
      {
        title: '长任务如何继续，同时保留关键工具上下文？', status: '实现核对',
        problem: '场景探索、读文件和生成资产会不断累积工具结果。直接塞满历史会挤占模型输出空间，过早总结又容易丢失正在处理的任务细节。',
        decision: '上下文窗口先预留输出预算，再采用两层压缩：优先裁剪旧工具输出，必要时生成历史摘要；保留近期交互，并对指定工具作保护。',
        tradeoff: '压缩是有损的，不能承诺无限上下文。旧历史的摘要与近期原始消息分开保留，以平衡调用成本和任务连续性。',
        evidence: '已核对 context-budget.ts 与 compaction.ts。源码说明参考了 opencode 的两层策略，展示的是在编辑器中的集成实践。',
        source: 'editor/ai/chat-ui/src/ai/compaction.ts',
      },
      {
        title: '如何把“改场景”变成可执行的编辑器动作？', status: '仓库文档',
        problem: '游戏场景包含节点、属性和信号，单纯改文本不足以覆盖编辑器状态。AI 前端也不能直接持有原生编辑器内部对象。',
        decision: 'C++ 宿主拥有编辑器动作与 Tool RPC 分发，React 负责对话和 Agent 调度，经双向桥接将场景操作映射为明确工具。',
        tradeoff: '需要维护跨语言消息协议和各平台 WebView 实现，但能让交互层独立迭代，并将原生动作集中到宿主边界。',
        evidence: '仓库列出了场景节点、信号、骨骼等工具及 C++ / React 分层；不将 Godot 原有引擎能力作为独立原创成果。',
        source: 'README.md',
      },
    ],
  },
  'intro-builder': {
    focus: '可恢复编辑 · 富文本差异',
    cases: [
      {
        title: 'AI 改完简历，用户如何看懂变化并撤回？', status: '实现核对',
        problem: '自动保存只能保存当前内容，无法回答“AI 改了哪里”。简历还有模板与富文本结构，纯文本 diff 会丢失版式语义。',
        decision: '将会话内 Undo/Redo 与持久版本分开：连续输入合并为历史步，模板和 Agent 应用作为离散操作；差异数据保留富文本节点属性与样式标记。',
        tradeoff: '设计选择小体积简历的完整快照，简化恢复；不把每次自动保存都做成持久版本。当前实现的富文本对比不应宣传成完美识别块移动。',
        evidence: '已核对 use-resume-history.ts、resume-diff.ts、版本表迁移及相关测试文件。历史栈上限 50，连续输入合并窗口 2 秒。',
        source: 'docs/superpowers/specs/2026-06-25-resume-version-diff-undo-redo-design.md',
      },
      {
        title: '多用户、多个标签页，如何避免新简历会话串线？', status: '设计研究',
        problem: '从零创建简历若复用全局 session ID，不同用户或标签页可能互相覆盖状态。长时间流式诊断还可能被一次性的总超时误杀。',
        decision: '设计将用户哈希与 AG-UI thread ID 纳入会话身份；连接建立后切换为空闲超时，以持续收到数据判断健康状态。模型密钥限定在请求范围，定制地址进入校验。',
        tradeoff: '身份隔离、流式存活和模型入口安全要分别处理；仅拦截私网字面地址不能被表述为完整防御 DNS 重绑定。',
        evidence: '依据 Agent Security and Session Boundary Design。该案例展示设计约束，未在本次逐项核验所有安全分支。',
        source: 'docs/superpowers/specs/2026-06-13-agent-security-session-boundary-design.md',
      },
    ],
  },
  'r-api': {
    focus: '重试语义 · 单会话控制 · 运营治理',
    cases: [
      {
        title: '请求超时了，真的可以换一个渠道再发吗？', status: '实现核对',
        problem: '代理层超时不代表上游没有执行；流式响应已经开始后再重放，也可能重复输出或计费。多个网关同时重试还会放大请求量。',
        decision: '把业务请求和每次上游尝试分开记账，记录重试所有者、重放安全性和提交状态。response_started / completed 阻止本地重试，sent_unknown 仅在显式策略与确认同时满足时允许。',
        tradeoff: '可用性与重复执行风险存在冲突。保留“结果未知”这个状态，而不是将所有传输错误统一视为安全失败。',
        evidence: '已核对 proxyRetryContract.ts 的 canRetryLocally，以及请求账本运行时与 unknown 状态测试。未将代码分支核对等同于线上故障演练。',
        source: 'src/server/services/proxyRetryContract.ts',
      },
      {
        title: '人工接管与自动续跑，谁有权推进同一个会话？', status: '实现核对',
        problem: '远端 Prompt、自动续跑和桌面操作可能同时到达。旧命令已被领取时，立即派发新命令容易产生两个控制者，断网又让结果难以判定。',
        decision: '复用单会话 active_slot、租约与结果协议；新任务替代旧任务时保留已领取租约，等待权威事件对账。Connector 与桌面共享 managed App Server 的会话管理者与写入者。',
        tradeoff: '宁可在派发结果未知时等待，也不自动重复下发。观察和控制权限分离，只有设备实际观测到且具备控制权限的会话才能接管。',
        evidence: 'Local Connector 协议描述了人工 Prompt 与续跑的统一状态机；实现中有 dispatch_outcome_unknown 分支及对应测试。',
        source: 'docs/local-connector.md',
      },
      {
        title: '离线后补发，如何避免通知和回执重复推进状态？', status: '仓库文档',
        problem: '服务器可能已经接收结果，但响应在途中丢失。若本机直接删除记录会丢回执，重发又可能使状态重复推进。',
        decision: '事件和结果先进入本地耐久队列，收到服务器确认才删除；稳定 deliveryId 配合服务端唯一约束去重，结果回执优先于普通事件投递。',
        tradeoff: '允许重复投递，但控制重复处理；这不等于承诺外部副作用严格执行一次。服务器不可达时停止领取新动作，避免进一步扩大未确认工作。',
        evidence: '协议同时约束本地队列、确认删除、结果优先级与服务端 deliveryId 唯一性，通知复用 Durable Outbox。',
        source: 'docs/local-connector.md',
      },
      {
        title: '清理日志之后，成本报表为什么会“少一截”？', status: '设计研究',
        problem: '站点和模型已有长期聚合，而 Key 维度曾直接查询原始日志；清理明细会改变历史统计。请求前查余额、完成后扣款，也无法阻止并发超额。',
        decision: '研究提出先统一长期投影与统计口径，再增加归档：必要投影水位追平后才允许清理。额度以原子预占、结算、释放建模；告警事件生命周期与消息投递分层。',
        tradeoff: '优先解决数据一致性，再扩展归档与额度；不能把 Outbox 的投递成功当成故障解决，也不能把估算成本当成已结算账单。',
        evidence: '2026-08-18 治理差距分析提出的演进方案。本页保留“设计研究”标识，不将归档、时间窗配额与完整告警闭环声称为全部上线。',
        source: 'docs/research/operations-governance-gap-analysis.md',
      },
    ],
  },
  xuu: {
    focus: 'Prompt Cache · 上下文新鲜度 · 控制权',
    cases: [
      {
        title: '多个 Agent 协作，如何避免任务跑到错误的项目？', status: '仓库文档',
        problem: '长期存在的 Agent 身份与具体执行任务寿命不同。前台切换工作空间，不应让已经派发的工作转移到另一个项目。',
        decision: '将身份对话与 Harness 工作会话分开，执行会话绑定项目与配置；绑定冲突时明确报错。用户向执行会话发送消息后暂停协作自动指令，交还控制权。',
        tradeoff: '查看会话不等于接管，取消任务不等于回滚已经完成的文件修改。项目路由也不能代替文件系统沙箱。',
        evidence: '已直接核对 Rory-X/xuu 的 Collaboration 文档；本机同名 wuu 目录属于上游仓库，未据此归属个人贡献。',
        source: 'docs/en/desktop/collaboration.md',
      },
      {
        title: '任务已接收、某轮已结束，是否等于整个任务完成？', status: '仓库文档',
        problem: '自动化任务可能包含多次续跑或结构化输出修正。客户端如果把 run/start 成功或单个 turn/completed 当成最终成功，会提前结束等待。',
        decision: '区分 session、turn 与 run 的生命周期，客户端持续消费 run/updated，直到 run 进入终态；通信使用 stdio 请求、响应和通知协议。',
        tradeoff: '协议调用成功与业务任务成功分别判断。stdio 属于可信本地控制面，不能直接当作带鉴权的远程服务。',
        evidence: 'app-server 文档明确要求初始化、运行准入、终态等待与显式中断，并区分 run 与 turn。',
        source: 'docs/en/automation/app-server.md',
      },
    ],
  },
};
