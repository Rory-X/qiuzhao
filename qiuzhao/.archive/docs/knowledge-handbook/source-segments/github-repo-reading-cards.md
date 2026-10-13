# GitHub Repo Reading Cards

这份手册把当前已纳入的 GitHub 项目按“仓库级学习卡”重新组织。它补足两个缺口：

1. `github-project-analysis.md` 偏阶段总结。
2. `source-code-anchors-*.md` 偏源码锚点和学习版翻译。

本文件的目标是让每个仓库都有一张可复盘的学习卡：

```text
Repository
  -> What to read
  -> Core extraction
  -> Go translation
  -> Local proof
  -> Next expansion
```

Backlinks:

- Global source map: [`../source-map.md`](../source-map.md)
- Traceability matrix: [`../traceability-matrix.md`](../traceability-matrix.md)
- Foundations anchors: [`../source-code-anchors-foundations.md`](../source-code-anchors-foundations.md)
- Advanced anchors: [`../source-code-anchors-advanced.md`](../source-code-anchors-advanced.md)
- Source to Capstone: [`../source-to-capstone-crosswalk.md`](../source-to-capstone-crosswalk.md)
- Key code index: [`../key-code-index.md`](../key-code-index.md)
- Production patterns: [`../production-patterns-cookbook.md`](../production-patterns-cookbook.md)

## Reading Rule

读每个仓库时，不要只问“这个项目怎么写”。要按这 5 个问题抽取：

```text
1. 这个项目解决什么系统问题？
2. 它的入口在哪里？
3. 核心抽象是什么？
4. 哪条关键链路最值得迁移？
5. 在本地应该写哪个 Go 包、哪个测试证明？
```

## 01 Language Repos

### go101/go101

What to read:

- `README.md`
- `pages/fundamentals`
- `pages/generics`
- `go101.go`, `main.go`

Core extraction:

- 接口和方法集决定 provider/tool/store 这类小接口是否好用。
- slice/map/channel 的语义决定并发边界是否安全。
- 泛型可以用于通用 queue/state/result，但不能替代清晰领域类型。

Go translation:

