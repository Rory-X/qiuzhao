# Advanced Systems Materials

这一组材料服务你的最终目标：学习大业务系统，特别是 AI gateway 分发、agent 对话流、高并发、高可用和可观测。

2026-07-06 已重新核验远端 HEAD。本页保留 `Anchored + Mapped` 的读法：按仓库、入口、关键链路、可迁移概念和本地 Go lab 建立分段剖析骨架；源码级锚点见 [`../knowledge-handbook/source-code-anchors-advanced.md`](../knowledge-handbook/source-code-anchors-advanced.md)，详细代码块见各工作目录的 `github-project-analysis.md`。

## Reading Lens

读高级系统时，不从最大文件开始。每个仓库只追四层：

1. README：系统承诺了什么。
2. Entry：如何启动、加载配置、组装依赖。
3. Critical path：一次请求、事件、任务或消息如何穿过系统。
4. Lifecycle：超时、背压、重试、健康检查、关闭、metrics、trace。

Backlinks:

- [AI Gateway](../knowledge-handbook/concepts/ai-gateway.md)
- [Agent Runtime](../knowledge-handbook/concepts/agent-runtime.md)
- [Concurrency And Backpressure](../knowledge-handbook/concepts/concurrency-backpressure.md)
- [Observability](../knowledge-handbook/concepts/observability.md)
- [Durable Workflow](../knowledge-handbook/concepts/durable-workflow.md)
- [Advanced Source Code Anchors](../knowledge-handbook/source-code-anchors-advanced.md)

## maximhq/bifrost

