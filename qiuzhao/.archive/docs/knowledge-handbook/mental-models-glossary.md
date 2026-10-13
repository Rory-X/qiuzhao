# Mental Models And Glossary

这份手册用于反查概念：读 GitHub 源码时遇到一个词，先在这里定位它属于哪条大系统链路，再跳到代码模板和本地 lab。

Related:

- [`reference-implementations.md`](reference-implementations.md)
- [`system-blueprints.md`](system-blueprints.md)
- [`backlink-index.md`](backlink-index.md)
- [`source-map.md`](source-map.md)
- [`concepts/README.md`](concepts/README.md)

## 1. Provider

定义：模型供应方或模型后端，例如 OpenAI-compatible endpoint、内部推理服务、embedding 服务。

不要把 provider 当成普通 HTTP client。Provider 在 AI gateway 里带有健康状态、成本、模型能力、并发限制、错误分类和观测字段。

来源反链：

```text
Bifrost -> provider abstraction
Tyk -> upstream target
Caddy -> module lifecycle
```

Go 形状：

```go
type ProviderClient interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type ProviderMetadata struct {
	Name        ProviderName
	Models      map[ModelName]bool
	MaxInFlight int
	Timeout     time.Duration
	CostWeight  int
}
```

检查问题：

```text
这个 provider 支持哪些模型？
它的 rate limit 是 provider 级、tenant 级还是 key 级？
它的失败能不能 fallback？
它的流式输出如何 normalize？
```

## 2. Route Plan

定义：一次请求的 provider 执行计划，至少包含 primary 和 fallbacks。

来源反链：

```text
Bifrost -> routing/fallback
go-kit -> endpoint chain
Tyk -> policy-driven routing
```

Go 形状：

```go
type RoutePlan struct {
	Primary   Route
	Fallbacks []Route
}

type Route struct {
	Provider ProviderName
	Model    ModelName
	Reason   string
}
```

不要这样写：

```go
func Chat(req ChatRequest) {
	if req.Model == "gpt-4" {
		callOpenAI()
	} else {
		callOther()
	}
}
```

应该让路由决策变成可测试对象：

```go
func TestPlanPrefersHealthyProvider(t *testing.T) {
	plan, err := router.Plan(req, policy)
	if err != nil {
		t.Fatal(err)
	}
	if plan.Primary.Provider != "openai" {
		t.Fatalf("want openai got %s", plan.Primary.Provider)
	}
}
```

## 3. Fallback

定义：primary provider 失败后，按错误分类、预算和策略尝试备用 provider。

来源反链：

```text
Bifrost -> fallback loop
Temporal -> retry budget
Tyk -> gateway upstream failure handling
```

核心判断：

```go
func CanFallback(err error) bool {
	switch Classify(err) {
	case ErrorTimeout, ErrorRateLimited, ErrorProviderError, ErrorOverloaded:
		return true
	default:
		return false
	}
}
```

不能 fallback 的典型错误：

```text
invalid input: 换 provider 也不会成功
unauthorized: 是权限/配置问题
tenant quota exceeded: 重试会放大成本
context canceled: 用户或上游已经放弃
```

## 4. Retry Budget

定义：重试或 fallback 的上限，防止故障时把系统打得更坏。

来源反链：

```text
Temporal -> retry policies
NATS -> avoid slow consumer amplification
Bifrost/Tyk -> provider/upstream failure paths
```

Go 形状：

```go
type RetryBudget struct {
	MaxAttempts int
	Deadline    time.Time
}

func (b RetryBudget) Allow(ctx context.Context, attempt int) bool {
	if ctx.Err() != nil {
		return false
	}
	if b.MaxAttempts > 0 && attempt >= b.MaxAttempts {
		return false
	}
	if !b.Deadline.IsZero() && time.Now().After(b.Deadline) {
		return false
	}
	return true
}
```

心智模型：

```text
Retry solves transient errors.
Retry worsens overload errors unless there is backoff, budget and admission.
```

## 5. Backpressure

