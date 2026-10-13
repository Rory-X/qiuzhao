# Advanced Source Code Anchors

这份手册补上“真实源码锚点”这一层：不是只说某个仓库值得读，而是把已经核验过的 GitHub 文件、符号、行号和本地学习版 Go 代码放在一起。

读法：

```text
Repository commit
  -> concrete file/symbol/line anchor
  -> design extraction
  -> learning Go translation
  -> local concept/lab backlink
```

注意：这里不大段复制上游源码，只记录短符号、路径、行号和设计含义；代码块是本工作区的学习版翻译，方便后续落到 `gateway_lab`、`agent_runtime_lab` 和 `observability_lab`。

Related:

- [`source-segments/large-system-segments.md`](source-segments/large-system-segments.md)
- [`reference-implementations.md`](reference-implementations.md)
- [`system-blueprints.md`](system-blueprints.md)
- [`mental-models-glossary.md`](mental-models-glossary.md)
- [`ai-gateway-agent-runtime-playbook.md`](ai-gateway-agent-runtime-playbook.md)

## Coverage Snapshot

| Source | Verified commit | Real code anchors used here |
|---|---:|---|
| [maximhq/bifrost](https://github.com/maximhq/bifrost/tree/4be1d6d3eafcb39f6af49d33c1a7f4dd9285535c) | `4be1d6d3eafcb39f6af49d33c1a7f4dd9285535c` | `core/bifrost.go`: `ProviderQueue`, `requestQueues`, `shouldTryFallbacks`, `prepareFallbackRequest`, `tryRequest`, `handleProviderRequest`, `PluginPipeline` |
| [trpc-group/trpc-agent-go](https://github.com/trpc-group/trpc-agent-go/tree/9a515687538be3519405d40bb7db19a27efb3800) | `9a515687538be3519405d40bb7db19a27efb3800` | `event/event.go`: `Event`, `Response`, `LongRunningToolIDs`, `Extensions`, `NewErrorEvent`, `NewResponseEvent`, event emit timeout |
| [TykTechnologies/tyk](https://github.com/TykTechnologies/tyk/tree/f20ba226415b6ffd37e1872c4e6d92bd83c002f0) | `f20ba226415b6ffd37e1872c4e6d92bd83c002f0` | `gateway/mw_rate_limiting.go`: `RateLimitAndQuotaCheck`, `EnabledForSpec`, `ProcessRequest`, error classification |
| [cloudwego/hertz](https://github.com/cloudwego/hertz/tree/8eec17d4e8b972075cdfa6d6b78822c3db086379) | `8eec17d4e8b972075cdfa6d6b78822c3db086379` | `pkg/route/engine.go`: `Engine`, `Run`, `Shutdown`, `Serve`, `ServeHTTP`, `Use` |
| [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector/tree/00f6354e6f8b7daf031908f7bb0637c6aeb1201d) | `00f6354e6f8b7daf031908f7bb0637c6aeb1201d` | `component/component.go`, `service/internal/graph/graph.go`, `exporter/exporterhelper/internal/queue/*` |
| [temporalio/temporal](https://github.com/temporalio/temporal/tree/a31f476255b2c7c00176f683cdce84710daaba44) | `a31f476255b2c7c00176f683cdce84710daaba44` | `service/history/interfaces/mutable_state.go`, `command_attr_validator.go`, `service/matching/matching_engine.go`, `physical_task_queue_manager.go` |
| [nats-io/nats-server](https://github.com/nats-io/nats-server/tree/dd0f12d479de19df97e3c6275ab087f8e3b91891) | `dd0f12d479de19df97e3c6275ab087f8e3b91891` | `server/client.go`: outbound buffer, `writeLoop`, `flushOutbound`, slow consumer flags and close reasons |
| [study8677/awesome-architecture](https://github.com/study8677/awesome-architecture/tree/609e0cd64d6af89549112379cbdd0f0e6cf63a3a) | `609e0cd64d6af89549112379cbdd0f0e6cf63a3a` | `templates/*/README.md`, `cases/*/README.md`, `tutorial/*` |

## 1. Bifrost: Provider Queue, Fallback And Plugin Pipeline

Source: [`core/bifrost.go`](https://github.com/maximhq/bifrost/blob/4be1d6d3eafcb39f6af49d33c1a7f4dd9285535c/core/bifrost.go)

### Segment A: ProviderQueue Is A Runtime Object

Real anchors:

```text
line 75: requestQueues sync.Map stores *ProviderQueue
line 98: ProviderQueue lifecycle comment
line 131: type ProviderQueue
line 156: signalClosing
line 165: isClosing
line 4303: Create ProviderQueue
line 4348: getProviderQueue
line 7926: drainQueueWithErrors
```

Design extraction:

```text
provider 并发不是隐式 goroutine，而是每个 provider 有独立队列和生命周期。
requestQueues 不是普通 map，而是并发安全 registry。
Remove/Update provider 时要避免“旧 provider 被新请求复活”。
shutdown 时要 drain queue，把等待中的请求显式失败。
```

Go learning translation:

```go
type ProviderRuntime struct {
	name    ProviderName
	queue   *ProviderQueue
	breaker *Breaker
	client  ProviderClient
	closing atomic.Bool
}

func (r *ProviderRuntime) Admit(job ProviderJob) error {
	if r.closing.Load() {
		return GatewayError{Class: ErrorOverloaded, Provider: r.name, Err: errors.New("provider closing")}
	}
	if !r.breaker.Allow() {
		return GatewayError{Class: ErrorOverloaded, Provider: r.name, Err: errors.New("provider circuit open")}
	}
	return r.queue.TrySubmit(job)
}
```

Provider registry:

```go
type ProviderRegistry struct {
	items sync.Map // ProviderName -> *ProviderRuntime
}

func (r *ProviderRegistry) Get(name ProviderName) (*ProviderRuntime, bool) {
	item, ok := r.items.Load(name)
	if !ok {
		return nil, false
	}
	runtime, ok := item.(*ProviderRuntime)
	return runtime, ok && !runtime.closing.Load()
}

func (r *ProviderRegistry) Replace(name ProviderName, next *ProviderRuntime) {
	if old, ok := r.items.Load(name); ok {
		old.(*ProviderRuntime).closing.Store(true)
	}
	r.items.Store(name, next)
}
```

Backlinks:

- [`concepts/ai-gateway.md`](concepts/ai-gateway.md)
- [`concepts/concurrency-backpressure.md`](concepts/concurrency-backpressure.md)
- [`reference-implementations.md#8-provider-queue-and-admission-control`](reference-implementations.md#8-provider-queue-and-admission-control)

### Segment B: Fallback Is A First-Class Flow

Real anchors:

```text
line 4784: shouldTryFallbacks
line 4816: prepareFallbackRequest
line 4911: shouldContinueWithFallbacks
line 4968: primary tryRequest
line 5014: prepare fallback request
line 5024: fallback tryRequest
line 5087: streaming fallback branch
line 6042: fallback index in trace attributes
```

Design extraction:

```text
primary request 和 fallback request 走同一 tryRequest/tryStreamRequest 入口。
fallback request 会被重新构造，而不是在原请求上随手改字段。
是否 fallback 由错误、AllowFallbacks、remaining fallbacks 和 context 共同决定。
fallback index 要进入 telemetry，不然排查问题时看不出是第几次 provider attempt。
```

Go learning translation:

```go
type FallbackPolicy struct {
	Allow       bool
	MaxAttempts int
}

func (p FallbackPolicy) ShouldTry(ctx context.Context, err error, remaining []Route, attempt int) bool {
	if !p.Allow || err == nil || ctx.Err() != nil {
		return false
	}
	if len(remaining) == 0 {
		return false
	}
	if p.MaxAttempts > 0 && attempt >= p.MaxAttempts {
		return false
	}
	return CanFallback(err)
}
```

Request cloning:

```go
func PrepareFallbackRequest(req ChatRequest, route Route, attempt int) ChatRequest {
	next := req
	next.Provider = route.Provider
	next.Model = route.Model
	if next.Metadata == nil {
		next.Metadata = map[string]string{}
	}
	next.Metadata["fallback.index"] = strconv.Itoa(attempt)
	next.Metadata["fallback.reason"] = route.Reason
	return next
}
```

Attempt telemetry:

```go
func RecordProviderAttempt(sink TelemetrySink, ctx context.Context, req ChatRequest, route Route, attempt int, start time.Time, err error) {
	sink.Record(ctx, TelemetryEvent{
		Name:       "gateway.provider_attempt",
		RequestID:  string(req.RequestID),
		TenantID:   string(req.TenantID),
		Provider:   string(route.Provider),
		Model:      string(route.Model),
		LatencyMS:  time.Since(start).Milliseconds(),
		ErrorClass: string(Classify(err)),
		Attributes: map[string]string{
			"fallback.index": strconv.Itoa(attempt),
			"route.reason":   route.Reason,
		},
	})
}
```

### Segment C: Plugin Pipeline Separates Extension From Core Flow

Real anchors:

```text
line 169: type PluginPipeline
line 4477: RunPreRequestHooks
line 7251: RunLLMPreHooks
line 7297: RunPreRequestHooks on pipeline
line 7358: RunPostLLMHooks
line 7672: resetPluginPipeline
line 7855: getPluginPipeline
line 7867: releasePluginPipeline
```

Design extraction:

```text
PreRequestHook 只跑一次，可以修改 provider/model/fallbacks。
PreLLMHook/PostLLMHook 按每次 attempt 或 streaming chunk 参与。
Pipeline 从 sync.Pool 取出，使用完 reset，避免热路径频繁分配。
PostHook 反向执行，像 middleware unwind。
```

Go learning translation:

```go
type GatewayPlugin interface {
	Name() string
	PreRoute(ctx context.Context, req *ChatRequest) error
	PreProvider(ctx context.Context, req *ChatRequest) error
	PostProvider(ctx context.Context, req ChatRequest, resp *ChatResponse, err error) error
}

type PluginPipeline struct {
	plugins []GatewayPlugin
	ran     int
}

func (p *PluginPipeline) PreProvider(ctx context.Context, req *ChatRequest) error {
	for i, plugin := range p.plugins {
		if err := plugin.PreProvider(ctx, req); err != nil {
			return fmt.Errorf("%s pre provider: %w", plugin.Name(), err)
		}
		p.ran = i + 1
	}
	return nil
}

func (p *PluginPipeline) PostProvider(ctx context.Context, req ChatRequest, resp *ChatResponse, err error) error {
	for i := p.ran - 1; i >= 0; i-- {
		if hookErr := p.plugins[i].PostProvider(ctx, req, resp, err); hookErr != nil {
			return fmt.Errorf("%s post provider: %w", p.plugins[i].Name(), hookErr)
		}
	}
	return nil
}
```

Local target:

```text
capstone_ai_gateway_agent_runtime/internal/gateway/provider plugin expansion
  -> PreRoute modifies route plan inputs
  -> PreProvider adds headers/trace
  -> PostProvider records usage/cost/error
```

## 2. trpc-agent-go: Event As Agent Runtime Fact

Source: [`event/event.go`](https://github.com/trpc-group/trpc-agent-go/blob/9a515687538be3519405d40bb7db19a27efb3800/event/event.go)

### Segment A: Event Wraps Model Response And Runtime Metadata

Real anchors:

```text
line 96: type Event
line 97: embedded model.Response
line 141: LongRunningToolIDs
line 148: Extensions
line 342: NewErrorEvent
line 356: NewResponseEvent
line 366: EmitEventTimeoutError
line 394: IsFinalResponse
line 400: IsError
line 412: IsTerminalError
```

Design extraction:

```text
Event 不是单纯 message，它把 LLM response、tool 状态、扩展字段和错误状态合在一个流对象里。
LongRunningToolIDs 暗示 agent 运行时要显式识别长期工具调用。
Extensions 是向后兼容和生态扩展点，但业务核心不能只靠 map 传含义。
IsError / IsTerminalError 区分非终止错误和终止失败。
```

Go learning translation:

```go
type AgentEvent struct {
	ID          string
	SessionID   string
	RunID       string
	Type        EventType
	Message     *Message
	ToolCallID  string
	ToolName    string
	LongRunning bool
	Error       *EventError
	Extensions  map[string]json.RawMessage
	CreatedAt   time.Time
}

func (e AgentEvent) IsTerminal() bool {
	return e.Type == EventRunCompleted || e.Type == EventRunFailed || e.Type == EventAssistantMessage
}

func (e AgentEvent) IsError() bool {
	return e.Error != nil || e.Type == EventToolCallFailed || e.Type == EventRunFailed
}
```

Event factory:

```go
func NewToolStarted(runID string, call ToolCall) AgentEvent {
	return AgentEvent{
		ID:         NewID(),
		RunID:      runID,
		Type:       EventToolCallStarted,
		ToolCallID: call.ID,
		ToolName:   call.Name,
		CreatedAt:  time.Now(),
	}
}

func NewToolFailed(runID string, call ToolCall, err error) AgentEvent {
	return AgentEvent{
		ID:         NewID(),
		RunID:      runID,
		Type:       EventToolCallFailed,
		ToolCallID: call.ID,
		ToolName:   call.Name,
		Error:      &EventError{Message: err.Error(), Class: string(Classify(err))},
		CreatedAt:  time.Now(),
	}
}
```

### Segment B: Event Emission Needs Timeout Semantics

Real anchors:

```text
line 364: DefaultEmitTimeoutErr
line 366: EmitEventTimeoutError
line 453/502/527: ctx.Done paths in event emission helpers
```

Design extraction:

```text
事件流也会阻塞。UI、SSE、WebSocket、pub/sub 都可能成为 slow consumer。
emit timeout 应是 agent runtime 的可观测错误，而不是 goroutine 卡死。
```

Go learning translation:

```go
type EventSink interface {
	Emit(ctx context.Context, event AgentEvent) error
}

type TimeoutSink struct {
	timeout time.Duration
	next    EventSink
}

func (s TimeoutSink) Emit(ctx context.Context, event AgentEvent) error {
	emitCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	if err := s.next.Emit(emitCtx, event); err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return fmt.Errorf("emit event timeout: %w", err)
		}
		return err
	}
	return nil
}
```

Backlinks:

- [`concepts/agent-runtime.md`](concepts/agent-runtime.md)
- [`concepts/durable-workflow.md`](concepts/durable-workflow.md)
- [`reference-implementations.md#10-agent-event-store`](reference-implementations.md#10-agent-event-store)

## 3. Tyk: Rate Limit And Quota Are Gateway Middleware

Source: [`gateway/mw_rate_limiting.go`](https://github.com/TykTechnologies/tyk/blob/f20ba226415b6ffd37e1872c4e6d92bd83c002f0/gateway/mw_rate_limiting.go)

### Segment A: RateLimitAndQuotaCheck Owns Admission

Real anchors:

```text
line 18: type RateLimitAndQuotaCheck
line 22: Name
line 26: EnabledForSpec
line 30: handleQuotaFailure
line 50: ProcessRequest
line 76: SessionLimiter.ForwardMessage
line 105: sessionFailRateLimit branch
line 107: SetErrorClassification
line 143: quota failure branch
```

Design extraction:

```text
限流/配额在 gateway pipeline 里很靠前，避免昂贵 upstream/provider call。
是否启用由 API spec / policy 决定，而不是硬编码。
失败不仅返回状态码，还要设置 error classification，方便 analytics 和 observability。
对 throttle retry 有显式上限，避免在网关内部无限递归/重试。
```

Go learning translation:

```go
type AdmissionMiddleware struct {
	policy  PolicyEngine
	limiter TokenLimiter
}

func (m AdmissionMiddleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		req := ChatRequestFromContext(r.Context())
		policy, err := m.policy.Allow(r.Context(), req)
		if err != nil {
			WriteError(w, err)
			return
		}
		key := string(policy.TenantID) + ":" + string(req.Model)
		if err := m.limiter.Consume(r.Context(), key, req.EstimatedTokens()); err != nil {
			WriteError(w, GatewayError{Class: ErrorRateLimited, Err: err})
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

Quota result model:

```go
type AdmissionDecision struct {
	Allowed    bool
	StatusCode int
	Class      ErrorClass
	RetryAfter time.Duration
	Reason     string
}

func RejectRateLimit(retryAfter time.Duration) AdmissionDecision {
	return AdmissionDecision{
		Allowed:    false,
		StatusCode: http.StatusTooManyRequests,
		Class:      ErrorRateLimited,
		RetryAfter: retryAfter,
		Reason:     "rate limit exceeded",
	}
}
```

Backlinks:

- [`concepts/ai-gateway.md`](concepts/ai-gateway.md)
- [`concepts/concurrency-backpressure.md`](concepts/concurrency-backpressure.md)
- [`system-blueprints.md#2-chat-completion-flow`](system-blueprints.md#2-chat-completion-flow)

## 4. Hertz: Engine Lifecycle And Transport Boundary

Source: [`pkg/route/engine.go`](https://github.com/cloudwego/hertz/blob/8eec17d4e8b972075cdfa6d6b78822c3db086379/pkg/route/engine.go)

### Segment A: Engine Owns Run, Shutdown, Serve, Middleware

Real anchors:

```text
line 119: type Engine
line 189: engine status
line 193: OnRun hooks
line 196: OnShutdown hooks
line 307: Shutdown
line 366: Run
line 506: Serve
line 638: NewEngine
line 751: ServeHTTP
line 922: Use
line 1133: MarkAsRunning
```

Design extraction:

```text
HTTP framework 要清楚区分 engine status、startup hooks、shutdown hooks、transport serve 和 route dispatch。
Shutdown 不是直接 kill goroutine，而是状态切换、hook、transport shutdown。
Use 是 transport 层 middleware，不应该把业务 usecase 写进去。
ServeHTTP 最终把 request context 交给 handler chain。
```

Go learning translation:

```go
type ServerEngine struct {
	server      *http.Server
	status      atomic.Uint32
	onRun       []func(context.Context) error
	onShutdown  []func(context.Context)
}

func (e *ServerEngine) Run(ctx context.Context) error {
	for _, hook := range e.onRun {
		if err := hook(ctx); err != nil {
			return err
		}
	}
	if !e.status.CompareAndSwap(statusInit, statusRunning) {
		return errors.New("server already running")
	}
	return e.server.ListenAndServe()
}

func (e *ServerEngine) Shutdown(ctx context.Context) error {
	if !e.status.CompareAndSwap(statusRunning, statusShutdown) {
		return nil
	}
	for _, hook := range e.onShutdown {
		hook(ctx)
	}
	return e.server.Shutdown(ctx)
}
```

Transport adapter:

```go
func Adapt[Req any, Resp any](decode func(*http.Request) (Req, error), endpoint Endpoint[Req, Resp]) http.HandlerFunc {
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
		WriteJSON(w, http.StatusOK, resp)
	}
}
```

Backlinks:

- [`concepts/architecture-boundaries.md`](concepts/architecture-boundaries.md)
- [`reference-implementations.md#18-app-lifecycle`](reference-implementations.md#18-app-lifecycle)

## 5. OpenTelemetry Collector: Graph, Component Lifecycle And Export Queue

Sources:

- [`component/component.go`](https://github.com/open-telemetry/opentelemetry-collector/blob/00f6354e6f8b7daf031908f7bb0637c6aeb1201d/component/component.go)
- [`service/internal/graph/graph.go`](https://github.com/open-telemetry/opentelemetry-collector/blob/00f6354e6f8b7daf031908f7bb0637c6aeb1201d/service/internal/graph/graph.go)
- [`exporter/exporterhelper/internal/queue/queue.go`](https://github.com/open-telemetry/opentelemetry-collector/blob/00f6354e6f8b7daf031908f7bb0637c6aeb1201d/exporter/exporterhelper/internal/queue/queue.go)
- [`exporter/exporterhelper/internal/queue/async_queue.go`](https://github.com/open-telemetry/opentelemetry-collector/blob/00f6354e6f8b7daf031908f7bb0637c6aeb1201d/exporter/exporterhelper/internal/queue/async_queue.go)

### Segment A: Component Lifecycle Is Standardized

Real anchors:

```text
component/component.go line 25: type Component
component/component.go line 43: Start(ctx, host)
component/component.go line 61: Shutdown(ctx)
component/component.go line 103: StabilityLevel
```

Design extraction:

```text
每个组件都必须 Start/Shutdown。
Start 不能长期阻塞；长任务要自己起 goroutine，并在 Shutdown 里停止。
Shutdown 需要 flush buffer。
StabilityLevel 把“能不能生产用”变成组件元数据。
```

Go learning translation:

```go
type Component interface {
	Name() string
	Start(ctx context.Context) error
	Shutdown(ctx context.Context) error
}

type StableComponent struct {
	level StabilityLevel
}

func (c StableComponent) AssertProductionReady() error {
	if c.level != StabilityStable && c.level != StabilityBeta {
		return fmt.Errorf("component is not production ready: %s", c.level)
	}
	return nil
}
```

### Segment B: Pipeline Is A DAG

Real anchors:

```text
graph.go line 61: type Graph
graph.go line 74: Build
graph.go line 109: parse pipeline config
graph.go line 214: createReceiver
graph.go line 228: createProcessor
graph.go line 237: createExporter
graph.go line 267: createEdges
graph.go line 404: StartAll
graph.go line 465: ShutdownAll
```

Design extraction:

```text
Telemetry pipeline 是 graph，不是线性数组。
receiver -> processors -> fanout -> exporters 的边必须显式构建。
StartAll 先启动下游组件，ShutdownAll 先停上游组件，这样数据有机会 drain。
```

Go learning translation:

```go
type PipelineGraph struct {
	receivers  []Receiver
	processors []Processor
	exporters  []Exporter
}

func (g PipelineGraph) Start(ctx context.Context) error {
	for _, exporter := range g.exporters {
		if err := exporter.Start(ctx); err != nil {
			return err
		}
	}
	for i := len(g.processors) - 1; i >= 0; i-- {
		if err := g.processors[i].Start(ctx); err != nil {
			return err
		}
	}
	for _, receiver := range g.receivers {
		if err := receiver.Start(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (g PipelineGraph) Shutdown(ctx context.Context) error {
	for _, receiver := range g.receivers {
		_ = receiver.Shutdown(ctx)
	}
	for _, processor := range g.processors {
		_ = processor.Shutdown(ctx)
	}
	for _, exporter := range g.exporters {
		_ = exporter.Shutdown(ctx)
	}
	return nil
}
```

### Segment C: Export Queue Has Capacity And Consumers

Real anchors:

```text
queue.go line 54: type Queue
queue.go line 59: Offer
queue.go line 61: Size
queue.go line 63: Capacity
queue.go line 68: Settings
async_queue.go line 15: type asyncQueue
async_queue.go line 32: Start
async_queue.go line 59: Offer
async_queue.go line 71: Shutdown
```

Design extraction:

```text
telemetry export 也会失败或变慢，所以要有 queue。
queue 不只要 Offer，还要暴露 Size/Capacity。
consumer 数量是配置项。
Shutdown 要停止消费者，不能遗留 goroutine。
```

Go learning translation:

```go
type ExportQueue[T any] interface {
	Offer(ctx context.Context, item T) error
	Size() int64
	Capacity() int64
	Start(ctx context.Context) error
	Shutdown(ctx context.Context) error
}

type QueueSettings struct {
	Capacity     int64
	NumConsumers int
}
```

Exporter queue:

```go
type TelemetryQueue struct {
	items     chan TelemetryEvent
	consumer  func(context.Context, TelemetryEvent) error
	consumers int
}

func (q *TelemetryQueue) Offer(ctx context.Context, event TelemetryEvent) error {
	select {
	case q.items <- event:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return ErrQueueFull
	}
}
```

Backlinks:

- [`concepts/observability.md`](concepts/observability.md)
- [`reference-implementations.md#16-telemetry-pipeline`](reference-implementations.md#16-telemetry-pipeline)
- [`system-blueprints.md#8-telemetry-flow`](system-blueprints.md#8-telemetry-flow)

## 6. Temporal: Mutable State, Command Validation And Matching

Sources:

- [`service/history/interfaces/mutable_state.go`](https://github.com/temporalio/temporal/blob/a31f476255b2c7c00176f683cdce84710daaba44/service/history/interfaces/mutable_state.go)
- [`service/history/api/command_attr_validator.go`](https://github.com/temporalio/temporal/blob/a31f476255b2c7c00176f683cdce84710daaba44/service/history/api/command_attr_validator.go)
- [`service/matching/matching_engine.go`](https://github.com/temporalio/temporal/blob/a31f476255b2c7c00176f683cdce84710daaba44/service/matching/matching_engine.go)
- [`service/matching/physical_task_queue_manager.go`](https://github.com/temporalio/temporal/blob/a31f476255b2c7c00176f683cdce84710daaba44/service/matching/physical_task_queue_manager.go)

### Segment A: MutableState Is Event History Plus Derived State

Real anchors:

```text
mutable_state.go line 45: AddHistoryEvent
lines 50-140: AddActivity/Workflow/Timer/Signal/Update events
line 187: GetNextEventID
lines 247-285: Apply*Event methods
line 341: StartTransaction
line 345: CloseTransactionAsMutation
line 348: CloseTransactionAsSnapshot
```

Design extraction:

```text
Durable workflow 的核心不是一个 status 字段，而是一组 Add*Event / Apply*Event / transaction 边界。
Add*Event 表示“我要把事实写进历史”。
Apply*Event 表示“根据历史恢复当前状态”。
CloseTransactionAsMutation/Snapshot 区分增量持久化和完整快照。
```

Agent runtime translation:

```go
type AgentMutableState struct {
	nextEventID int64
	status      RunStatus
	messages    []Message
	tools       map[string]ToolState
	pending     []AgentEvent
}

func (s *AgentMutableState) AddEvent(event AgentEvent) AgentEvent {
	s.nextEventID++
	event.ID = strconv.FormatInt(s.nextEventID, 10)
	s.pending = append(s.pending, event)
	s.Apply(event)
	return event
}

func (s *AgentMutableState) Apply(event AgentEvent) {
	switch event.Type {
	case EventUserMessage:
		s.messages = append(s.messages, Message{Role: "user", Content: event.Content})
	case EventToolCallStarted:
		s.tools[event.ToolCallID] = ToolState{Status: ToolRunning}
	case EventToolCallFinished:
		s.tools[event.ToolCallID] = ToolState{Status: ToolCompleted}
	case EventRunCompleted:
		s.status = RunCompleted
	}
}
```

Transaction boundary:

```go
func (s *AgentMutableState) CloseAsMutation() []AgentEvent {
	out := append([]AgentEvent(nil), s.pending...)
	s.pending = s.pending[:0]
	return out
}
```

### Segment B: Command Validation Protects History

Real anchors:

```text
command_attr_validator.go line 29: CommandAttrValidator
line 75: ValidateActivityScheduleAttributes
line 136: ValidateTimerScheduleAttributes
line 214: ValidateCompleteWorkflowExecutionAttributes
line 386: ValidateContinueAsNewWorkflowExecutionAttributes
line 453: ValidateStartChildExecutionAttributes
line 633: ValidateCommandSequence
```

Design extraction:

```text
历史不是随便 append；命令必须先验证。
ValidateCommandSequence 防止关闭命令后继续追加其他命令。
不同命令有不同必填字段、长度限制、timeout/retry policy 规则。
```

Agent command translation:

```go
type CommandType string

const (
	CommandCallTool CommandType = "call_tool"
	CommandAnswer   CommandType = "answer"
	CommandFail     CommandType = "fail"
)

type AgentCommand struct {
	Type CommandType
	Tool *ToolCall
	Text string
}

func ValidateCommandSequence(commands []AgentCommand) error {
	closed := false
	for _, cmd := range commands {
		if closed {
			return fmt.Errorf("command after terminal command: %s", cmd.Type)
		}
		switch cmd.Type {
		case CommandCallTool:
			if cmd.Tool == nil || cmd.Tool.ID == "" || cmd.Tool.Name == "" {
				return errors.New("invalid tool command")
			}
		case CommandAnswer, CommandFail:
			closed = true
		default:
			return fmt.Errorf("unknown command: %s", cmd.Type)
		}
	}
	return nil
}
```

### Segment C: Matching Is Task Queue + Poller + Backlog

Real anchors:

```text
matching_engine.go line 342: Start
line 355: Stop
line 580: AddWorkflowTask
line 628: AddActivityTask
line 668: PollWorkflowTaskQueue
line 941: PollActivityTaskQueue
physical_task_queue_manager.go line 290: Start
line 308: Stop
line 477: PollTask
line 550: DispatchSpooledTask
line 588: AddSpooledTaskToMatcher
line 903: backlog based scale-up hint
```

Design extraction:

```text
HTTP request 不应该直接等长任务执行完。
task queue 把“提交任务”和“worker poll 任务”分离。
backlog stats 可以驱动扩容、限流和调度。
worker poll 是一种拉模式，天然适合高可用 worker 集群。
```

Agent task queue translation:

```go
type AgentTask struct {
	ID        string
	RunID     string
	SessionID string
	Payload   json.RawMessage
	CreatedAt time.Time
}

type TaskQueue interface {
	Add(ctx context.Context, task AgentTask) error
	Poll(ctx context.Context) (AgentTask, error)
	Complete(ctx context.Context, taskID string, result AgentResult) error
	Backlog(ctx context.Context) (BacklogStats, error)
}
```

Worker:

```go
func RunAgentWorker(ctx context.Context, queue TaskQueue, runner Runner) error {
	for {
		task, err := queue.Poll(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			continue
		}
		err = runner.Resume(ctx, task.SessionID, task.RunID)
		_ = queue.Complete(ctx, task.ID, AgentResult{Err: err})
	}
}
```

Backlinks:

- [`concepts/durable-workflow.md`](concepts/durable-workflow.md)
- [`reference-implementations.md#11-agent-replay`](reference-implementations.md#11-agent-replay)
- [`system-blueprints.md#5-agent-run-flow`](system-blueprints.md#5-agent-run-flow)

## 7. NATS Server: Slow Consumer Is A First-Class Failure Mode

Source: [`server/client.go`](https://github.com/nats-io/nats-server/blob/dd0f12d479de19df97e3c6275ab087f8e3b91891/server/client.go)

### Segment A: Outbound Buffer And Write Loop

Real anchors:

```text
line 156: isSlowConsumer flag
line 195: SlowConsumerPendingBytes
line 196: SlowConsumerWriteDeadline
line 348: outbound struct
line 1310: writeLoop
line 1662: flushOutbound
line 1879: recovering from slow consumer
line 1888: slow consumer write deadline handler
line 1943: set slow consumer flag
line 2539: pending bytes slow consumer check
line 2554: slow consumer detected notice
```

Design extraction:

```text
pub/sub 系统不能假设 consumer 永远能跟上。
NATS 同时关注 pending bytes 和 write deadline。
slow consumer 是连接级状态，可能导致关闭连接，而不是无限排队。
```

Go learning translation:

```go
type SlowConsumerDetector struct {
	MaxPendingBytes int64
	WriteDeadline   time.Duration
}

func (d SlowConsumerDetector) Check(pendingBytes int64, lastWrite time.Duration) error {
	if pendingBytes > d.MaxPendingBytes {
		return GatewayError{Class: ErrorOverloaded, Err: ErrSlowConsumer}
	}
	if lastWrite > d.WriteDeadline {
		return GatewayError{Class: ErrorTimeout, Err: ErrSlowConsumer}
	}
	return nil
}
```

SSE/event bus policy:

```go
type ConsumerPolicy int

const (
	DisconnectSlowConsumer ConsumerPolicy = iota
	DropSlowConsumerEvent
	PersistForReplay
)

func SendEvent(ch chan<- StreamEvent, event StreamEvent, policy ConsumerPolicy, store EventStore) error {
	select {
	case ch <- event:
		return nil
	default:
		switch policy {
		case DropSlowConsumerEvent:
			return nil
		case PersistForReplay:
			return store.Append(context.Background(), event.StreamID, event.ToAgentEvent())
		default:
			return ErrSlowConsumer
		}
	}
}
```

Backlinks:

- [`concepts/concurrency-backpressure.md`](concepts/concurrency-backpressure.md)
- [`reference-implementations.md#15-event-stream-and-slow-consumer-policy`](reference-implementations.md#15-event-stream-and-slow-consumer-policy)

## 8. awesome-architecture: Template Repository To Go Package Boundaries

Source: [study8677/awesome-architecture](https://github.com/study8677/awesome-architecture/tree/609e0cd64d6af89549112379cbdd0f0e6cf63a3a)

Real anchors:

```text
templates/ai-gateway/README.md
templates/ai-agent-platform/README.md
templates/rag-knowledge-base/README.md
templates/inference-serving/README.md
templates/realtime-chat/README.md
templates/notification-system/README.md
cases/codepilot-agent/README.md
cases/documind-rag/README.md
tutorial/22-AI原生系统设计.md
tutorial/35-AI原生组织架构.md
tutorial/38-AI工作流架构.md
```

Design extraction:

```text
awesome-architecture 是系统设计模板源，不是 Go 源码源。
它的价值是把业务系统拆成能力地图：入口、状态、数据流、质量属性、演进路径。
落到 Go 时必须继续翻译成 package、interface、state machine、queue、test。
```

Template-to-Go mapping:

```text
AI Gateway
  -> internal/gateway/httpapi
  -> internal/gateway/policy
  -> internal/gateway/router
  -> internal/gateway/provider
  -> internal/gateway/fallback
  -> internal/platform/observability

AI Agent Platform
  -> internal/agent/session
  -> internal/agent/event
  -> internal/agent/runner
  -> internal/agent/tool
  -> internal/agent/graph
  -> internal/agent/memory

RAG Knowledge Base
  -> internal/rag/document
  -> internal/rag/chunk
  -> internal/rag/retriever
  -> internal/rag/reranker
  -> internal/rag/citation

Inference Serving
  -> internal/inference/admission
  -> internal/inference/batch
  -> internal/inference/scheduler
  -> internal/inference/model

Realtime Chat
  -> internal/realtime/session
  -> internal/realtime/stream
  -> internal/realtime/replay
  -> internal/realtime/presence

Notification System
  -> internal/notification/event
  -> internal/notification/rule
  -> internal/notification/dedupe
  -> internal/notification/sender
  -> internal/notification/dlq
```

Go design template:

```go
type SystemTemplate struct {
	Name          string
	EntryPoints   []string
	StateStores   []string
	QualityAttrs  []string
	CorePackages  []string
	FailureModes  []string
	Observability []string
}

var AIGatewayTemplate = SystemTemplate{
	Name:         "ai_gateway",
	EntryPoints:  []string{"HTTP", "SSE", "admin config"},
	StateStores:  []string{"policy store", "provider registry", "usage ledger"},
	QualityAttrs: []string{"low latency", "fallback", "quota", "observability"},
	CorePackages: []string{"policy", "router", "provider", "fallback", "telemetry"},
	FailureModes: []string{"provider timeout", "queue full", "invalid input", "quota exceeded"},
	Observability: []string{"provider", "model", "tenant", "fallback_index", "tokens", "latency"},
}
```

Backlinks:

- [`../architecture-to-go/README.md`](../architecture-to-go/README.md)
- [`architecture_labs`](../../architecture_labs/README.md)
- [`system-blueprints.md`](system-blueprints.md)

## Cross-Source Synthesis

### One Request Path

```text
Hertz/Tyk transport pipeline
  -> Bifrost provider route/fallback
  -> OTel Collector telemetry graph
  -> NATS slow consumer policy for streams
  -> Temporal-style event history for long agent runs
```

Go learning version:

```go
func (s System) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	if err := s.admission.Admit(ctx, req); err != nil {
		return ChatResponse{}, err
	}
	plan, err := s.router.Plan(ctx, req)
	if err != nil {
		return ChatResponse{}, err
	}
	resp, err := s.fallback.Try(ctx, plan, req)
	s.telemetry.Record(ctx, ObservationFromChat(req, plan, resp, err))
	return resp, err
}
```

### One Agent Run Path

```text
trpc-agent-go event model
  -> Temporal mutable state/replay
  -> OTel telemetry component lifecycle
  -> NATS slow consumer protection for UI stream
```

Go learning version:

```go
func (r Runner) Resume(ctx context.Context, sessionID, runID string) error {
	events, err := r.store.List(ctx, sessionID)
	if err != nil {
		return err
	}
	state := Replay(sessionID, events)
	commands, err := r.model.Next(ctx, state)
	if err != nil {
		return r.fail(ctx, sessionID, runID, err)
	}
	if err := ValidateCommandSequence(commands); err != nil {
		return r.fail(ctx, sessionID, runID, err)
	}
	return r.applyCommands(ctx, sessionID, runID, commands)
}
```

### One Observability Path

```text
Bifrost provider/fallback dimensions
  -> Tyk error classification/admission dimensions
  -> OTel queue and component graph
  -> NATS slow consumer strategy for telemetry export
```

Go learning version:

```go
type Observation struct {
	Name          string
	TenantID      string
	RequestID     string
	Provider      string
	Model         string
	FallbackIndex int
	ErrorClass    string
	Latency       time.Duration
}

func ObservationFromChat(req ChatRequest, plan RoutePlan, resp ChatResponse, err error) TelemetryEvent {
	return TelemetryEvent{
		Name:       "chat.completion",
		TenantID:   string(req.TenantID),
		RequestID:  string(req.RequestID),
		Provider:   string(resp.Provider),
		Model:      string(req.Model),
		ErrorClass: string(Classify(err)),
		Attributes: map[string]string{
			"route.primary": string(plan.Primary.Provider),
		},
	}
}
```

## Local Reading Assignments

把这份手册落到代码时，按下面顺序做：

| Assignment | Source anchors | Local output |
|---|---|---|
| Provider admission queue | Bifrost `ProviderQueue`, OTel `Queue` | `capstone_ai_gateway_agent_runtime/internal/gateway/provider` |
| Fallback executor | Bifrost `shouldTryFallbacks`, `prepareFallbackRequest` | `capstone_ai_gateway_agent_runtime/internal/gateway/fallback` |
| Gateway admission middleware | Tyk `RateLimitAndQuotaCheck` | `capstone_ai_gateway_agent_runtime/internal/gateway/policy` |
| HTTP engine lifecycle | Hertz `Run`, `Shutdown`, `Use` | `capstone_ai_gateway_agent_runtime/cmd/gateway`, `internal/platform/lifecycle` |
| Agent event history | trpc `Event`, Temporal `MutableState` | `capstone_ai_gateway_agent_runtime/internal/agent/event` |
| Command validation | Temporal `CommandAttrValidator` | `capstone_ai_gateway_agent_runtime/internal/agent/runner` |
| Worker task queue | Temporal matching `Poll*TaskQueue` | `capstone_ai_gateway_agent_runtime/internal/agent/runner` |
| Observability graph | OTel `Graph`, queue | `observability_lab` |
| Streaming slow consumer | NATS `client.go` slow consumer | `realtime_lab` expansion |

## Checklist For Future Source Additions

新增 GitHub 材料时，不再只写摘要。必须至少补：

```text
1. exact commit
2. real file path
3. real symbol names
4. source segment interpretation
5. learning Go translation
6. concept backlinks
7. local lab target
8. one test idea
```

测试想法模板：

```go
func TestSourceLesson(t *testing.T) {
	// Given: condition extracted from source anchor.
	// When: local learning implementation runs.
	// Then: behavior matches the architectural rule.
}
```