Source: [maximhq/bifrost](https://github.com/maximhq/bifrost/tree/4be1d6d3eafcb39f6af49d33c1a7f4dd9285535c)

Read status: `Anchored + Mapped`

### Why Read It

Bifrost 是 AI gateway 方向的直接参考。它应优先服务三个问题：

- 一个统一入口如何路由到多个模型 provider？
- provider 失败、超时、限流时如何 fallback？
- 请求、成本、错误和延迟如何被观测？

### Segment A: README Product Promise

Source anchor: repository README and local segment card [`large-system-segments.md#maximhqbifrost`](../knowledge-handbook/source-segments/large-system-segments.md#maximhqbifrost).

What it says: 先确认它是否把自己定位为 LLM gateway、AI gateway 或 provider abstraction 层。README 的产品承诺决定你应该读 routing、key management、fallback、plugin、telemetry 还是 deployment。

Why it matters: AI gateway 不是简单反向代理。它要理解模型能力、provider 差异、token usage、streaming response、错误分类和成本。

Go design transfer:

```text
http request -> auth/quota -> route policy -> provider client -> normalize -> telemetry
```

Backlinks: [AI Gateway](../knowledge-handbook/concepts/ai-gateway.md), [Observability](../knowledge-handbook/concepts/observability.md)

Local lab: [`architecture_labs/gateway`](../../architecture_labs/gateway/router.go)

### Segment B: Provider Selection

Source anchor: `core/bifrost.go` / `ProviderQueue` and provider routing segment in [`large-system-segments.md#segment-provider-queue`](../knowledge-handbook/source-segments/large-system-segments.md#segment-provider-queue).

What it says: 重点找 provider registry、route policy、fallback chain、provider health、model mapping。不要先读 SDK 适配器细节，先读“选择哪个 provider”的决策点。

Why it matters: 这是 AI gateway 的骨架。限流、熔断、成本、观测都挂在 provider selection 前后。

Go design transfer:

```go
type ProviderClient interface {
    Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type RoutePolicy interface {
    Select(ctx context.Context, req ChatRequest) (ProviderClient, error)
}
```

Failure mode: provider selection 如果直接写在 HTTP handler 里，后续做动态配置、灰度、模型迁移会非常痛。

Backlinks: [Architecture Boundaries](../knowledge-handbook/concepts/architecture-boundaries.md)

### Segment C: Fallback And Error Taxonomy

Source anchor: `shouldTryFallbacks`, `prepareFallbackRequest`, `shouldContinueWithFallbacks` and local segment [`large-system-segments.md#segment-fallback-decision`](../knowledge-handbook/source-segments/large-system-segments.md#segment-fallback-decision).

What it says: 找它如何区分 provider timeout、provider 5xx、quota exceeded、invalid request、auth failure。不是所有错误都应该 fallback。

Why it matters: 大流量系统里错误分类就是流量控制。把不可重试错误拿去 fallback，会放大成本和延迟。

Go design transfer:

```text
Retryable: timeout, transient 5xx, connection reset
Non-retryable: invalid request, auth failure, quota exhausted by tenant
Maybe retryable: provider rate limit, depends on policy and budget
```

Backlinks: [Concurrency And Backpressure](../knowledge-handbook/concepts/concurrency-backpressure.md)

### Segment D: Telemetry

Source anchor: Bifrost observability paths plus the local code translation in [`reference-implementations.md#16-telemetry-pipeline`](../knowledge-handbook/reference-implementations.md#16-telemetry-pipeline).

What it says: 找请求是否记录 provider、model、latency、tokens、fallback attempts、error class。

Why it matters: AI gateway 的可观测必须带业务维度。只有 HTTP 200/500 不够，你需要知道哪个 provider、哪个模型、哪个租户、哪种失败。

Go design transfer:

```text
metrics: gateway_requests_total{provider,model,status,error_class}
histogram: provider_latency_seconds{provider,model}
span: gateway.route -> provider.call -> fallback.attempt
```

Backlinks: [Observability](../knowledge-handbook/concepts/observability.md)

## trpc-group/trpc-agent-go

Source: [trpc-group/trpc-agent-go](https://github.com/trpc-group/trpc-agent-go/tree/9a515687538be3519405d40bb7db19a27efb3800)

Read status: `Anchored + Mapped`

### Why Read It

这是 Go agent runtime 方向的直接参考。重点不是“怎么调模型”，而是 agent 如何把 message、tool、event、runner、graph 组织成可追踪执行流。

### Segment A: Agent Abstraction

Source anchor: repository README, agent packages and local segment [`large-system-segments.md#trpc-grouptrpc-agent-go`](../knowledge-handbook/source-segments/large-system-segments.md#trpc-grouptrpc-agent-go).

What it says: 找 `Agent` 概念是否表达 name、instruction、model、tools、memory、planner 或 graph。Agent 应该是能力描述，不应该自己承担所有执行细节。

Why it matters: 如果 Agent 同时负责配置、运行、工具执行、事件存储、网络输出，会很快变成 God object。

Go design transfer:

```text
Agent config -> Runner execution -> Event stream -> Session store
```

Backlinks: [Agent Runtime](../knowledge-handbook/concepts/agent-runtime.md), [Architecture Boundaries](../knowledge-handbook/concepts/architecture-boundaries.md)

Local lab: [`architecture_labs/agent`](../../architecture_labs/agent/session.go)

### Segment B: Runner And Event Flow

Source anchor: `event/event.go`, runner/event paths and local segment [`large-system-segments.md#segment-event-model`](../knowledge-handbook/source-segments/large-system-segments.md#segment-event-model).

What it says: 找一次 user input 如何变成 model step、tool call、tool result、assistant output。重点看事件类型和事件顺序。

Why it matters: agent 对话流必须能被 UI 展示、被 trace 记录、被重放和恢复。事件不是日志，它是系统事实。

Go design transfer:

```text
UserMessage
ModelStarted
ToolCallStarted
ToolCallFinished
AssistantMessage
RunCompleted
```

Failure mode: 没有稳定 event ID 和 tool call ID，流式 UI、重试、审计都会断。

Backlinks: [Durable Workflow](../knowledge-handbook/concepts/durable-workflow.md)

### Segment C: Tool Boundary

Source anchor: tool packages/examples and local segment [`large-system-segments.md#segment-tool-boundary`](../knowledge-handbook/source-segments/large-system-segments.md#segment-tool-boundary).

What it says: 找 tool 如何声明 schema、执行函数、权限、错误和结果。tool 是 agent 系统的外部副作用边界。

Why it matters: 工具执行会访问数据库、搜索、浏览器、外部 API 或内部服务。它必须有 timeout、输入校验、权限和审计。

Go design transfer:

```go
type Tool interface {
    Name() string
    Invoke(ctx context.Context, input []byte) ([]byte, error)
}
```

Backlinks: [Observability](../knowledge-handbook/concepts/observability.md)

### Segment D: Graph Or Workflow

Source anchor: `agent/graphagent/*` and local segment [`large-system-segments.md#segment-graph-agent`](../knowledge-handbook/source-segments/large-system-segments.md#segment-graph-agent).

What it says: 找它是否支持节点、边、条件分支、循环、handoff 或 human-in-the-loop。

Why it matters: 简单 agent 可以是一条 loop；复杂业务 agent 必须显式表达流程，否则状态会藏进 prompt 和 if/else。

Go design transfer:

```text
Node -> Execute(ctx, state) -> Decision -> Next node
```

Backlinks: [Durable Workflow](../knowledge-handbook/concepts/durable-workflow.md)

## TykTechnologies/tyk

Source: [TykTechnologies/tyk](https://github.com/TykTechnologies/tyk/tree/f20ba226415b6ffd37e1872c4e6d92bd83c002f0)

Read status: `Anchored + Mapped`

### Why Read It

Tyk 是传统 API gateway 参考。它不专门服务 AI，但它在 auth、policy、rate limit、proxy pipeline、analytics 上很成熟，正好补 AI gateway 容易忽略的“生产网关基本功”。

### Segment A: Gateway Request Pipeline

Source anchor: Tyk gateway middleware/proxy path and local segment [`large-system-segments.md#tyktechnologiestyk`](../knowledge-handbook/source-segments/large-system-segments.md#tyktechnologiestyk).

What it says: 找请求进入网关后经过哪些 middleware：认证、策略、限流、版本、转发、响应处理、日志/分析。

Why it matters: AI gateway 也要有同样管道，只是业务维度换成模型、provider、tokens、tenant。

Go design transfer:

```text
HTTP -> auth -> policy -> quota -> transform -> route -> upstream -> analytics
```

Backlinks: [AI Gateway](../knowledge-handbook/concepts/ai-gateway.md)

### Segment B: Policy And Quota

Source anchor: `gateway/mw_rate_limiting.go`, policy/rate limit modules and local segment [`large-system-segments.md#segment-rate-limit-middleware`](../knowledge-handbook/source-segments/large-system-segments.md#segment-rate-limit-middleware).

What it says: 找 API key、policy、quota、rate limit 如何关联。注意策略通常不是写死在 handler，而是配置驱动。

Why it matters: AI gateway 的成本风险比普通 API 更高。quota 需要按 user、API key、model、provider、token budget 组合。

Go design transfer:

```text
TenantPolicy {
  RequestsPerMinute
  TokensPerDay
  AllowedModels
  FallbackAllowed
}
```

Backlinks: [Concurrency And Backpressure](../knowledge-handbook/concepts/concurrency-backpressure.md)

### Segment C: Analytics

Source anchor: `gateway/analytics.go` and local segment [`large-system-segments.md#segment-analytics-pipeline`](../knowledge-handbook/source-segments/large-system-segments.md#segment-analytics-pipeline).

What it says: 找网关如何记录 request/response 元数据，以及异步 flush 到存储或分析系统。

Why it matters: 网关不应该在热路径同步写慢存储。请求日志、成本统计和 trace 需要有异步出口和失败策略。

Backlinks: [Observability](../knowledge-handbook/concepts/observability.md)

## cloudwego/hertz

Source: [cloudwego/hertz](https://github.com/cloudwego/hertz/tree/8eec17d4e8b972075cdfa6d6b78822c3db086379)

Read status: `Anchored + Mapped`

### Why Read It

Hertz 是高性能 Go HTTP 框架参考。你不一定要在学习项目里马上使用它，但应该理解高并发入口会关心 router、middleware、request context、网络层、连接复用和对象复用。

### Segment A: Server Bootstrap

Source anchor: `pkg/route/engine.go`, `pkg/app` and local segment [`large-system-segments.md#segment-engine-and-middleware`](../knowledge-handbook/source-segments/large-system-segments.md#segment-engine-and-middleware).

What it says: 找 server 如何配置地址、路由、middleware、网络参数和启动关闭。

Why it matters: 高并发网关入口必须有清晰生命周期，不只是 `ListenAndServe`。

Go design transfer:

```text
server config -> router -> middleware chain -> graceful shutdown
```

Backlinks: [Architecture Boundaries](../knowledge-handbook/concepts/architecture-boundaries.md)

### Segment B: Request Context

Source anchor: Hertz app/request context paths and local translation in [`system-blueprints.md#2-chat-completion-flow`](../knowledge-handbook/system-blueprints.md#2-chat-completion-flow).

What it says: 找它如何包装 request/response、params、headers、body、context values。高性能框架常会做对象复用，这会影响你能不能把对象跨 goroutine 保存。

Why it matters: AI streaming 和并发 provider 调用容易把 request context 用错。要明确哪些对象只在请求生命周期有效。

Backlinks: [Concurrency And Backpressure](../knowledge-handbook/concepts/concurrency-backpressure.md)

### Segment C: Middleware Chain

Source anchor: middleware/router paths and local segment [`large-system-segments.md#segment-engine-and-middleware`](../knowledge-handbook/source-segments/large-system-segments.md#segment-engine-and-middleware).

What it says: 找 middleware 的函数签名和 next 调用方式。

Why it matters: auth、rate limit、trace、panic recover、request size limit 都应该是 middleware，而不是散落在每个 handler。

Backlinks: [AI Gateway](../knowledge-handbook/concepts/ai-gateway.md), [Observability](../knowledge-handbook/concepts/observability.md)

## open-telemetry/opentelemetry-collector

Source: [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector/tree/00f6354e6f8b7daf031908f7bb0637c6aeb1201d)

Read status: `Anchored + Mapped`

### Why Read It

OpenTelemetry Collector 是可观测 pipeline 的标杆。它把 telemetry 数据拆成 receiver、processor、exporter，再由 service graph 组装。

### Segment A: Pipeline Shape

Source anchor: collector service pipeline config and local segment [`large-system-segments.md#open-telemetryopentelemetry-collector`](../knowledge-handbook/source-segments/large-system-segments.md#open-telemetryopentelemetry-collector).

What it says: 数据不是直接从应用写到最终后端，而是先进入 receiver，再经过 processor，最后到 exporter。

Why it matters: AI gateway 的观测也可以这样拆：采集请求事件、处理脱敏/聚合/采样、导出到日志、metrics、trace 后端。

Go design transfer:

```text
receiver -> processor -> exporter
```

Backlinks: [Observability](../knowledge-handbook/concepts/observability.md)

### Segment B: Component Interface

Source anchor: `receiver`, `processor`, `exporter`, `component` and local segment [`large-system-segments.md#segment-receiver-processor-exporter`](../knowledge-handbook/source-segments/large-system-segments.md#segment-receiver-processor-exporter).

What it says: 组件通过小接口插拔，生命周期由 service 统一管理。

Why it matters: provider adapter、telemetry exporter、tool adapter 都可以走类似思路：小接口 + factory + lifecycle。

Backlinks: [Architecture Boundaries](../knowledge-handbook/concepts/architecture-boundaries.md)

### Segment C: Processor Responsibilities

Source anchor: processor packages and local code in [`system-blueprints.md#8-telemetry-flow`](../knowledge-handbook/system-blueprints.md#8-telemetry-flow).

What it says: processor 可以做批处理、过滤、属性处理、采样、限流。

Why it matters: AI gateway 可以在 telemetry processor 层做 token 聚合、PII 脱敏、tenant 维度采样，而不是污染业务 handler。

Backlinks: [AI Gateway](../knowledge-handbook/concepts/ai-gateway.md)

## temporalio/temporal

Source: [temporalio/temporal](https://github.com/temporalio/temporal/tree/a31f476255b2c7c00176f683cdce84710daaba44)

Read status: `Anchored + Mapped`

### Why Read It

Temporal 用于理解 durable execution。Agent runtime 里长任务、人工介入、多步工具调用、失败恢复都会遇到 Temporal 擅长的问题。

### Segment A: Workflow History

Source anchor: `service/history/*` and local segment [`large-system-segments.md#segment-workflow-history`](../knowledge-handbook/source-segments/large-system-segments.md#segment-workflow-history).

What it says: 工作流不是只保存最终状态，而是保存事件历史。恢复时通过历史重建执行上下文。

Why it matters: Agent session 也应该保存事件流，而不是只保存最后一条 assistant message。

Go design transfer:

```text
Event history -> Replay -> Decide next command
```

Backlinks: [Agent Runtime](../knowledge-handbook/concepts/agent-runtime.md), [Durable Workflow](../knowledge-handbook/concepts/durable-workflow.md)

### Segment B: Matching And Worker

Source anchor: `service/matching/*`, `service/worker/*` and local segment [`large-system-segments.md#segment-matching-and-worker`](../knowledge-handbook/source-segments/large-system-segments.md#segment-matching-and-worker).

What it says: 任务需要被分派给 worker；worker 轮询任务、执行 activity、上报结果。

Why it matters: agent tool call 或长时间 workflow node 可以异步执行，不必都卡在 HTTP 请求线程里。

Go design transfer:

```text
Task queue -> worker poll -> execute -> append event -> schedule next
```

Backlinks: [Concurrency And Backpressure](../knowledge-handbook/concepts/concurrency-backpressure.md)

### Segment C: Determinism

Source anchor: history command validation paths and local segment [`large-system-segments.md#segment-command-validation`](../knowledge-handbook/source-segments/large-system-segments.md#segment-command-validation).

What it says: 可重放工作流要求核心决策可重复，副作用通过 activity 边界处理。

Why it matters: Agent graph 如果要恢复，模型调用和工具调用这种非确定性动作也必须被事件记录包住。

Backlinks: [Durable Workflow](../knowledge-handbook/concepts/durable-workflow.md)

## nats-io/nats-server

Source: [nats-io/nats-server](https://github.com/nats-io/nats-server/tree/dd0f12d479de19df97e3c6275ab087f8e3b91891)

Read status: `Anchored + Mapped`

### Why Read It

NATS 用于理解高吞吐消息、连接管理、fan-out、订阅、路由和持久流。对 AI gateway 和 agent runtime 来说，它是异步事件总线、通知、任务队列和实时广播的参考。

### Segment A: Client And Subscription

Source anchor: `server/sublist.go`, `server/client.go` and local segment [`large-system-segments.md#segment-subject-and-subscription`](../knowledge-handbook/source-segments/large-system-segments.md#segment-subject-and-subscription).

What it says: 消息系统首先管理连接、订阅关系和消息投递。

Why it matters: Agent event stream、realtime chat、notification queue 都需要清楚谁订阅了什么，以及慢消费者如何处理。

Go design transfer:

```text
subject -> subscribers -> fan-out -> slow consumer policy
```

Backlinks: [Concurrency And Backpressure](../knowledge-handbook/concepts/concurrency-backpressure.md)

### Segment B: Routing And Gateway

Source anchor: `server/route.go` and local segment [`large-system-segments.md#segment-routing`](../knowledge-handbook/source-segments/large-system-segments.md#segment-routing).

What it says: 多节点消息系统需要路由表、集群连接、跨节点传播和断线恢复。

Why it matters: 后续如果 gateway_lab 做多实例，session event 或 provider health 可能需要跨实例同步。

Backlinks: [AI Gateway](../knowledge-handbook/concepts/ai-gateway.md)

### Segment C: JetStream

Source anchor: `server/jetstream.go` and local segment [`large-system-segments.md#segment-jetstream`](../knowledge-handbook/source-segments/large-system-segments.md#segment-jetstream).

What it says: 持久流把消息从“瞬时广播”升级为“可确认、可重放、可恢复”的事件日志。

Why it matters: Agent durable event store、notification retry、audit log 都可以借鉴这个思想。

Backlinks: [Durable Workflow](../knowledge-handbook/concepts/durable-workflow.md)

## 本阶段输出

读完高级系统第一轮，你应该能把最终项目拆成这些 Go 模块：

```text
cmd/gateway
internal/gateway/httpapi
internal/gateway/auth
internal/gateway/ratelimit
internal/gateway/router
internal/gateway/provider
internal/gateway/telemetry
internal/agent/session
internal/agent/event
internal/agent/runner
internal/agent/tool
internal/agent/graph
internal/platform/queue
internal/platform/observability
internal/platform/workflow
```

下一步源码级补读顺序：

1. Bifrost：README -> provider routing -> fallback -> telemetry。
2. trpc-agent-go：README -> Agent -> Runner -> Event -> Tool -> Graph。
3. OpenTelemetry Collector：README -> component interface -> pipeline builder -> processor/exporter。
4. NATS：server/client -> subscription -> fan-out -> slow consumer。
5. Temporal：frontend/history/matching/worker -> workflow history -> activity boundary。