```go
type ChatCaller interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type ToolInvoker interface {
	Invoke(ctx context.Context, call ToolCall) (ToolResult, error)
}

type EventStore interface {
	Append(ctx context.Context, sessionID string, event Event) error
	List(ctx context.Context, sessionID string) ([]Event, error)
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go)

Next expansion:

- 给 `EventStore.List` 加并发安全拷贝测试。
- 给 provider interface 加 fake 实现，证明小接口可测试。

### quii/learn-go-with-tests

What to read:

- `arrays/*`
- `concurrency/*`
- `context.md`
- `http-server.md`

Core extraction:

- 行为先于实现。
- fake dependency 是架构训练工具。
- 并发和 context 要用测试证明，而不是靠肉眼相信。

Go translation:

```go
func TestFallbackUsesBackupProvider(t *testing.T) {
	registry := provider.NewRegistry()
	registry.Replace("primary", provider.NewRuntime("primary", provider.FakeTimeout{}))
	registry.Replace("backup", provider.NewRuntime("backup", provider.FakeSuccess{Content: "ok"}))

	executor := fallback.NewExecutor(registry, telemetry.NewMemoryExporter())
	resp, err := executor.Execute(context.Background(), req(), core.RoutePlan{Attempts: []core.Route{
		{Provider: "primary", Model: "gpt-demo"},
		{Provider: "backup", Model: "gpt-demo"},
	}})

	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if resp.Provider != "backup" {
		t.Fatalf("provider: %s", resp.Provider)
	}
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor_test.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/app/demo_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/app/demo_test.go)

Next expansion:

- 每个生产模式都补一个 failure-path test。

### mmcgrana/gobyexample

What to read:

- `examples/context`
- `examples/worker-pools`
- `examples/rate-limiting`
- `examples/channel-directions`

Core extraction:

- channel direction 是类型级边界。
- worker pool 是容量控制，不是无限 goroutine。
- rate limit 要和 context/deadline 组合使用。

Go translation:

```go
type Queue[T any] struct {
	items chan T
}

func (q Queue[T]) TryPut(ctx context.Context, item T) error {
	select {
	case q.items <- item:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return ErrQueueFull
	}
}

func Subscribe(sessionID string) <-chan Event {
	ch := make(chan Event, 16)
	register(sessionID, ch)
	return ch
}
```

Local proof:

- [`../../../architecture_labs/inference/batch_queue.go`](../../../architecture_labs/inference/batch_queue.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go)

Next expansion:

- 把 provider queue 从内存队列扩成 per-provider worker pool。

### golang/example

What to read:

- `helloserver/server.go`
- `outyet/main.go`

Core extraction:

- 标准库 `net/http` 足够表达清晰 transport boundary。
- 后台 goroutine 要有状态保护、测试 hook 和 shutdown 设计。
- `expvar` 思想可升级成 metrics/exporter。

Go translation:

```go
func RegisterRoutes(mux *http.ServeMux, handler httpapi.Handler) {
	mux.HandleFunc("GET /healthz", handler.Health)
	mux.HandleFunc("POST /v1/chat/completions", handler.Chat)
}

func RunHealthPoller(ctx context.Context, tick <-chan time.Time, poll func(context.Context) error) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-tick:
			_ = poll(ctx)
		}
	}
}
```

Local proof:

- [`../../../api_service`](../../../api_service/README.md)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go)

Next expansion:

- 把 provider health polling 接入 lifecycle component。

### inancgumus/learngo

What to read:

- `interfaces`
- `concurrency`
- first program and type exercises

Core extraction:

- 它适合作为语言肌肉训练，不适合作为大项目结构范本。
- 每读一个大系统片段，回这里补对应语言点。

Go translation:

```go
type ProviderName string
type ModelName string
type TenantID string

func (p ProviderName) Empty() bool {
	return p == ""
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/types.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/types.go)

Next expansion:

- 为重要 ID 类型加解析、验证和测试。

## 02 Structure And Style Repos

### golang-standards/project-layout

What to read:

- `cmd/README.md`
- `internal/README.md`
- `pkg/README.md`

Core extraction:

- `cmd` 是可执行入口。
- `internal` 是编译器强制的私有边界。
- `pkg` 是对外承诺，不是“放公共代码”的默认桶。

Go translation:

```text
cmd/gateway/main.go
internal/app/demo.go
internal/gateway/core/service.go
internal/gateway/httpapi/handler.go
internal/agent/runner/runner.go
internal/platform/lifecycle/app.go
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/cmd/gateway/main.go`](../../../capstone_ai_gateway_agent_runtime/cmd/gateway/main.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/app/demo.go`](../../../capstone_ai_gateway_agent_runtime/internal/app/demo.go)

Next expansion:

- 当出现 worker binary 时新增 `cmd/worker`，不要把 worker loop 塞进 gateway main。

### uber-go/guide

What to read:

- error wrapping
- channel size
- container copy
- goroutine lifecycle

Core extraction:

- 错误要给人读，也要给机器分类。
- channel buffer 是容量设计。
- slice/map 要在边界处拷贝。

Go translation:

```go
type GatewayError struct {
	Class ErrorClass
	Route Route
	Err   error
}

func (e GatewayError) Unwrap() error {
	return e.Err
}

func CopyEvents(events []Event) []Event {
	copied := make([]Event, len(events))
	copy(copied, events)
	return copied
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/errors.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/errors.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go)

Next expansion:

- 为所有返回 slice/map 的 store 增加“不被外部修改”的测试。

### google/styleguide Go

What to read:

- interfaces
- package comments
- clarity and maintainability guidance

Core extraction:

- 接口尽量由使用方定义。
- 注释解释 why，不重复 what。
- 小包和清晰命名比抽象层数量重要。

Go translation:

```go
type HealthView interface {
	Healthy(name core.ProviderName) bool
}

type Planner struct {
	health HealthView
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/router/planner.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/router/planner.go)

Next expansion:

- 拆分 provider capability view、price view、health view，而不是做巨大 provider registry interface。

### sagikazarmark/modern-go-application

What to read:

- `cmd/.../main.go`
- `internal/app/...`
- health/metrics/tracing/bootstrap

Core extraction:

- 生产入口会膨胀，所以 app composition 必须集中。
- HTTP、worker、telemetry、db、message bus 都应该作为组件接入生命周期。

Go translation:

```go
type Component interface {
	Name() string
	Start(ctx context.Context) error
	Shutdown(ctx context.Context) error
}

type App struct {
	Components      []Component
	ShutdownTimeout time.Duration
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app.go)

Next expansion:

- 增加 telemetry flush component、provider health runner component。

## 03 Architecture Pattern Repos

### ThreeDotsLabs/wild-workouts-go-ddd-example

What to read:

- domain object
- repository update closure
- command handler
- HTTP port

Core extraction:

- Domain object protects invariants.
- Repository owns transactional read-modify-write.
- Handler maps protocol to command.

Go translation:

```go
type SessionRepository interface {
	Update(ctx context.Context, id string, fn func(*Session) error) error
}

func (h SendMessageHandler) Handle(ctx context.Context, cmd SendMessage) error {
	return h.sessions.Update(ctx, cmd.SessionID, func(s *Session) error {
		return s.AppendUserMessage(cmd.Content)
	})
}
```

Local proof:

- [`../../../architecture_labs/agent/session.go`](../../../architecture_labs/agent/session.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go)

Next expansion:

- 把 session mutation 从简单 append 升级为状态机检查。

### amitshekhariitbhu/go-backend-clean-architecture

What to read:

- controller/usecase/repository/domain chain
- usecase timeout

Core extraction:

- Handler 不持有数据库细节。
- Usecase 设置业务 deadline。
- Repository 隔离存储驱动。

Go translation:

```go
type GatewayUsecase struct {
	service core.Service
	timeout time.Duration
}

func (u GatewayUsecase) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, u.timeout)
	defer cancel()
	return u.service.Chat(ctx, req)
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go)

Next expansion:

- 为不同 tenant/model 加 timeout policy。

### evrone/go-clean-template

What to read:

- multi transport controllers
- entity state transition
- repository boundary

Core extraction:

- REST/gRPC/AMQP/NATS 可以共享 usecase。
- 状态机属于 entity/usecase，不属于 controller。

Go translation:

```go
type RunStatus string

const (
	RunPending RunStatus = "pending"
	RunRunning RunStatus = "running"
	RunFailed  RunStatus = "failed"
	RunDone    RunStatus = "done"
)

func (r *Run) Complete() error {
	if r.Status != RunRunning {
		return ErrInvalidTransition
	}
	r.Status = RunDone
	return nil
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph.go)

Next expansion:

- 为 tool call 和 workflow run 增加显式状态机类型。

### go-kit/examples

What to read:

- service
- endpoint set
- transport/http
- endpoint middleware

Core extraction:

- service 表达业务能力。
- endpoint 承载横切能力。
- transport 只做协议编解码。

Go translation:

```go
type Endpoint[Req any, Resp any] func(context.Context, Req) (Resp, error)

func WithRateLimit[Req any, Resp any](next Endpoint[Req, Resp], limiter Limiter) Endpoint[Req, Resp] {
	return func(ctx context.Context, req Req) (Resp, error) {
		if err := limiter.Allow(ctx); err != nil {
			var zero Resp
			return zero, err
		}
		return next(ctx, req)
	}
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go)

Next expansion:

- 为 provider call 加 endpoint middleware stack：rate limit、breaker、trace、audit。

## 04 Real Product Repos

### pocketbase/pocketbase

What to read:

- standalone app
- hooks
- API registration
- core App interface

Core extraction:

- 单 binary 可以承载产品能力。
- hook 是产品扩展点，不是所有逻辑的替代品。
- route aggregation makes product surface visible.

Go translation:

```go
type Hook[T any] struct {
	handlers []func(context.Context, T) error
}

func (h *Hook[T]) Add(fn func(context.Context, T) error) {
	h.handlers = append(h.handlers, fn)
}

func (h Hook[T]) Run(ctx context.Context, value T) error {
	for _, fn := range h.handlers {
		if err := fn(ctx, value); err != nil {
			return err
		}
	}
	return nil
}
```

Local proof:

- [`../production-patterns-cookbook.md#config-validation-before-hot-swap`](../production-patterns-cookbook.md#config-validation-before-hot-swap)

Next expansion:

- 为 provider before/after call 增加 hook，并明确失败语义。

### usememos/memos

What to read:

- `cmd/memos/main.go`
- `server/server.go`
- memo service create path

Core extraction:

- 产品 server 组合 HTTP、静态资源、API、后台 runner 和 shutdown。
- 主路径和 best-effort 副作用要分开。

Go translation:

```go
func (s Service) AppendEvent(ctx context.Context, event Event) error {
	if err := s.store.Append(ctx, event); err != nil {
		return err
	}
	if err := s.stream.Publish(ctx, event); err != nil {
		s.log.Warn("publish event", "event_id", event.ID, "err", err)
	}
	return nil
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go)

Next expansion:

- 增加 durable outbox，替代纯 best-effort publish。

### caddyserver/caddy

What to read:

- module registry
- config lifecycle
- admin API
- app cleanup

Core extraction:

- provider/plugin 有 lifecycle。
- 动态配置必须 validate/provision/cleanup。
- 核心不应 import 所有具体模块。

Go translation:

```go
type ProviderModule interface {
	ID() string
	Provision(context.Context, ProviderConfig) error
	Validate() error
	Chat(context.Context, core.ChatRequest) (core.ChatResponse, error)
	Cleanup(context.Context) error
}
```

Local proof:

- [`../production-patterns-cookbook.md#config-validation-before-hot-swap`](../production-patterns-cookbook.md#config-validation-before-hot-swap)
- [`../../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app.go)

Next expansion:

- 建 provider factory registry 和 hot-swap manager。

### syncthing/syncthing

What to read:

- `GOALS.md`
- protocol boundary
- model state
- long-running service entrance

Core extraction:

- 目标排序比技术清单重要。
- 协议边界要稳定。
- 长运行系统状态要集中管理。

Go translation:

```go
type Runtime struct {
	config  ConfigStore
	events  EventStore
	runners RunnerRegistry
	pubsub  EventBus
	stats   Stats
}

type AgentStreamEvent struct {
	Version   string          `json:"version"`
	ID        string          `json:"id"`
	SessionID string          `json:"session_id"`
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/event/event.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/event/event.go)

Next expansion:

- 为 agent stream event 加 version 字段和 upcaster 测试。

## 05 Large System Repos

### maximhq/bifrost

What to read:

- `README.md`
- `core/bifrost.go`
- architecture docs and config examples

Core extraction:

- AI gateway 的关键是 provider abstraction、queue、fallback、plugins、observability。
- fallback 不是无限重试，而是 error taxonomy + route plan + budget。

Go translation:

```go
func (e Executor) Execute(ctx context.Context, req core.ChatRequest, plan core.RoutePlan) (core.ChatResponse, error) {
	var lastErr error
	for i, route := range plan.Attempts {
		resp, err := e.call(ctx, req.WithRoute(route))
		e.record(ctx, req, route, i, resp, err)
		if err == nil {
			return resp, nil
		}
		lastErr = err
		if !core.CanFallback(err) {
			break
		}
	}
	return core.ChatResponse{}, lastErr
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go)

Next expansion:

- 加 route scoring、provider cost、hedged request guardrails。

### trpc-group/trpc-agent-go

What to read:

- agent interfaces
- event model
- graph agent
- tool packages

Core extraction:

- agent runtime 应围绕 event、runner、tool、graph 组织。
- tool call/response/error 都是事件。

Go translation:

```go
type Runner struct {
	events event.Store
	model  Model
	tools  tool.Registry
}

func (r Runner) Run(ctx context.Context, sessionID string, input string) error {
	_ = r.events.Append(ctx, sessionID, event.Event{Type: event.UserMessage, Content: input})
	state := event.Replay(mustList(r.events, sessionID))
	cmd, err := r.model.Next(ctx, state)
	if err != nil {
		return err
	}
	return r.applyCommand(ctx, sessionID, cmd)
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go)

Next expansion:

- 接入 streaming model command 和 graph node routing。

### TykTechnologies/tyk

What to read:

- gateway middleware
- rate limiting
- API definition
- analytics

Core extraction:

- policy 应该是配置数据。
- quota/rate limit 应在 provider call 前执行。
- analytics 不应阻塞主请求路径。

Go translation:

```go
type TenantPolicy struct {
	TenantID         core.TenantID
	AllowedModels   map[core.ModelName]bool
	AllowedProviders map[core.ProviderName]bool
	AllowFallbacks  bool
}

func (e Engine) Authorize(ctx context.Context, req core.ChatRequest) (core.TenantPolicy, error) {
	policy, ok := e.store.policies[req.TenantID]
	if !ok {
		return core.TenantPolicy{}, core.GatewayError{Class: core.ErrorUnauthorized, Err: core.ErrTenantNotAllowed}
	}
	return policy, nil
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/engine.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/engine.go)

Next expansion:

- 引入 Redis/windowed quota 和 admin policy update。

### cloudwego/hertz

What to read:

- engine
- request context
- middleware
- client middleware

Core extraction:

- 框架 context 和业务 context 要隔离。
- transport boundary 应保持薄。
- outgoing provider client 也需要 middleware。

Go translation:

```go
type BusinessHandler func(context.Context, core.ChatRequest) (core.ChatResponse, error)

func Adapt(fn BusinessHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := decodeChat(r)
		resp, err := fn(r.Context(), req)
		encodeChat(w, resp, err)
	}
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go)

Next expansion:

- 增加 request body size、timeout、panic recovery middleware。

### open-telemetry/opentelemetry-collector

What to read:

- component model
- receiver/processor/exporter
- exporter queue
- service graph

Core extraction:

- telemetry pipeline 也是一个组件图。
- exporter queue 必须保护主请求路径。
- drop 和 retry 都要被观测。

Go translation:

```go
type Sink interface {
	Record(ctx context.Context, event telemetry.Event) error
}

type AsyncExporter struct {
	next  Sink
	queue chan telemetry.Event
}

func (e *AsyncExporter) Record(ctx context.Context, event telemetry.Event) error {
	select {
	case e.queue <- event:
		return nil
	default:
		return nil
	}
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go)

Next expansion:

- 增加 batch processor、retry processor、export error metrics。

### temporalio/temporal

What to read:

- history service
- matching service
- worker model
- command validation

Core extraction:

- durable workflow 的核心是 history + replay。
- activity/tool 需要幂等。
- worker 失败后应可恢复。

Go translation:

```go
func Replay(events []event.Event) event.State {
	state := event.State{Status: event.StatusRunning, RunningTools: map[string]event.ToolCall{}}
	for _, evt := range events {
		state.Apply(evt)
	}
	return state
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store.go)

Next expansion:

- 增加 outbox、event version/upcaster 和 resume signal。

### nats-io/nats-server

What to read:

- client
- route
- sublist
- JetStream
- slow consumer

Core extraction:

- slow consumer 是一等失败模式。
- pub/sub 需要明确 subject、subscription、drop/disconnect/replay 策略。

Go translation:

```go
func (b *Bus) Publish(sessionID string, evt event.Event) {
	for _, sub := range b.subscribers(sessionID) {
		select {
		case sub <- evt:
		default:
			b.dropped++
		}
	}
}
```

Local proof:

- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go)

Next expansion:

- 加 replay cursor 和 durable event store catch-up API。

### study8677/awesome-architecture

What to read:

- AI Gateway template
- AI Agent Platform template
- RAG template
- Inference Serving template
- Realtime Chat template
- Notification System template

Core extraction:

- 它提供系统地图，不提供 Go 实现。
- 本地学习要把模板翻译成 package、interface、queue、state、test。

Go translation:

```text
AI Gateway          -> architecture_labs/gateway        -> capstone internal/gateway
AI Agent Platform  -> architecture_labs/agent          -> capstone internal/agent
RAG Knowledge Base -> architecture_labs/rag            -> capstone internal/agent/tool/rag.go
Inference Serving  -> architecture_labs/inference      -> capstone provider queue
Realtime Chat      -> architecture_labs/realtime       -> capstone stream bus
Notification       -> architecture_labs/notification   -> capstone idempotency/outbox patterns
```

Local proof:

- [`../../architecture-to-go/lab-code-anchors.md`](../../architecture-to-go/lab-code-anchors.md)
- [`../../../architecture_labs`](../../../architecture_labs/README.md)

Next expansion:

- 把每个 lab 扩一层生产机制：deadline、telemetry、idempotency、config、lifecycle。

## Review Checklist

每读完一个 GitHub 仓库，至少补齐这 6 项：

```text
1. Source anchor: commit + file + symbol
2. Segment card: this file or phase segment file
3. Concept backlink: concepts/*
4. Local proof: architecture_labs or capstone package
5. Test proof: *_test.go or practice-workbook skeleton
6. Production expansion: production-patterns-cookbook or roadmap
```

如果只能说“这个项目很优秀”，说明还没读进去。必须能说出：

```text
这个仓库的哪个文件/接口
  -> 解决了哪个系统问题
  -> 在 Go 中怎么改写
  -> 本地哪个测试能证明
```
