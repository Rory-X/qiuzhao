# 05 GitHub Project Analysis: Large Business Systems

Verified: 2026-07-06.

本阶段服务最终目标：AI gateway 分发、agent 对话流、高并发、高可用、可观测和可靠工作流。这里的项目不建议一次啃完，而是沿关键链路读。

## Source Snapshot

| Project | HEAD | Read anchors |
|---|---:|---|
| [maximhq/bifrost](https://github.com/maximhq/bifrost/tree/4be1d6d3eafcb39f6af49d33c1a7f4dd9285535c) | `4be1d6d` | `README.md`, `core/bifrost.go`, `docs/architecture/*`, `examples/configs/*` |
| [trpc-group/trpc-agent-go](https://github.com/trpc-group/trpc-agent-go/tree/9a515687538be3519405d40bb7db19a27efb3800) | `9a51568` | `README.md`, `agent/*`, `event/event.go`, `agent/graphagent/*`, `tool/*` |
| [TykTechnologies/tyk](https://github.com/TykTechnologies/tyk/tree/f20ba226415b6ffd37e1872c4e6d92bd83c002f0) | `f20ba22` | `gateway/*`, `apidef/*`, `gateway/mw_rate_limiting.go`, `gateway/analytics.go` |
| [cloudwego/hertz](https://github.com/cloudwego/hertz/tree/8eec17d4e8b972075cdfa6d6b78822c3db086379) | `8eec17d` | `pkg/route/engine.go`, `pkg/app/*`, `pkg/protocol/*`, `pkg/app/client/middleware.go` |
| [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector/tree/00f6354e6f8b7daf031908f7bb0637c6aeb1201d) | `00f6354` | `component/*`, `receiver/*`, `processor/*`, `exporter/*`, `exporter/exporterhelper/internal/queue/*` |
| [temporalio/temporal](https://github.com/temporalio/temporal/tree/a31f476255b2c7c00176f683cdce84710daaba44) | `a31f476` | `service/history/*`, `service/matching/*`, `service/worker/*`, `README.md` |
| [nats-io/nats-server](https://github.com/nats-io/nats-server/tree/dd0f12d479de19df97e3c6275ab087f8e3b91891) | `dd0f12d` | `main.go`, `server/client.go`, `server/sublist.go`, `server/route.go`, `server/jetstream.go` |
| [study8677/awesome-architecture](https://github.com/study8677/awesome-architecture/tree/609e0cd64d6af89549112379cbdd0f0e6cf63a3a) | `609e0cd` | `templates/ai-gateway`, `templates/ai-agent-platform`, `templates/rag-knowledge-base`, `templates/inference-serving` |

## Key Code Blocks

这些代码块把高级系统的关键链路翻译成本工作区后续可以实现的 Go 模板。

### Bifrost-Style Provider Queue

Provider 不只是配置项，还需要并发容量和队列。

```go
type ProviderQueue struct {
	name     string
	capacity int
	jobs     chan ProviderJob
}

func NewProviderQueue(name string, capacity int) *ProviderQueue {
	return &ProviderQueue{
		name:     name,
		capacity: capacity,
		jobs:     make(chan ProviderJob, capacity),
	}
}

func (q *ProviderQueue) TrySubmit(job ProviderJob) error {
	select {
	case q.jobs <- job:
		return nil
	default:
		return ErrProviderQueueFull
	}
}
```

### Bifrost-Style Fallback Loop

Fallback 需要判断错误类型和策略，不是无脑重试。

```go
func (g *Gateway) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	attempts := append([]Route{{Provider: req.Provider, Model: req.Model}}, req.Fallbacks...)

	var lastErr error
	for i, route := range attempts {
		resp, err := g.call(ctx, route, req)
		if err == nil {
			g.telemetry.RecordSuccess(route, i)
			return resp, nil
		}
		lastErr = err
		if !CanFallback(err) {
			break
		}
		g.telemetry.RecordFallback(route, err)
	}
	return ChatResponse{}, lastErr
}
```

### Agent Event And Tool Call

trpc-agent-go 的启发：tool call 和 tool response 都应该成为事件流的一部分。

```go
type Event struct {
	ID         string
	SessionID  string
	Type       EventType
	ToolCallID string
	Content    string
}

func (r *Runner) runTool(ctx context.Context, session *Session, call ToolCall) error {
	session.Append(Event{Type: EventToolCallStarted, ToolCallID: call.ID})

	result, err := r.tools.Invoke(ctx, call.Name, call.Args)
	if err != nil {
		session.Append(Event{Type: EventToolCallFailed, ToolCallID: call.ID, Content: err.Error()})
		return err
	}

	session.Append(Event{Type: EventToolCallFinished, ToolCallID: call.ID, Content: result})
	return nil
}
```

### Graph Agent Shape

复杂 agent 不应只靠 if/else，应该显式表达节点和路由。

```go
type Node interface {
	Run(ctx context.Context, state *AgentState) (Next, error)
}

type Graph struct {
	nodes map[string]Node
}

func (g *Graph) Execute(ctx context.Context, start string, state *AgentState) error {
	current := start
	for current != "" {
		next, err := g.nodes[current].Run(ctx, state)
		if err != nil {
			return err
		}
		current = next.NodeID
	}
	return nil
}
```

### Tyk-Style Gateway Middleware

API gateway 的 auth、policy、quota、analytics 应在 pipeline 中组合。

```go
type Middleware func(http.Handler) http.Handler

func RateLimit(limit Limiter) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("Authorization")
			if !limit.Allow(key) {
				http.Error(w, "rate limited", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```

### Hertz-Style Request Context Boundary

高性能 HTTP 框架常有自己的 request context；业务层仍应接收标准 `context.Context`。

```go
type HandlerFunc func(ctx context.Context, req Request) (Response, error)

func AdaptHTTP(fn HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := DecodeRequest(r)
		resp, err := fn(r.Context(), req)
		EncodeResponse(w, resp, err)
	}
}
```

### OpenTelemetry Collector Pipeline

可观测数据也应该像业务请求一样走 pipeline。

```go
type Receiver interface {
	Start(ctx context.Context, out Consumer) error
}

type Processor interface {
	Process(ctx context.Context, batch TelemetryBatch) (TelemetryBatch, error)
}

type Exporter interface {
	Export(ctx context.Context, batch TelemetryBatch) error
}

type Pipeline struct {
	processors []Processor
	exporter   Exporter
}
```

### Export Queue With Retry Budget

观测数据不能拖慢主请求路径。

```go
type AsyncExporter struct {
	queue chan TelemetryBatch
}

func (e *AsyncExporter) Export(ctx context.Context, batch TelemetryBatch) error {
	select {
	case e.queue <- batch:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return ErrTelemetryQueueFull
	}
}
```

### Temporal-Style Durable Event History

长流程靠事件历史恢复，而不是只保存最终状态。

```go
type HistoryStore interface {
	Append(ctx context.Context, workflowID string, event WorkflowEvent) error
	List(ctx context.Context, workflowID string) ([]WorkflowEvent, error)
}

func Replay(events []WorkflowEvent) WorkflowState {
	var state WorkflowState
	for _, event := range events {
		state.Apply(event)
	}
	return state
}
```

### NATS-Style Pub/Sub

消息系统的核心形状是 subject、subscriber、fan-out、慢消费者策略。

```go
type Bus struct {
	subs map[string][]chan Message
}

func (b *Bus) Publish(subject string, msg Message) {
	for _, sub := range b.subs[subject] {
		select {
		case sub <- msg:
		default:
			// Slow consumer policy: drop, disconnect, or move to retry queue.
		}
	}
}
```

### Config Hot Swap Guard

动态配置的第一原则：先验证整份 next config，再替换运行态。这个模式来自 Caddy/Tyk 这类网关控制面，也适合 AI gateway 的 provider/model/tenant policy。

```go
func (c GatewayConfig) Validate() error {
	providers := make(map[core.ProviderName]ProviderConfig, len(c.Providers))
	models := map[core.ModelName]bool{}
	for _, provider := range c.Providers {
		if provider.Name == "" {
			return fmt.Errorf("provider name is required")
		}
		if _, exists := providers[provider.Name]; exists {
			return fmt.Errorf("provider %s is duplicated", provider.Name)
		}
		providers[provider.Name] = provider
		for model, enabled := range provider.Models {
			if enabled {
				models[model] = true
			}
		}
	}

	for _, tenant := range c.Tenants {
		for providerName, allowed := range tenant.AllowedProviders {
			if !allowed {
				continue
			}
			if _, ok := providers[providerName]; !ok {
				return fmt.Errorf("tenant %s allows unknown provider %s", tenant.TenantID, providerName)
			}
		}
		for modelName, allowed := range tenant.AllowedModels {
			if allowed && len(models) > 0 && !models[modelName] {
				return fmt.Errorf("tenant %s allows unknown model %s", tenant.TenantID, modelName)
			}
		}
	}
	return nil
}
```

```go
func (s *ConfigStore) Swap(next GatewayConfig) error {
	if err := next.Validate(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.current = cloneGatewayConfig(next)
	return nil
}
```

本地 proof：`capstone_ai_gateway_agent_runtime/internal/app/config_test.go` 的 `TestConfigSwapRejectsUnknownProviderInTenantPolicy`。

### Graceful Drain Order

大流量服务关闭时，入口要先停止接新请求，后台 worker 再 drain 队列。

```go
app := App{
	Components: []Component{
		recordingComponent{name: "worker", recorder: recorder, started: started},
		recordingComponent{name: "ingress", recorder: recorder, started: started},
	},
	ShutdownTimeout: time.Second,
}
```

```go
events := recorder.snapshot()
ingressShutdown := indexOf(events, "shutdown:ingress")
workerShutdown := indexOf(events, "shutdown:worker")
if ingressShutdown == -1 || workerShutdown == -1 {
	t.Fatalf("missing shutdown events: %v", events)
}
if ingressShutdown > workerShutdown {
	t.Fatalf("ingress must stop before workers drain: %v", events)
}
```

本地 proof：`capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go` 的 `TestGracefulDrainStopsIngressBeforeWorkers`。

### Awesome Architecture To Go Packages

架构模板最终要落成 package，而不是只停留在图上。

```text
AI Gateway:
  internal/gateway/router
  internal/gateway/provider
  internal/gateway/ratelimit
  internal/gateway/telemetry

Agent Platform:
  internal/agent/session
  internal/agent/event
  internal/agent/runner
  internal/agent/tool
  internal/agent/graph
```

## maximhq/bifrost

**它解决什么问题**：Bifrost 是 AI gateway 直接参考。README 明确强调 automatic fallbacks、load balancing、observability；`core/bifrost.go` 里能看到 provider queue、concurrency 更新、fallback 决策和请求处理主链路。

**关键段落/代码剖析**：

- `README.md` 的 feature map 把 fallback、load balancing、observability 放在核心能力里，这正是 AI gateway 区别于普通反向代理的部分。
- `core/bifrost.go` 中 `ProviderQueue` 表示 provider 侧并发和队列是网关核心状态。
- `shouldTryFallbacks`、`prepareFallbackRequest`、`shouldContinueWithFallbacks` 说明 fallback 不是简单重试：要判断错误是否允许 fallback、是否有配置、如何构造下一次 provider/model 请求。
- 代码注释显示 plugin 的 PreRequestHook 可以改变 provider/model/fallbacks，说明路由策略应留扩展点。

**迁移到本地系统**：

```text
request -> pre-route hooks -> provider/model route -> provider queue -> fallback loop -> telemetry
```

**本地练习**：扩展 `architecture_labs/gateway`，把 `Provider` 增加 `Model`、`MaxConcurrency` 和 `Fallbacks`，先只做测试。

Backlinks: [AI Gateway](../docs/knowledge-handbook/concepts/ai-gateway.md), [Observability](../docs/knowledge-handbook/concepts/observability.md)

## trpc-group/trpc-agent-go

**它解决什么问题**：Go agent runtime 参考。README 强调 GraphAgent、tool integration、runner；源码中有 `agent`, `event`, `graph`, `tool` 等明确边界。

**关键段落/代码剖析**：

- `README.md` 把 GraphAgent、Rich Tool Integration、Runner/Event 放在核心展示里，说明 agent 平台不是一次 chat completion。
- `agent/agent.go` 是 agent 抽象入口，适合看 Agent 应该暴露哪些能力。
- `event/event.go` 是事件模型入口。agent UI、trace、恢复和审计都依赖稳定 event。
- `agent/graphagent/*` 展示图式 workflow：节点、条件路由、多步执行。
- `agent/a2aagent/a2a_converter.go` 中 tool call/tool response/event 转换说明：外部协议和内部事件需要 adapter。

**迁移到本地系统**：

```text
Agent config -> Runner -> Event stream -> Tool executor -> Graph decision -> Session store
```

**本地练习**：扩展 `architecture_labs/agent`，增加 `RunStarted`、`RunCompleted`、`ToolCallFailed` 事件，并要求测试按顺序断言。

Backlinks: [Agent Runtime](../docs/knowledge-handbook/concepts/agent-runtime.md), [Durable Workflow](../docs/knowledge-handbook/concepts/durable-workflow.md)

## TykTechnologies/tyk

**它解决什么问题**：传统 API gateway 参考。它补足 AI gateway 往往忽略的基本功：auth、policy、rate limit、proxy pipeline、analytics。

**关键段落/代码剖析**：

- `gateway/mw_rate_limiting.go` 是限流 middleware 的直接入口，说明限流应在 pipeline 中统一处理。
- `gateway/analytics.go` 表示网关需要独立的分析/日志链路，不应只靠 handler 打日志。
- `apidef/*` 表示 API 定义和运行配置是网关控制面的核心资产。
- `gateway/*` 整体展示 middleware pipeline：请求进入后经过认证、策略、限流、转发和分析。

**迁移到本地系统**：

```text
HTTP -> auth -> tenant policy -> token/request quota -> model route -> provider -> analytics
```

**本地练习**：为未来 `gateway_lab` 设计 `TenantPolicy`：允许模型、RPM、TPD、是否允许 fallback。

Backlinks: [AI Gateway](../docs/knowledge-handbook/concepts/ai-gateway.md), [Concurrency And Backpressure](../docs/knowledge-handbook/concepts/concurrency-backpressure.md)

## cloudwego/hertz

**它解决什么问题**：高性能 Go HTTP 框架参考。重点不是马上使用框架，而是理解高并发入口的 router、middleware、request context、client timeout、协议对象。

**关键段落/代码剖析**：

- `pkg/route/engine.go` 是 server/router engine 入口。
- `pkg/app/*` 定义 server handler 使用的 request context 形态。
- `pkg/app/client/middleware.go` 把 client call 包成 endpoint/middleware，这和 gateway provider client 非常相似。
- `pkg/protocol/*` 展示 request/response 对象如何被高性能框架管理，提醒你不要随意跨 goroutine 保存生命周期受控对象。

**迁移到本地系统**：

- `net/http` 起步足够，但要保留 middleware 思维。
- 流式/SSE/provider 并发调用时，明确 request context 和 response writer 生命周期。
- 未来追求吞吐时再替换 HTTP 层，不要让业务逻辑绑定框架。

**本地练习**：把 `api_service` 的 handler 包一层 middleware，记录 request method/path/status/duration。

Backlinks: [Concurrency And Backpressure](../docs/knowledge-handbook/concepts/concurrency-backpressure.md), [Observability](../docs/knowledge-handbook/concepts/observability.md)

## open-telemetry/opentelemetry-collector

**它解决什么问题**：可观测 pipeline 的标杆。它把 telemetry 数据拆成 receiver、processor、exporter，并由 component/service 统一管理生命周期。

**关键段落/代码剖析**：

- `component/*`：所有组件都有身份、配置、host、telemetry 和生命周期边界。
- `receiver/*`、`processor/*`、`exporter/*`：输入、处理、输出三段式是可观测系统最重要的结构。
- `exporter/exporterhelper/internal/queue/*`：导出端需要 queue、retry、batch、持久化等可靠性机制。
- `exporter/debugexporter/*`：debug exporter 是学习和测试 telemetry pipeline 的好入口。

**迁移到本地系统**：

```text
gateway event receiver -> redact/enrich/sample processor -> metrics/log/trace exporter
```

**本地练习**：为 `gateway_lab` 设计 `TelemetrySink` 接口，并写一个内存 exporter 统计 provider latency。

Backlinks: [Observability](../docs/knowledge-handbook/concepts/observability.md), [Architecture Boundaries](../docs/knowledge-handbook/concepts/architecture-boundaries.md)

## temporalio/temporal

**它解决什么问题**：durable execution。Temporal server 让 workflow 在失败、重试、worker 崩溃时仍可恢复。

**关键段落/代码剖析**：

- `README.md` 明确 Temporal 执行 workflow，并自动处理间歇性失败和失败操作重试。
- `service/history/*` 是 workflow history 和状态演进的核心服务。
- `service/matching/*` 负责 task queue 和 worker 匹配。
- `service/worker/*` 体现后台系统任务和 worker 模型。

**迁移到 agent runtime**：

```text
event history -> replay state -> schedule tool/activity -> worker executes -> append result event
```

**本地练习**：把 `architecture_labs/agent` 的 session event 写成可重放模型：从 events 重建 session 状态。

Backlinks: [Durable Workflow](../docs/knowledge-handbook/concepts/durable-workflow.md), [Agent Runtime](../docs/knowledge-handbook/concepts/agent-runtime.md)

## nats-io/nats-server

**它解决什么问题**：高吞吐消息系统，适合学习连接、订阅、路由、fan-out、慢消费者和持久流。

**关键段落/代码剖析**：

- `main.go` 的 flags 显示 JetStream、routes、cluster 等是 server 级核心能力。
- `server/client.go` 是连接和消息处理核心，包含 subscription、route、gateway、JetStream 相关逻辑。
- `server/sublist.go` 管理 subject subscription 匹配，是 fan-out 的关键。
- `server/route.go` 处理集群路由。
- `server/jetstream.go` 把消息从瞬时投递扩展到持久化流。

**迁移到本地系统**：

- Agent event stream 和 notification pipeline 都需要 subject/topic、subscriber、slow consumer policy。
- gateway 多实例时，provider health、quota 或 session event 可能需要跨实例传播。
- JetStream 思想适合 event store、audit log、retry queue。

**本地练习**：为 `architecture_labs/notification` 增加一个 `Topic` 字段，并按 topic + user 做去重。

Backlinks: [Concurrency And Backpressure](../docs/knowledge-handbook/concepts/concurrency-backpressure.md), [Durable Workflow](../docs/knowledge-handbook/concepts/durable-workflow.md)

## study8677/awesome-architecture

**它解决什么问题**：提供系统架构模板，不提供 Go 实现。本工作区要做的是把架构模板转成 package、interface、test 和 lab。

**关键段落/代码剖析**：

- `templates/ai-gateway`：统一模型入口、路由、fallback、限流、观测。
- `templates/ai-agent-platform`：session、event、tool、workflow、human-in-the-loop。
- `templates/rag-knowledge-base`：ingest、chunk、retrieve、rerank、citation、eval。
- `templates/inference-serving`：queue、batch、调度、容量、尾延迟。
- `templates/realtime-chat`：长连接、顺序、ack、重试、去重。
- `templates/notification-system`：事件转通知、去重、限频、优先级、投递状态。

**迁移到本地系统**：

这些模板已经落到 [`../docs/architecture-to-go`](../docs/architecture-to-go/README.md) 和 [`../architecture_labs`](../architecture_labs/README.md)。下一步不是继续画图，而是把每个 lab 扩展一层生产能力。

Backlinks: [AI Gateway](../docs/knowledge-handbook/concepts/ai-gateway.md), [Agent Runtime](../docs/knowledge-handbook/concepts/agent-runtime.md), [Observability](../docs/knowledge-handbook/concepts/observability.md)

## 本阶段知识网

```text
Bifrost -> AI gateway routing/fallback/provider queue
trpc-agent-go -> agent/event/tool/graph runtime
Tyk -> API gateway policy/rate limit/analytics
Hertz -> high-performance HTTP entry and middleware
OpenTelemetry Collector -> receiver/processor/exporter pipeline
Temporal -> durable workflow history and worker matching
NATS -> pub/sub, routing, JetStream, backpressure
awesome-architecture -> architecture template -> Go labs
```
