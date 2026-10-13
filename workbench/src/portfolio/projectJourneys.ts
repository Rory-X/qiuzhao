import { xuuJourney, xuuResearchHead } from './xuuJourney';

export type JourneyStage = { date: string; title: string; before: string; change: string; lesson: string; contract: string; commits: { sha: string; label: string; file: string; author?: string }[] };
export type ProjectJourney = { repo: string; head: string; intro: string; stages: JourneyStage[] };

export const projectJourneys: Record<string, ProjectJourney> = {
  "e-pi": {
    "repo": "Rory-X/e-pi",
    "head": "f2daf61dc3c94684329a58b49cd6f73010753755",
    "intro": "终端画面一致性 → 尺寸协议 → 多仓库工作空间",
    "stages": [
      {
        "date": "2026.08.08",
        "title": "从“有写入就等”改为识别大帧",
        "before": "展开面板后终端出现黑边：持续的 spinner 小块输出让写队列一直非空，本地缩放因此被反复阻止。",
        "change": "将本地重排的判断从是否存在待写入，改为待写入字节量；超过 4KB 才暂停本地重排，PTY 尺寸更新仍采用独立节奏。",
        "lesson": "区分小增量与完整重绘，才能兼顾即时跟随和解析一致性。4KB 是该版本的工程阈值，不是通用终端标准。",
        "contract": "xterm-resize-scheduler.test.ts 随提交调整大帧与小块输出场景；本次未重新执行终端性能测试。",
        "commits": [
          {
            "sha": "f5e7e389f42c554df7ed6bc7f0e0056a8dde05d2",
            "label": "从“有写入就等”改为识别大帧",
            "file": "src/lib/xtermResizeScheduler.ts",
            "author": "jiahaoqian"
          }
        ]
      },
      {
        "date": "2026.08.10",
        "title": "从缩放时序补丁走向明确的帧协议",
        "before": "快速改变窗口尺寸时，新旧尺寸的 PTY 输出可能交错，仅靠延时无法判断哪一帧可以接替当前画面。",
        "change": "桥接层在完整重绘前缀后写入不占终端格子的 APC 尺寸标记；解析结果区分 pending、untagged、invalid 和 tagged，并配合输出门控与视觉保护。",
        "lesson": "引入对 TUI 和桥接层的协议协作成本，换取可判断的帧归属；不能将任意到达的数据块都当成目标尺寸的完整画面。",
        "contract": "提交包含 resize protocol、output gate、visual guard 三组测试，以及 OSC52、重放缓冲与调度器回归。",
        "commits": [
          {
            "sha": "1befcdf06bb234fded7a0e9eb1faf615403eb603",
            "label": "从缩放时序补丁走向明确的帧协议",
            "file": "src/lib/terminalResizeProtocol.ts",
            "author": "jiahaoqian"
          }
        ]
      },
      {
        "date": "2026.08.11",
        "title": "工作空间扩展后，文件操作也必须知道所属仓库",
        "before": "一个项目关联多个仓库后，不同目录都可能出现 src 等相同路径；沿用单一根目录会让查找、展开和工作目录选择产生歧义。",
        "change": "文件树变为多个根节点，使用绝对路径定位归属根，搜索结果在多根场景加仓库名；同一提交还稳定预览组件映射与回调，减少图片重新挂载闪动。",
        "lesson": "界面上的“一个项目”不再等于磁盘上的“一个目录”。显示名称可以聚合，但路径操作仍必须保持明确归属。",
        "contract": "file-tree.test.ts、project-workspace.test.ts 和桥接工作空间测试随提交新增；路径前缀使用目录分隔符避免同名前缀误匹配。",
        "commits": [
          {
            "sha": "a84503d2eea51aea30ffbf706c0cacbf7f311e31",
            "label": "工作空间扩展后，文件操作也必须知道所属仓库",
            "file": "src/lib/file-tree.ts",
            "author": "jiahaoqian"
          }
        ]
      }
    ]
  },
  "dsh-desktop": {
    "repo": "JustGenius-s/DSH-Desktop",
    "head": "07edc9a5deef07da2871c1b1f9d80c17d8789030",
    "intro": "服务热重启 → 更新职责拆分 → 稳定本地 Origin",
    "stages": [
      {
        "date": "2026.08.24",
        "title": "插件更新后，不必退出整个桌面应用",
        "before": "插件配置或 DSH 运行时更新只需要重载 Web 服务，重启 Electron 会同时中断桌面壳的使用体验。",
        "change": "建立独立 Web 服务生命周期入口，菜单、IPC 与更新桥复用；通过网页弹窗确认重启，使用请求 ID、ACK 重试与超时处理提示送达。",
        "lesson": "原生壳继续运行不代表子服务任务无中断。用户选择稍后或网页未接住询问时，不强制执行重启。",
        "contract": "该提交可核对 dsh-lifecycle.ts 与主进程接线；没有据此宣称后来浮层崩溃问题已在此版本修复。",
        "commits": [
          {
            "sha": "418b58f98901c9c3fd34ed304510668bd2cb1595",
            "label": "插件更新后，不必退出整个桌面应用",
            "file": "src/dsh-lifecycle.ts",
            "author": "jiahaoqian"
          }
        ]
      },
      {
        "date": "2026.09.01",
        "title": "把更新策略迁出桌面壳",
        "before": "检查发布版本、定时轮询与跳过版本属于更新策略；安装运行时和重启应用则依赖原生宿主，两类职责堆在一起使维护边界模糊。",
        "change": "将检测迁到插件的 Node host，桌面桥只执行安装、下载入口和重启等动作；browser 半侧交换壳版本和执行结果。",
        "lesson": "这是这一历史提交的职责收缩，后续分支可能保留旧插件兼容层；不能用当时“删除检测”的描述断言所有现行路径都已删除。",
        "contract": "提交删除 app-updater.ts，并收缩 desktop-bridge 与 API；通过历史版本源码核对，不将删除行数作为质量指标。",
        "commits": [
          {
            "sha": "04888a9311665bb3115a961db52f76ae60166237",
            "label": "把更新策略迁出桌面壳",
            "file": "src/desktop-bridge.ts",
            "author": "JustGenius-s"
          }
        ]
      },
      {
        "date": "2026.09.11",
        "title": "让冷启动保留浏览器偏好，同时清理过期 Cookie",
        "before": "每次启动随机端口会改变 Origin，缩放等偏好随之失效；Cookie 却不按端口隔离，含旧端口的鉴权 Cookie 会不断积累。",
        "change": "仅在成功启动后原子保存端口，下次可用则复用，被占用则另选；开发与安装版分别保存记录，加载前只清理 DSH 自己的回环鉴权 Cookie。",
        "lesson": "端口记录是 Chromium 邻接状态，不放进共享 DSH 配置。复用地址不等于接管占用该地址的未知进程，也不持久化带 token 的启动 URL。",
        "contract": "web-port.test.cjs 与 dsh-auth-cookies.test.cjs 随提交新增，分别覆盖端口记录与定向 Cookie 清理。",
        "commits": [
          {
            "sha": "ac9ea4bae62a84c85a835f7e30595111de10a0a5",
            "label": "让冷启动保留浏览器偏好，同时清理过期 Cookie",
            "file": "src/web-port.ts",
            "author": "jiahaoqian"
          }
        ]
      }
    ]
  },
  "fogot": {
    "repo": "JustGenius-s/Fogot",
    "head": "5db79b4cd2b6d7267c172c1da8b48a892f59dff4",
    "intro": "上下文预算 → 设计数据校验 → 可追踪子线程",
    "stages": [
      {
        "date": "2026.06.26",
        "title": "先为输出留空间，再决定如何压缩历史",
        "before": "文件与场景工具结果不断进入对话，全部保留会挤占可用上下文；只看输入长度也会遗漏模型继续输出所需空间。",
        "change": "独立预算函数从上下文窗口扣除预留输出空间，加入工具输出裁剪、锚定摘要与上下文管理，并接入主界面。",
        "lesson": "摘要和裁剪都有信息损失；预算管理解决容量约束，不保证长任务永远保留全部细节。此提交也不能证明固定比例的性能提升。",
        "contract": "核对 context-budget.ts 的 usableContext 和 compaction.ts；该提交未新增独立测试文件，本次只做实现阅读。",
        "commits": [
          {
            "sha": "d56d3aff30e5e96571cda4bf7783d03459bcfda3",
            "label": "先为输出留空间，再决定如何压缩历史",
            "file": "editor/ai/chat-ui/src/ai/context-budget.ts",
            "author": "justgenius"
          }
        ]
      },
      {
        "date": "2026.07.07",
        "title": "让无效设计文档在写入前失败",
        "before": "模型生成的设计文档可能缺少 frontmatter、YAML 语法错误或必填字段，宽松解析会让资产列表出现损坏条目。",
        "change": "write_design 在读取旧内容和写入之前检查 frontmatter 起止、YAML mapping 及 name/type，返回可供模型修正的明确错误。",
        "lesson": "格式检查只是一层准入，不能替代完整业务 Schema 与 Bible 一致性校验；模型生成的文字也必须通过数据约束。",
        "contract": "核对 checkDesignFormat 的返回分支与 execute 中先校验后写入的顺序；此提交没有新增测试，不将静态阅读写成测试通过。",
        "commits": [
          {
            "sha": "607615c6cae97f2d0f09623ad09c72f097892e2b",
            "label": "让无效设计文档在写入前失败",
            "file": "editor/ai/chat-ui/src/ai/tools/design.ts",
            "author": "justgenius"
          }
        ]
      },
      {
        "date": "2026.07.07",
        "title": "把子任务结果从临时卡片变成可浏览线程",
        "before": "子 Agent 的长执行记录不适合挤在主对话工具卡里；直接将大量记录写入 localStorage 又会触及容量限制。",
        "change": "添加 parentID 与 agentType，以子线程展示委派过程；线程元数据保存到本地，详细 parts 放入内存缓存，并用订阅版本驱动界面更新。",
        "lesson": "内存缓存缓解配额压力，但该版本的详细子线程记录不能据此宣称刷新后仍持久可恢复。可浏览和持久保存是两个不同目标。",
        "contract": "核对 createSubAgentThread、subAgentDataCache 与 getChildThreads；提交增加专门子线程视图，未新增独立测试文件。",
        "commits": [
          {
            "sha": "d823b6b830305e1552fd11aa9ded28f7fb9ece51",
            "label": "把子任务结果从临时卡片变成可浏览线程",
            "file": "editor/ai/chat-ui/src/lib/thread-storage.ts",
            "author": "justgenius"
          }
        ]
      }
    ]
  },
  "intro-builder": {
    "repo": "Rory-X/intro-builder",
    "head": "1567115e31ee86273e0822854f963971293723a8",
    "intro": "审批续跑 → 可等待的自动保存 → 版本恢复",
    "stages": [
      {
        "date": "2026.06.21",
        "title": "审批之后，继续完成同一个任务",
        "before": "Agent 遇到需确认的修改后暂停，用户批准只是决策完成；如果没有续跑上下文，任务会停留在一张已批准的卡片。",
        "change": "按消息跟踪待审批状态与 continuation，保存批准/拒绝决定后恢复流程；新建或切换会话清空待续跑映射，避免跨会话残留。",
        "lesson": "审批状态与运行状态分开管理。点“批准”不能直接等同于整个任务已完成，历史审批也不应触发当前会话续跑。",
        "contract": "agent-panel-assistant-ui.test.tsx 与 floating chat route 测试随 #100 更新；本次核对 UI 状态与续跑分支，未执行来源测试。",
        "commits": [
          {
            "sha": "af22319d55c8339a89f1635a26e8a6f58078ae8f",
            "label": "审批之后，继续完成同一个任务",
            "file": "apps/web/components/agent/floating-agent-chat.tsx",
            "author": "Rory"
          }
        ]
      },
      {
        "date": "2026.06.25",
        "title": "将“触发保存”升级为“等待保存完成”",
        "before": "AI 修改、版本操作和普通输入共用自动保存；派发一次保存事件，不代表当前内容已经落库，保存期间的新输入还可能排在后面。",
        "change": "在防抖和串行保存之上增加可等待的 flush，集中维护等待者；后续保存和重试完成后才 resolve，最终失败则 reject。",
        "lesson": "保存动作的完成语义成为业务边界，调用方需要处理失败。pagehide 发起保存不等于浏览器关闭前必定保存成功。",
        "contract": "use-resume-autosave.test.ts 随提交增加覆盖。来源为公开分支中的提交，不据此推定已合入 main 或上线。",
        "commits": [
          {
            "sha": "fc9d1444eb8608d27ede6cee29a460e439a576ec",
            "label": "将“触发保存”升级为“等待保存完成”",
            "file": "apps/web/hooks/use-resume-autosave.ts",
            "author": "intro-builder agent"
          }
        ]
      },
      {
        "date": "2026.06.25",
        "title": "从保存当前内容走向可比较、可撤回的编辑",
        "before": "自动保存解决落库，却不能让用户看懂 AI 改动或撤回误操作；纯文本比较还会破坏简历模板的阅读结构。",
        "change": "增加完整简历快照的 Undo/Redo 栈，连续输入按时间窗口合并；持久版本与富文本 Diff 独立建模，在 A4 预览中查看变化。",
        "lesson": "会话级撤销与跨会话版本恢复解决不同问题。历史栈有容量边界，不能将当前差异算法说成能识别所有富文本块移动。",
        "contract": "use-resume-history.ts 明确 MAX_UNDO=50、MERGE_WINDOW_MS=2000；提交包含版本操作、Diff 预览和历史栈相关测试。",
        "commits": [
          {
            "sha": "1567115e31ee86273e0822854f963971293723a8",
            "label": "从保存当前内容走向可比较、可撤回的编辑",
            "file": "apps/web/hooks/use-resume-history.ts",
            "author": "Rory"
          }
        ]
      }
    ]
  },
  "r-api": {
    "repo": "Rory-X/r-api",
    "head": "57900c4a916530bfbb9d23913964cec30731e4b3",
    "intro": "统一下游鉴权 → 流式提交边界 → 排队派发协议",
    "stages": [
      {
        "date": "2026.08.13",
        "title": "撤掉全局代理钥匙，统一下游调用身份",
        "before": "全局代理主密钥与托管下游 Key 并存，使调用统计、路由策略和文件资源归属存在两套路径。",
        "change": "移除全局代理密钥配置与入口，外部调用统一走托管 Key；管理端测试通过独立 internal tester 交接，资源所有者区分 managed_key 与 internal_tester。",
        "lesson": "清理鉴权旁路需要同步配置、备份、UI 和资源归属，不能只删设置页面。管理员身份也不应自动成为通用代理凭证。",
        "contract": "提交包含全局 token 清理与架构约束测试，并调整 HTTP、文件和 WebSocket 相关测试。",
        "commits": [
          {
            "sha": "796c56cc14fadbb2c923afbfa34faac767ab1b7d",
            "label": "撤掉全局代理钥匙，统一下游调用身份",
            "file": "src/server/middleware/auth.ts",
            "author": "jiahaoqian"
          }
        ]
      },
      {
        "date": "2026.08.18",
        "title": "为流式输出建立明确的提交点",
        "before": "一旦向客户端提交 SSE，失败后的换路由空间会收窄。过早输出与等待上游确认之间，需要明确的时间和状态边界。",
        "change": "引入延迟输出封装，提交前缓存 chunk 和 end 意图，提供 commit/discard；可配置定时提交，同批变更增加路由观测数据。",
        "lesson": "该版本定义 250ms 的前输出宽限常量，这是延迟预算而非响应提速指标。committed 后不能撤回已发送内容，discard 也不再生效。",
        "contract": "deferredSseOutput.test.ts 随提交新增，路由观测 API 另有测试。代码存在缓冲机制不等于所有失败都可以安全重试。",
        "commits": [
          {
            "sha": "b5f5b4913305b7c8ef8355a6c1fd503df7ecd4df",
            "label": "为流式输出建立明确的提交点",
            "file": "src/server/proxy-core/deferredSseOutput.ts",
            "author": "jiahaoqian"
          }
        ]
      },
      {
        "date": "2026.08.18",
        "title": "区分本机已排队与 Agent 已接受",
        "before": "Connector 已领取命令后，本机 Agent 仍可能繁忙；如果只保留成功/失败，队列等待会被误当成已执行，后续租约和回执也难以对账。",
        "change": "新增 queued 回执与 connector_queued 状态，本地消息记录 queued/dispatching、尝试次数与下次执行时间；后续 accepted/rejected/unknown 仍校验活动租约。",
        "lesson": "排队成功不是任务成功；收到 turn 事件时也要考虑当前命令是否仍在队列。把这种差异写入协议，比仅在 UI 上增加“等待”标签更重要。",
        "contract": "queue.test.ts、runtime.bridge.test.ts 与 bridgeContinuationState.test.ts 同步增加覆盖；本次未进行断网或崩溃注入。",
        "commits": [
          {
            "sha": "8ba09d9281337b963e39d9b80b1927f3fcc7c19d",
            "label": "区分本机已排队与 Agent 已接受",
            "file": "src/server/services/bridgeContinuationState.ts",
            "author": "jiahaoqian"
          }
        ]
      }
    ]
  }
};
projectJourneys.xuu = { repo: 'Rory-X/xuu', head: xuuResearchHead, intro: '上下文与协作协议 → 证据交接 → 运行可靠性与性能', stages: xuuJourney };