定义：当下游处理不过来时，上游必须减速、排队、拒绝或降级。

来源反链：

```text
Go by Example -> channels/worker pools
NATS -> slow consumer
OpenTelemetry Collector -> bounded queues
Bifrost -> provider queue
```

Go 形状：

```go
func TryEnqueue[T any](q chan<- T, item T) error {
	select {
	case q <- item:
		return nil
	default:
		return ErrQueueFull
	}
}
```

四种策略：

```text
Reject: 返回 503/429，保护系统。
Queue: 有容量上限，适合短峰值。
Drop: 适合 telemetry 或可丢事件。
Degrade: 降级到更便宜模型、更短上下文或非流式。
```

## 6. Admission Control

定义：在进入昂贵路径前决定是否接受请求。

来源反链：

```text
Tyk -> rate limit middleware
Hertz -> request boundary
Bifrost -> provider queue
```

Go 形状：

```go
type Admission interface {
	Admit(ctx context.Context, req ChatRequest) error
}

type AdmissionChain []Admission

func (c AdmissionChain) Admit(ctx context.Context, req ChatRequest) error {
	for _, admission := range c {
		if err := admission.Admit(ctx, req); err != nil {
			return err
		}
	}
	return nil
}
```

典型 admission 顺序：

```text
auth -> tenant policy -> request size -> token budget -> provider queue
```

## 7. Endpoint

定义：业务能力的函数边界，不关心 HTTP/gRPC/SSE 这些 transport。

来源反链：

```text
go-kit -> endpoint
Hertz -> transport adapter
OpenTelemetry -> endpoint middleware
```

Go 形状：

```go
type Endpoint[Req any, Resp any] func(context.Context, Req) (Resp, error)

func WithTimeout[Req any, Resp any](timeout time.Duration, next Endpoint[Req, Resp]) Endpoint[Req, Resp] {
	return func(ctx context.Context, req Req) (Resp, error) {
		ctx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()
		return next(ctx, req)
	}
}
```

心智模型：

```text
transport adapts bytes to request structs.
endpoint owns a usecase call.
middleware wraps endpoint behavior.
```

## 8. Event Store

定义：append-only 的事实记录，用于 replay、审计、UI stream 和恢复。

来源反链：

```text
Temporal -> workflow history
trpc-agent-go -> agent events
Syncthing -> long-running protocol state
```

Go 形状：

```go
type EventStore interface {
	Append(ctx context.Context, streamID string, event Event) error
	List(ctx context.Context, streamID string) ([]Event, error)
}
```

不要把 event store 当成普通日志：

```text
log: 描述发生了什么，主要给人看。
event: 系统事实，未来代码要靠它恢复状态。
```

## 9. Replay

定义：从事件历史推导当前状态。

来源反链：

```text
Temporal -> deterministic replay
trpc-agent-go -> event stream to state
Wild Workouts -> state transition rules
```

Go 形状：

```go
func Replay(events []Event) State {
	var state State
	for _, event := range events {
		state.Apply(event)
	}
	return state
}

func (s *State) Apply(event Event) {
	switch event.Type {
	case EventUserMessage:
		s.Messages = append(s.Messages, event.Content)
	case EventRunCompleted:
		s.Done = true
	}
}
```

检查问题：

```text
事件是否有稳定 ID？
是否能按 session/run 排序？
重复 append 会不会破坏状态？
失败事件是否也是事实？
```

## 10. Idempotency Key

定义：识别一次业务意图，避免重试导致重复副作用。

来源反链：

```text
Temporal -> activity retry safety
Notification System template -> dedupe
Tyk/API Gateway -> client request identity
```

Go 形状：

```go
type IdempotencyStore interface {
	Seen(ctx context.Context, key string) (bool, error)
	Mark(ctx context.Context, key string, ttl time.Duration) error
}

func IdempotencyKey(tenant TenantID, requestID RequestID, operation string) string {
	return string(tenant) + ":" + string(requestID) + ":" + operation
}
```

使用位置：

