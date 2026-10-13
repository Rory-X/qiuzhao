export type Project = {
  slug: string;
  name: string;
  repo: string;
  category: string;
  language: string;
  summary: string;
  intro: string;
  stack: string[];
  context: string;
  features: { title: string; text: string }[];
  flow: string[];
  engineering: { title: string; text: string }[];
  note?: string;
};

// Editorial summaries verified against each repository's README on 2026-09-22.
// Keep ownership and measured outcomes separate from repository capabilities.
export const projects: Project[] = [
  {
    slug: 'e-pi', name: 'E-Pi', repo: 'JustGenius-s/e-pi', category: 'Agent 桌面端', language: 'TypeScript',
    summary: '把 Pi 会话、终端与代码审查，收进一个桌面工作空间。',
    intro: '围绕 Pi Coding Agent 构建的桌面工作台，让发起任务、观察执行、审查修改与提交代码形成连贯的工作流。',
    stack: ['Electron', 'React 19', 'TypeScript', 'xterm.js', 'node-pty'],
    context: '当多个项目同时交给 Agent 执行时，会话、终端和 Git 状态很容易散落在不同窗口。E-Pi 按项目组织会话，把执行过程和代码变更放在同一个上下文里。',
    features: [
      { title: '并行会话', text: '每个会话运行独立的 Pi 进程，按项目分组，可在并行任务间切换。' },
      { title: '终端与审查', text: '集成终端、文件树和 Git diff，支持暂存、提交及 AI 提交信息。' },
      { title: '可视化配置', text: '管理模型、技能和包，并查看会话的上下文、Token 与成本信息。' },
    ],
    flow: ['React 工作界面', '类型化 IPC 桥接', '会话 / Git / 技能服务', '独立 Pi 进程'],
    engineering: [
      { title: '进程边界', text: 'Electron 主进程管理运行时服务，渲染进程经隔离的 preload 桥接调用能力，单会话对应独立进程。' },
      { title: '运行时可见性', text: 'Pi 扩展通过 JSON sidecar 报告遥测数据，让后台执行状态在桌面端可见。' },
      { title: '交付体验', text: '随安装包提供 Node sidecar，减少用户对本机 Node/npm 环境的依赖。' },
    ],
  },
  {
    slug: 'dsh-desktop', name: 'DSH-Desktop', repo: 'JustGenius-s/DSH-Desktop', category: '桌面运行时', language: 'TypeScript',
    summary: '为 DeepSeek Harness 提供开箱即用的桌面入口。',
    intro: '将 DeepSeek Harness 的安装、启动与更新收敛到 Electron 桌面壳中，让使用者从打开应用开始进入工作流。',
    stack: ['Electron', 'TypeScript', 'Node.js', 'pnpm', 'Vitest'],
    context: '命令行工具的首次安装和运行环境配置，会成为桌面使用的额外门槛。DSH-Desktop 将运行时准备交给应用，同时保留 DSH 原有的 Web 界面。',
    features: [
      { title: '运行时准备', text: '内置 Node 与 pnpm，首次启动将 DSH 安装到用户目录中的独立运行时。' },
      { title: '独立更新', text: '检查 DSH 新版本并更新运行时，可重启 Web 服务而不退出桌面应用。' },
      { title: '插件桥接', text: '通过 window.dshDesktop 暴露 updates、seats、notify 与 overlays 能力。' },
    ],
    flow: ['Electron 桌面壳', 'Node + pnpm', '本地 DSH 服务', 'DSH Web 界面'],
    engineering: [
      { title: '壳与运行时解耦', text: '桌面发布包与用户目录内的 DSH 运行时分离，让运行时更新不必重新打包桌面壳。' },
      { title: '端口生命周期', text: '成功启动后保存本地端口，冷启动优先复用；端口被占用时重新分配，不接管未知进程。' },
      { title: '扩展契约', text: '配套插件依赖桌面 API 合同，避免与 Electron 打包细节耦合。' },
    ],
  },
  {
    slug: 'fogot', name: 'Fogot', repo: 'JustGenius-s/Fogot', category: 'AI 游戏编辑器', language: 'C++',
    summary: '让 AI 进入 Godot 编辑器，连接设计、场景与资产。',
    intro: '基于 Godot 的 AI 2D 游戏编辑器探索，在原生编辑器中嵌入 React 助手，将自然语言任务连接到真实的场景与资源操作。',
    stack: ['Godot', 'C++', 'React', 'Vercel AI SDK', 'WebView'],
    context: '游戏创作不止于生成代码，还涉及场景节点、资产和设计设定。Fogot 把 AI 助手放进编辑器，让它在项目上下文中调用编辑器能力。',
    features: [
      { title: '多 Agent 与计划', text: '主 Agent 可委派 Explorer / Coder 子任务，并提供计划模式与设计模式。' },
      { title: '场景操作', text: '通过工具调用读写节点、属性和信号，连接对话与编辑器场景。' },
      { title: '创作资产', text: '整合图像、语音与音乐生成，并用设计文档和资产画廊组织内容。' },
    ],
    flow: ['React AI 面板', 'JS ↔ C++ 桥接', 'Tool RPC 分发', 'Godot 场景 / 文件'],
    engineering: [
      { title: '原生与 Web 混合架构', text: 'C++ 宿主负责 WebView 和编辑器动作，React 层负责对话与 Agent 逻辑，双向消息协议连接两层。' },
      { title: '上下文管理', text: '使用上下文预算与自动压缩支撑长会话，子 Agent 以隔离上下文执行子任务。' },
      { title: '跨平台宿主', text: 'macOS 使用 WKWebView，Windows 使用 WebView2；Linux WebView 支持仍列为计划。' },
    ],
    note: '基于 Godot Engine 的 fork；这里展示仓库中的 AI 编辑器扩展，不将 Godot 引擎本身归为个人原创。',
  },
  {
    slug: 'intro-builder', name: 'intro-builder', repo: 'Rory-X/intro-builder', category: '求职产品', language: 'TypeScript',
    summary: '从经历梳理到 PDF 交付，一站完成简历打磨。',
    intro: '面向中文互联网求职场景的在线简历工作台，将结构化编辑、实时 A4 预览、AI 诊断与协同批注串成完整流程。',
    stack: ['Next.js', 'TypeScript', 'AG-UI', 'PartyKit', 'pnpm workspace'],
    context: '写简历需要同时处理内容、排版和反馈。intro-builder 将内容与样式分离，让同一份经历能在编辑、预览、分享与 PDF 导出之间保持一致。',
    features: [
      { title: '结构化编辑', text: '按教育、工作、项目等模块组织经历，支持富文本、拖拽和自动保存。' },
      { title: 'AI 辅助打磨', text: '导入旧简历，使用流式诊断与润色建议，确认后再应用改写。' },
      { title: '协作与交付', text: '邀请导师批注或协作修改，导出 PDF，或生成可关闭的公开只读链接。' },
    ],
    flow: ['结构化简历', '模板与 A4 预览', 'AI / 导师反馈', 'PDF / 公开分享'],
    engineering: [
      { title: '复用渲染路径', text: '预览、公开分享和服务端 PDF 导出复用渲染路径，减少不同交付形式之间的版式偏差。' },
      { title: '服务边界', text: 'Monorepo 分为 Next.js 主站、Agent HTTP 服务与 PartyKit 协同服务，共享类型和 Schema。' },
      { title: '保存一致性', text: '自动保存结合防抖与串行队列，避免在途保存覆盖较新的内容。' },
    ],
  },
  {
    slug: 'r-api', name: 'r-api', repo: 'Rory-X/r-api', category: '模型基础设施', language: 'TypeScript',
    summary: '聚合分散的模型渠道，以一个入口管理路由与调用。',
    intro: '面向多站点、多账号的模型 API 聚合工作台，统一模型发现、路由、凭证与请求记录，并扩展本地 Agent 的连接与交互能力。',
    stack: ['Fastify', 'React', 'TypeScript', 'Drizzle ORM', 'Docker'],
    context: '当模型能力分散在多个渠道时，可用性、成本和凭证管理都需要统一视图。r-api 以兼容接口承接调用，再将请求分配到合适的上游。',
    features: [
      { title: '渠道聚合', text: '接入 New API、One API 等平台，集中管理账号、Token 和模型目录。' },
      { title: '路由与故障处理', text: '结合成本、余额及健康状态选择通道，并支持失败冷却与重试。' },
      { title: '本地连接与交互', text: '扩展 Local Connector、会话续跑和飞书交互，将本地任务接入可审计的流程。' },
    ],
    flow: ['兼容 API 请求', '路由与健康决策', '上游平台适配器', '请求账本 / 观测'],
    engineering: [
      { title: '区分请求与尝试', text: '分别记录业务请求和上游尝试；用 sent_unknown 表达结果未知，避免把不确定状态简单当成失败重试。' },
      { title: '凭证与权限', text: 'Credential Vault 统一管理秘密，管理员支持 Argon2id 与 TOTP；本地连接区分观察和控制权限。' },
      { title: '持久投递', text: '通知 Outbox 与会话续跑引入租约、退避和事件记录，为断线恢复与故障定位提供依据。' },
    ],
    note: '仓库 README 明确包含二开能力与后续规划。本页概括已描述的模块，不将规划项或上游通用能力表述为个人独立成果。',
  },
  {
    slug: 'xuu', name: 'xuu', repo: 'Rory-X/xuu', category: '本地 Agent 工作台', language: 'Go',
    summary: '围绕本地项目，与 AI Agent 一起读代码、执行与审查。',
    intro: '收录在 xuu 仓库中的本地 Agent 桌面工作台：连接模型、选择项目目录，以会话驱动代码阅读、文件修改与命令执行。',
    stack: ['Go', 'Electron', 'React', 'SQLite', 'ACP'],
    context: '本地项目任务需要同时保留会话上下文、执行权限与变更结果。该项目将工作空间和 Agent 对话放在一起，让执行过程可以回到文件与 diff 上审查。',
    features: [
      { title: '项目工作空间', text: '连接模型提供方，将本地目录作为工作空间，再发起读代码或修改任务。' },
      { title: '会话与群聊', text: '返回历史对话继续工作，也可将多个 Agent 放进群聊。' },
      { title: '桌面与 CLI', text: '通过插件扩展能力；CLI 提供脚本调用、JSONL 输出及会话控制。' },
    ],
    flow: ['本地工作空间', '会话 / Agent', '权限下的工具执行', '文件与 Diff 审查'],
    engineering: [
      { title: '显式权限模式', text: '文件变更和命令执行受当前权限模式约束，CLI 支持 read_only 等模式。' },
      { title: '会话持久化', text: '默认在 ~/.wuu 保存会话与配置，支持返回已有对话继续任务。' },
      { title: '可扩展入口', text: '桌面插件和 CLI 分别服务交互使用与自动化场景，模型请求由用户选择的提供方处理。' },
    ],
    note: '仓库名为 xuu，当前 README 的产品名称与链接仍为 wuu，并指向 blueberrycongee/wuu。这里保留名称差异；个人改动范围需以该仓库提交记录进一步界定。',
  },
];

export const projectPath = (project: Project) => `/projects/${project.slug}`;
