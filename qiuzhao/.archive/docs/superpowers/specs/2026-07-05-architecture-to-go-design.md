# Architecture To Go Design

## Goal

把 [study8677/awesome-architecture](https://github.com/study8677/awesome-architecture) 的架构模板转译成 Go 学习体系：每个架构主题都有中文导读、Go 包结构模板、核心接口和最小代码实验。

## Source Scope

第一批只落 6 个和目标最贴近的模板：

- AI 中转站 / AI 网关。
- AI Agent / 工作流平台。
- RAG 知识库。
- 模型推理服务。
- 实时通讯。
- 通知 / 推送系统。

后续再扩展支付、搜索、向量数据库、在线票务、协同文档等模板。

## Output Structure

```text
docs/architecture-to-go/
  README.md
  source-awesome-architecture.md
  phase-1-matrix.md
  templates/
    ai-gateway.md
    ai-agent-platform.md
    rag-knowledge-base.md
    inference-serving.md
    realtime-chat.md
    notification-system.md

architecture_labs/
  README.md
  go.mod
  gateway/
  agent/
  rag/
  inference/
  realtime/
  notification/
```

## Learning Translation Rule

每个 awesome-architecture 模板按同一套方式落到 Go：

1. 架构问题：这类系统解决什么问题。
2. Go 边界：哪些 package 和 interface 应该存在。
3. 核心链路：只实现一条最关键的数据流。
4. 代码实验：用测试驱动一个最小可运行行为。
5. 扩展任务：列出从实验到生产系统还缺什么。

## Phase 1 Code Experiments

| Template | Go package | Core behavior |
|---|---|---|
| AI Gateway | `architecture_labs/gateway` | 按健康度和 fallback 顺序选择 provider |
| AI Agent / Workflow | `architecture_labs/agent` | 记录 session 事件并驱动 tool call 状态流 |
| RAG Knowledge Base | `architecture_labs/rag` | chunk -> retrieve -> rerank -> cited answer skeleton |
| Inference Serving | `architecture_labs/inference` | 把请求放入有上限的 batch queue |
| Realtime Chat | `architecture_labs/realtime` | 会话内递增序号和重复消息去重 |
| Notification System | `architecture_labs/notification` | 通知去重、限频和优先级队列 |

## Design Constraints

- 先用标准库，不引入第三方依赖。
- 每个实验保持小而清晰，可以单独阅读和测试。
- 不做完整 Web 服务，先练核心业务/架构机制。
- 文档必须明确说明从架构模板到 Go 代码的映射。
- 代码必须有测试，但当前本机没有 Go 工具链，验证会记录为环境限制。

## Success Criteria

- 根 README 能指向 architecture-to-go 学习路径。
- 每个第一批模板都有 Go 版设计文档。
- `architecture_labs` 至少包含 6 个 package 和对应测试。
- 测试命令写清楚：`cd architecture_labs && go test ./...`。