```text
tool call side effect
notification send
payment/cost accounting
workflow command
```

## 11. Tool Call

定义：Agent 请求外部能力的一次结构化调用。

来源反链：

```text
trpc-agent-go -> tool abstraction
Temporal -> activity boundary
OpenTelemetry -> tool span
```

Go 形状：

```go
type ToolCall struct {
	ID    string
	Name  string
	Input json.RawMessage
}

type ToolResult struct {
	CallID string
	Output json.RawMessage
	Error  string
}
```

检查问题：

```text
tool 是否有 schema？
tool 是否有 timeout？
tool 是否写 event？
tool 是否记录权限和审计？
tool 是否幂等？
```

## 12. Graph Node

定义：复杂 agent 流程中的显式步骤。

来源反链：

```text
trpc-agent-go -> graph agent
Temporal -> workflow steps
awesome-architecture Agent Platform -> planner/executor/reviewer
```

Go 形状：

```go
type Node[S any] interface {
	Run(ctx context.Context, state *S) (Next, error)
}

type Next struct {
	NodeID string
	Reason string
}
```

典型节点：

```text
plan -> retrieve -> tool_execute -> critique -> answer
```

## 13. Transport

定义：系统边界协议，例如 HTTP、gRPC、SSE、WebSocket、NATS subject。

来源反链：

```text
Hertz -> HTTP transport
go-kit -> transport/endpoint/service
NATS -> pub/sub transport
Memos -> SSE transport
```

Go 形状：

```go
type TransportDecoder[Req any] func(*http.Request) (Req, error)
type TransportEncoder[Resp any] func(http.ResponseWriter, Resp, error)

func Adapt[Req any, Resp any](decode TransportDecoder[Req], encode TransportEncoder[Resp], endpoint Endpoint[Req, Resp]) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req, err := decode(r)
		if err != nil {
			WriteError(w, err)
			return
		}
		resp, err := endpoint(r.Context(), req)
		if err != nil {
			WriteError(w, err)
			return
		}
		_ = encode(w, resp)
	}
}
```

## 14. Module Lifecycle

定义：组件如何配置、校验、启动、关闭。

来源反链：

```text
Caddy -> modules/apps
PocketBase -> hooks/extensions
modern-go-application -> app composition
NATS -> server lifecycle
```

Go 形状：

```go
type Module interface {
	ID() string
	Validate() error
	Provision(ctx context.Context, cfg any) error
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
}
```

使用位置：

```text
provider module
telemetry exporter module
tool module
policy store module
```

## 15. Side Effect

定义：改变外部世界的操作，例如发通知、写数据库、调用 provider、执行 tool。

来源反链：

```text
Memos -> best-effort side effects
Temporal -> activity retry/compensation
Notification template -> queue/dedupe
```

Go 形状：

```go
func (s Service) Create(ctx context.Context, input Input) (Entity, error) {
	entity, err := s.store.Create(ctx, input)
	if err != nil {
		return Entity{}, err
	}

	if err := s.events.Publish(ctx, EntityCreated{ID: entity.ID}); err != nil {
		s.log.Warn("publish entity created", "err", err)
	}

	return entity, nil
}
```

心智模型：

```text
main-path side effect: 失败则请求失败。
best-effort side effect: 失败只记录，不影响主路径。
durable side effect: 进入队列/事件表，稍后保证执行。
```

## 16. DLQ

定义：Dead Letter Queue，处理失败多次后进入人工或补偿路径。

来源反链：

```text
NATS/JetStream -> durable stream and redelivery thinking
Notification System template -> failed notification
Temporal -> failed activity visibility
```

Go 形状：

```go
type DeadLetter struct {
	ID        string
	Subject   string
	Payload   []byte
	Err       string
	Attempts  int
	CreatedAt time.Time
}

type DLQ interface {
	Publish(ctx context.Context, item DeadLetter) error
}
```

使用位置：

```text
notification send failed
tool side effect failed after retries
telemetry export failed and cannot drop
webhook delivery failed
```

