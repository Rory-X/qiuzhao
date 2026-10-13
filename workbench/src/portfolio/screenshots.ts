export type ScreenshotSlot = { title: string; scene: string; value: string };
export const screenshotSlots: Record<string, ScreenshotSlot[]> = {
  'e-pi': [
    { title: '一个窗口里的开发工作流', scene: '项目侧栏 + 正在执行的会话 + 代码审查面板', value: '展示 Agent 执行与代码审查如何衔接。' },
    { title: '并行会话，状态可见', scene: '多个会话的不同执行状态 + 当前会话的上下文用量', value: '展示并发任务的组织与可观测性。' },
    { title: '从修改到提交', scene: '真实任务产生的 diff + 文件列表 + 提交信息', value: '展示实际变更如何被审查与交付。' },
  ],
  'dsh-desktop': [
    { title: '从桌面进入 DSH', scene: '完整应用窗口 + 已启动的 DSH + 一条真实任务', value: '展示桌面壳承载的实际工作环境。' },
    { title: '运行时更新', scene: '更新检查或更新结果，包含清晰的版本与状态', value: '展示桌面壳与 DSH 运行时独立更新的能力。' },
    { title: '插件与桌面联动', scene: '实际安装的插件触发桌面通知或浮层', value: '展示桌面桥接 API 的可见结果。' },
  ],
  fogot: [
    { title: 'AI 与场景同屏', scene: 'Godot 场景树 + 2D 视口 + Fogot AI 面板', value: '直观看到 AI 已进入原生游戏编辑器。' },
    { title: '一句指令，改变场景', scene: '场景操作的工具结果 + 对应节点或视口变化', value: '证明助手能够操作场景，而不只是在聊天。' },
    { title: '从资产到游戏画面', scene: '生成的资产 + 场景中的实际使用效果', value: '展示创作资产到可用游戏内容的闭环。' },
  ],
  'intro-builder': [
    { title: '编辑即预览', scene: '结构化编辑区 + 内容完整的 A4 简历预览', value: '展示内容编辑与排版结果的即时关联。' },
    { title: 'AI 改写有依据', scene: '一段原始经历 + 对应诊断或润色建议', value: '展示具体内容的改善，而不只是空白聊天框。' },
    { title: '反馈落到具体内容', scene: '导师在某段经历上的批注 + 对应简历内容', value: '展示多人反馈与简历打磨的实际联系。' },
  ],
  'r-api': [
    { title: '统一管理模型渠道', scene: '有真实记录的渠道概览或数据看板', value: '展示分散渠道被统一管理后的信息密度。' },
    { title: '一次路由，为什么选它', scene: '某个模型的候选通道 + 路由决策或健康状态', value: '体现路由决策的可解释性。' },
    { title: '请求如何被追踪', scene: '脱敏的请求详情 + 上游尝试或失败记录', value: '展示可靠性设计如何落实为可审计证据。' },
  ],
  xuu: [
    { title: '围绕项目与 Agent 协作', scene: '工作空间 + 一条有工具执行记录的 Agent 会话', value: '展示本地项目与会话的关联。' },
    { title: '执行之后，审查结果', scene: '真实任务的文件变更与 diff', value: '展示从对话指令到代码结果的过程。' },
    { title: '多个 Agent，协作一件事', scene: '群聊中不同 Agent 的任务上下文与回复', value: '展示多 Agent 协作的交互方式。' },
  ],
};

// Add <slug>-01.png (or jpg/jpeg/webp) here; Vite imports and hashes real assets.
const assets = import.meta.glob<string>('../assets/project-shots/*.{png,jpg,jpeg,webp}', {
  eager: true, query: '?url', import: 'default',
});
export function screenshotUrl(slug: string, index: number) {
  const stem = `../assets/project-shots/${slug}-${String(index + 1).padStart(2, '0')}`;
  return ['png', 'webp', 'jpg', 'jpeg'].map((ext) => assets[`${stem}.${ext}`]).find(Boolean);
}