## 17. Slow Consumer

定义：订阅者消费速度低于生产速度，导致 buffer 堆积。

来源反链：

```text
NATS -> slow consumer
Memos -> SSE stream
Realtime Chat template -> ack/replay
```

Go 形状：

```go
func SendOrDisconnect[T any](ctx context.Context, ch chan<- T, item T) error {
	select {
	case ch <- item:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return ErrSlowConsumer
	}
}
```

策略：

```text
disconnect: 对实时 UI 简单可靠。
drop newest: 对 telemetry 可接受。
drop oldest: 对状态快照可接受。
persist and replay: 对业务事件最可靠。
```

## 18. Span, Metric, Log

定义：

```text
span: 一段调用链的时间范围，回答“这次请求经过了哪里”。
metric: 可聚合数字，回答“系统总体表现如何”。
log: 离散事件描述，回答“某一刻发生了什么”。
```

来源反链：

```text
OpenTelemetry Collector -> telemetry signal pipeline
Bifrost -> provider/model/token dimensions
Tyk -> analytics
```

AI gateway 观测字段：

```go
type GatewayObservation struct {
	TraceID       string
	RequestID     string
	TenantID      string
	Model         string
	Provider      string
	FallbackIndex int
	LatencyMS     int64
	InputTokens   int
	OutputTokens  int
	ErrorClass    string
}
```

Agent runtime 观测字段：

```go
type AgentObservation struct {
	TraceID    string
	SessionID  string
	RunID      string
	EventID    string
	NodeID     string
	ToolName   string
	ToolCallID string
	LatencyMS  int64
	ErrorClass string
}
```

## 19. Health, Liveness, Readiness

定义：

```text
liveness: 进程是否还活着。
readiness: 是否可以接新流量。
health: 依赖是否处于可用状态。
```

来源反链：

```text
modern-go-application -> production readiness
Caddy/NATS -> long-running service lifecycle
Tyk -> gateway health and upstream readiness
```

Go 形状：

```go
type HealthChecker interface {
	Name() string
	Check(ctx context.Context) error
}

type HealthReport struct {
	Name string
	OK   bool
	Err  string
}

func CheckAll(ctx context.Context, checks []HealthChecker) []HealthReport {
	var reports []HealthReport
	for _, check := range checks {
		err := check.Check(ctx)
		report := HealthReport{Name: check.Name(), OK: err == nil}
		if err != nil {
			report.Err = err.Error()
		}
		reports = append(reports, report)
	}
	return reports
}
```

## 20. Cost Budget

定义：AI gateway 特有的业务限额，通常按 tenant/model/provider/token 维度计算。

来源反链：

```text
Bifrost -> model/provider gateway
Tyk -> quota/rate limit policy
OpenTelemetry -> usage metrics
```

Go 形状：

```go
type CostEvent struct {
	TenantID     TenantID
	Provider     ProviderName
	Model        ModelName
	InputTokens  int
	OutputTokens int
	UnitPrice    float64
}

func (e CostEvent) EstimatedCost() float64 {
	totalTokens := e.InputTokens + e.OutputTokens
	return float64(totalTokens) / 1000 * e.UnitPrice
}
```

检查问题：

```text
成本按请求前估算还是响应后结算？
streaming 中途断开如何结算？
fallback 多 provider 尝试如何记录成本？
tool/RAG 成本是否单独记账？
```

## 21. Concept To Code Index

| Concept | Code handbook | Blueprint | Local proof |
|---|---|---|---|
| Provider | [`reference-implementations.md#1-shared-domain-types`](reference-implementations.md#1-shared-domain-types) | [`system-blueprints.md#2-chat-completion-flow`](system-blueprints.md#2-chat-completion-flow) | `capstone_ai_gateway_agent_runtime/internal/gateway/provider` |
| Route Plan | [`reference-implementations.md#6-router-and-route-plan`](reference-implementations.md#6-router-and-route-plan) | [`system-blueprints.md#3-provider-fallback-flow`](system-blueprints.md#3-provider-fallback-flow) | `capstone_ai_gateway_agent_runtime/internal/gateway/router` |
| Fallback | [`reference-implementations.md#7-fallback-executor`](reference-implementations.md#7-fallback-executor) | [`system-blueprints.md#3-provider-fallback-flow`](system-blueprints.md#3-provider-fallback-flow) | `capstone_ai_gateway_agent_runtime/internal/gateway/fallback` |
| Backpressure | [`reference-implementations.md#8-provider-queue-and-admission-control`](reference-implementations.md#8-provider-queue-and-admission-control) | [`system-blueprints.md#10-deployment-and-capacity-blueprint`](system-blueprints.md#10-deployment-and-capacity-blueprint) | `capstone_ai_gateway_agent_runtime/internal/gateway/provider` |
| Event Store | [`reference-implementations.md#10-agent-event-store`](reference-implementations.md#10-agent-event-store) | [`system-blueprints.md#5-agent-run-flow`](system-blueprints.md#5-agent-run-flow) | `capstone_ai_gateway_agent_runtime/internal/agent/event` |
| Replay | [`reference-implementations.md#11-agent-replay`](reference-implementations.md#11-agent-replay) | [`system-blueprints.md#5-agent-run-flow`](system-blueprints.md#5-agent-run-flow) | `capstone_ai_gateway_agent_runtime/internal/agent/event` |
| Graph Node | [`reference-implementations.md#14-graph-runtime`](reference-implementations.md#14-graph-runtime) | [`system-blueprints.md#5-agent-run-flow`](system-blueprints.md#5-agent-run-flow) | `capstone_ai_gateway_agent_runtime/internal/agent/graph` |
| Tool Call | [`reference-implementations.md#12-tool-executor`](reference-implementations.md#12-tool-executor) | [`system-blueprints.md#6-tool-call-flow`](system-blueprints.md#6-tool-call-flow) | `capstone_ai_gateway_agent_runtime/internal/agent/tool` |
| Telemetry | [`reference-implementations.md#16-telemetry-pipeline`](reference-implementations.md#16-telemetry-pipeline) | [`system-blueprints.md#8-telemetry-flow`](system-blueprints.md#8-telemetry-flow) | `capstone_ai_gateway_agent_runtime/internal/platform/telemetry` |
| Lifecycle | [`reference-implementations.md#18-app-lifecycle`](reference-implementations.md#18-app-lifecycle) | [`system-blueprints.md#9-high-availability-flow`](system-blueprints.md#9-high-availability-flow) | `capstone_ai_gateway_agent_runtime/internal/platform/lifecycle` |
| Event Stream | [`source-to-capstone-crosswalk.md#pattern-2-agent-event-path`](source-to-capstone-crosswalk.md#pattern-2-agent-event-path) | [`system-blueprints.md#4-streaming-chat-flow`](system-blueprints.md#4-streaming-chat-flow) | `capstone_ai_gateway_agent_runtime/internal/agent/stream` |
| RAG Tool | [`source-to-capstone-crosswalk.md#study8677awesome-architecture---system-templates-to-go-packages`](source-to-capstone-crosswalk.md#study8677awesome-architecture---system-templates-to-go-packages) | [`system-blueprints.md#7-rag-subflow-for-agent`](system-blueprints.md#7-rag-subflow-for-agent) | `capstone_ai_gateway_agent_runtime/internal/agent/tool` |
| Request Audit | [`production-readiness-checklist.md#request-log`](production-readiness-checklist.md#request-log) | [`system-blueprints.md#8-telemetry-flow`](system-blueprints.md#8-telemetry-flow) | `capstone_ai_gateway_agent_runtime/internal/gateway/audit` |
| Idempotency | [`concepts/durable-workflow.md`](concepts/durable-workflow.md) | [`system-blueprints.md#6-tool-call-flow`](system-blueprints.md#6-tool-call-flow) | `capstone_ai_gateway_agent_runtime/internal/platform/idempotency` |
