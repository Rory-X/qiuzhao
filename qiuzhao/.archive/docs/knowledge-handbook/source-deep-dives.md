# Source Deep Dives

这份手册把已纳入的 GitHub 材料继续拆成“源码段落 -> 架构机制 -> Go 代码模板 -> 本地 proof”。它不是仓库摘要，而是学习时可以逐段反查的知识网络。

读法：

```text
Source paragraph
  -> What design pressure created this shape?
  -> What should I copy into Go?
  -> What should I avoid copying blindly?
  -> Which local code/test proves the mechanism?
```

Backlinks:

- Source map: [`source-map.md`](source-map.md)
- Repo cards: [`source-segments/github-repo-reading-cards.md`](source-segments/github-repo-reading-cards.md)
- Source to tests: [`source-to-test-proof.md`](source-to-test-proof.md)
- Key code index: [`key-code-index.md`](key-code-index.md)
- Capstone: [`../../capstone_ai_gateway_agent_runtime`](../../capstone_ai_gateway_agent_runtime/README.md)

## Phase 01: Language Sources

### go101/go101 -> Interface And Runtime Semantics

Source reading:

- Read type system, method set, interface value, slice/map/channel and generics as lookup chapters.
- The important paragraph is not a framework pattern; it is the Go semantic rule that decides whether your provider client, event store or queue is safe.
- When a value has pointer receivers, only `*T` implements the interface. This matters for clients with mutexes, pools, metrics and mutable state.

Go translation:

```go
type ChatClient interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type HTTPProvider struct {
	mu     sync.Mutex
	client *http.Client
}

func (p *HTTPProvider) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return ChatResponse{Provider: req.Provider}, nil
}

var _ ChatClient = (*HTTPProvider)(nil)
```

Architecture transfer:

```text
method set -> compile-time interface assertion
slice/map semantics -> defensive copy on store/list APIs
channel semantics -> bounded queue and one-way channel signatures
generics -> use after concrete event/state shapes stabilize
```

Local proof:

- [`internal/gateway/provider/client.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/client.go)
- [`internal/agent/event/store.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go)

### quii/learn-go-with-tests -> Behavior First

Source reading:

- Read each chapter as “test writes the contract before the implementation”.
- In concurrency/context chapters, pay attention to fake dependencies. A network checker or provider call should be replaceable by a fake in tests.
- The paragraph to absorb: the API is designed from observable behavior, not from the implementation you hope to write.

Go translation:

```go
func TestGatewayFallbackRecordsTelemetry(t *testing.T) {
	registry := provider.NewRegistry()
	registry.Replace("primary", provider.NewRuntime("primary", provider.FakeTimeout{}))
	registry.Replace("backup", provider.NewRuntime("backup", provider.FakeSuccess{
		Name:    "backup",
		Content: "ok",
	}))

	resp, err := service.Chat(context.Background(), core.ChatRequest{
		TenantID: "demo",
		Model:    "gpt-demo",
		Provider: "primary",
		Fallbacks: []core.Route{
			{Provider: "backup", Model: "gpt-demo"},
		},
	})

	if err != nil {
		t.Fatalf("chat: %v", err)
	}
	if resp.Provider != "backup" {
		t.Fatalf("provider: %s", resp.Provider)
	}
}
```

Architecture transfer:

```text
test first -> request contract
fake dependency -> provider/tool/model isolation
table test -> fallback and error taxonomy
context test -> cancellation proof
```

Local proof:

- [`internal/gateway/core/service_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service_test.go)
- [`internal/agent/runner/runner_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner_test.go)

### mmcgrana/gobyexample -> Concurrency Blocks

Source reading:

- Read worker pool, rate limiting, context and channel direction examples as tiny production mechanisms.
- The important paragraph is: concurrency primitives must express ownership and pressure, not just parallelism.
- A queue without full behavior is an unbounded liability.

Go translation:

```go
type ProviderQueue struct {
	jobs chan Job
}

func (q *ProviderQueue) TrySubmit(ctx context.Context, job Job) error {
	select {
	case q.jobs <- job:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return ErrQueueFull
	}
}
```

Architecture transfer:

```text
worker pool -> provider/tool executor pool
rate limit -> tenant/model/provider admission control
context -> request deadline from HTTP to provider
channel direction -> event publisher/subscriber boundary
```

Local proof:

- [`internal/gateway/provider/queue_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue_test.go)
- [`internal/gateway/provider/bounded_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/bounded_test.go)

### golang/example -> Standard Library Service

Source reading:

- Read official examples as the smallest complete service shape: `main`, handler, background goroutine, state and testability.
- The paragraph to absorb: standard library HTTP is enough to learn boundaries before choosing a high-performance framework.

Go translation:

```go
func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}
```

Architecture transfer:

```text
net/http handler -> transport adapter
httptest -> API proof
background goroutine -> health checker / telemetry flush
```

Local proof:

- [`internal/gateway/httpapi/handler_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler_test.go)
- [`../../api_service`](../../api_service/README.md)

### inancgumus/learngo -> Type Muscle Memory

Source reading:

- Read it as drills, not architecture. It helps make receivers, defined types, constants and interfaces feel natural.
- The paragraph to absorb: domain vocabulary should become types before it becomes infrastructure.

Go translation:

```go
type EventType string

const (
	UserMessage      EventType = "user_message"
	AssistantMessage EventType = "assistant_message"
	ToolStarted      EventType = "tool_started"
)

func (t EventType) IsToolEvent() bool {
	return t == ToolStarted
}
```

Local proof:

- [`internal/agent/event/event.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/event.go)

## Phase 02: Structure And Style Sources

### golang-standards/project-layout -> Directory Vocabulary

Source reading:

- Read `cmd`, `internal`, `pkg`, `api` as vocabulary, not law.
- The paragraph to absorb: a directory name is a promise about who may import the code and how stable it is.

Go translation:

```text
cmd/gateway/main.go
internal/app
internal/gateway/core
internal/gateway/httpapi
internal/gateway/provider
internal/agent/runner
internal/platform/lifecycle
```

Architecture transfer:

```text
cmd -> composition root
internal -> product-private implementation
api -> external schema/protocol
pkg -> only when external reuse is intended
```

Local proof:

- [`../../capstone_ai_gateway_agent_runtime/cmd/gateway`](../../capstone_ai_gateway_agent_runtime/cmd/gateway)
- [`../../capstone_ai_gateway_agent_runtime/internal`](../../capstone_ai_gateway_agent_runtime/internal)

### uber-go/guide -> Production Correctness Style

Source reading:

- Read error wrapping, channel size, container copy, goroutine lifecycle and mutex sections as reliability rules.
- The paragraph to absorb: style is not decoration; it prevents ambiguous failures in production.

Go translation:

```go
func (s *MemoryStore) List(ctx context.Context, sessionID string) ([]Event, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	events := s.sessions[sessionID]
	out := make([]Event, len(events))
	copy(out, events)
	return out, nil
}
```

Architecture transfer:

```text
%w -> error chain for provider failures
copy slices/maps -> no mutable state leaks
channel capacity -> explicit backpressure decision
goroutine lifetime -> context or close path
```

Local proof:

- [`internal/agent/event/store.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go)
- [`internal/gateway/provider/queue.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go)

### google/styleguide -> Small Interfaces

Source reading:

- Read interface guidance as a guard against framework-shaped code.
- The paragraph to absorb: the consumer should usually define the smallest interface it needs.

Go translation:

```go
type Authorizer interface {
	Authorize(ctx context.Context, req ChatRequest) (TenantPolicy, error)
}

type Router interface {
	Plan(ctx context.Context, req ChatRequest, policy TenantPolicy) (RoutePlan, error)
}

type Executor interface {
	Execute(ctx context.Context, req ChatRequest, plan RoutePlan) (ChatResponse, error)
}
```

Architecture transfer:

```text
small interface -> replaceable provider/router/tool
consumer-owned interface -> fewer fake implementations
clear naming -> test reads like product behavior
```

Local proof:

- [`internal/gateway/core/service.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go)

### sagikazarmark/modern-go-application -> Composition Root

Source reading:

- Read startup code as a map of production concerns: config, logger, telemetry, DB, server, workers and shutdown.
- The paragraph to absorb: startup surface is allowed to be wider than business packages because it wires the world.

Go translation:

```go
type App struct {
	Components      []Component
	ShutdownTimeout time.Duration
}

func (a App) Run(ctx context.Context) error {
	for _, component := range a.Components {
		c := component
		go func() { _ = c.Start(ctx) }()
	}
	<-ctx.Done()
	return a.shutdownReverse()
}
```

Architecture transfer:

```text
config/load -> app.Build
server/workers -> lifecycle components
telemetry -> platform package
shutdown -> reverse order with timeout
```

Local proof:

- [`internal/platform/lifecycle/app_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go)

## Phase 03: Architecture Pattern Sources

### ThreeDotsLabs/wild-workouts-go-ddd-example -> Domain And Update Closure

Source reading:

- The `hour.Repository` shape uses `UpdateHour(ctx, time, updateFn)`; the repository owns the read-modify-write transaction and the domain object owns mutation rules.
- The paragraph to absorb: business state changes should not be scattered across controllers, SQL callbacks and background jobs.

Go translation:

```go
type SessionRepository interface {
	Update(ctx context.Context, id string, fn func(*Session) error) error
}

func (h StartToolHandler) Handle(ctx context.Context, cmd StartToolCommand) error {
	return h.sessions.Update(ctx, cmd.SessionID, func(s *Session) error {
		return s.StartToolCall(cmd.ToolCallID, cmd.ToolName)
	})
}
```

Architecture transfer:

```text
domain method -> invariant
repository update closure -> transaction boundary
command handler -> application usecase
HTTP port -> decode command only
```

Local proof:

- [`../../architecture_labs/agent/session.go`](../../architecture_labs/agent/session.go)
- [`internal/agent/runner/runner_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner_test.go)

### amitshekhariitbhu/go-backend-clean-architecture -> Usecase Deadline

Source reading:

- Read controller/usecase/repository as a request path. The usecase owns business deadline and dependency orchestration.
- The paragraph to absorb: HTTP handler should not decide provider routing, database mutation or retry policy.

Go translation:

```go
type GatewayUsecase struct {
	timeout time.Duration
	service ChatService
}

func (u GatewayUsecase) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, u.timeout)
	defer cancel()
	return u.service.Chat(ctx, req)
}
```

Local proof:

- [`internal/gateway/httpapi/handler.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go)
- [`internal/gateway/core/service.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go)

### evrone/go-clean-template -> Multi Transport And State Machine

Source reading:

- Read REST/gRPC/message controllers as adapters around the same usecase.
- Read entity status transitions as a warning: do not let transport code mutate state directly.

Go translation:

```go
type ToolCallStatus string

const (
	ToolPending   ToolCallStatus = "pending"
	ToolRunning   ToolCallStatus = "running"
	ToolSucceeded ToolCallStatus = "succeeded"
	ToolFailed    ToolCallStatus = "failed"
)

func (c *ToolCall) Transition(next ToolCallStatus) error {
	if c.Status == ToolSucceeded || c.Status == ToolFailed {
		return ErrTerminalState
	}
	c.Status = next
	return nil
}
```

Architecture transfer:

```text
HTTP/SSE/worker -> same usecase
entity transition -> state invariant
repository adapter -> persistence detail
```

Local proof:

- [`internal/agent/graph/graph_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph_test.go)

### go-kit/examples -> Service / Endpoint / Transport

Source reading:

- The fetched `addendpoint.Set` wraps a service method with rate limit, circuit breaker, trace, logging and metrics before transport sees it.
- The paragraph to absorb: middleware composes around an endpoint, not inside business service.

Go translation:

```go
type Endpoint func(ctx context.Context, req ChatRequest) (ChatResponse, error)

type EndpointMiddleware func(Endpoint) Endpoint

func ChainEndpoint(endpoint Endpoint, middleware ...EndpointMiddleware) Endpoint {
	for i := len(middleware) - 1; i >= 0; i-- {
		endpoint = middleware[i](endpoint)
	}
	return endpoint
}
```

Middleware proof shape:

```go
deny := func(next Endpoint) Endpoint {
	return func(ctx context.Context, req ChatRequest) (ChatResponse, error) {
		return ChatResponse{}, GatewayError{Class: ErrorUnauthorized, Err: errors.New("missing api key")}
	}
}
```

Architecture transfer:

```text
service -> pure usecase
endpoint -> middleware unit
transport -> HTTP/SSE/gRPC decoding and encoding
```

Local proof:

- [`internal/gateway/core/endpoint.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint.go)
- [`internal/gateway/core/endpoint_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint_test.go)

## Phase 04: Real Product Sources

### pocketbase/pocketbase -> Single Binary And Hooks

Source reading:

- Read `examples/base/main.go` and app/hook registration as “stable core plus extension points”.
- The paragraph to absorb: product systems need controlled extension, not ad hoc edits in core code.

Go translation:

```go
type ProviderHook func(context.Context, *GatewayRequest) error

type GatewayApp struct {
	beforeProvider []ProviderHook
}

func (a *GatewayApp) BeforeProvider(fn ProviderHook) {
	a.beforeProvider = append(a.beforeProvider, fn)
}

func (a GatewayApp) runBeforeProvider(ctx context.Context, req *GatewayRequest) error {
	for _, hook := range a.beforeProvider {
		if err := hook(ctx, req); err != nil {
			return err
		}
	}
	return nil
}
```

Architecture transfer:

```text
single binary -> fast learning/product launch
hooks -> provider middleware, audit, cost attribution
admin routes -> control plane
realtime -> agent event stream
```

Local proof:

- [`internal/app/demo.go`](../../capstone_ai_gateway_agent_runtime/internal/app/demo.go)
- [`internal/gateway/fallback/executor.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go)

### usememos/memos -> Main Path Plus Best-Effort Side Effects

Source reading:

- Read memo creation as a product method with authorization, persistence and secondary effects.
- The paragraph to absorb: main state write should be durable; broadcast/webhook/notification can be best effort or outbox-backed.

Go translation:

```go
func (s Service) AppendAgentEvent(ctx context.Context, evt Event) error {
	if err := s.store.Append(ctx, evt.SessionID, evt); err != nil {
		return err
	}
	if err := s.live.Publish(ctx, evt); err != nil {
		s.log.Warn("publish live event", "event_id", evt.ID, "err", err)
	}
	return nil
}
```

Outbox translation:

```go
func (w Worker) RunOnce(ctx context.Context) error {
	events, err := w.Store.ClaimDue(ctx, w.now(), w.Limit)
	if err != nil {
		return err
	}
	for _, event := range events {
		if err := w.Publish(ctx, event); err != nil {
			_ = w.Store.MarkRetry(ctx, event.ID, w.now().Add(w.Backoff))
			continue
		}
		_ = w.Store.MarkDone(ctx, event.ID)
	}
	return nil
}
```

Local proof:

- [`internal/agent/stream/bus_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus_test.go)
- [`internal/platform/outbox/worker_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/outbox/worker_test.go)

### caddyserver/caddy -> Module Lifecycle And Dynamic Config

Source reading:

- The fetched `caddy.go` has `Run`, `Load`, `Validate`, provision/run paths and cleanup comments. This confirms the shape: decode/provision/validate new config before replacing runtime state.
- The paragraph to absorb: config update is a lifecycle operation, not a map mutation.

Go translation:

```go
func (c GatewayConfig) Validate() error {
	providers := make(map[core.ProviderName]ProviderConfig, len(c.Providers))
	for _, provider := range c.Providers {
		if provider.Name == "" {
			return fmt.Errorf("provider name is required")
		}
		providers[provider.Name] = provider
	}
	for _, tenant := range c.Tenants {
		for providerName, allowed := range tenant.AllowedProviders {
			if allowed {
				if _, ok := providers[providerName]; !ok {
					return fmt.Errorf("tenant %s allows unknown provider %s", tenant.TenantID, providerName)
				}
			}
		}
	}
	return nil
}
```

Swap proof:

```go
func (s *ConfigStore) SwapWithAudit(actor string, next GatewayConfig) (int, error) {
	if err := next.Validate(); err != nil {
		return 0, err
	}
	next = cloneGatewayConfig(next)

	s.mu.Lock()
	defer s.mu.Unlock()

	previousVersion := s.version
	previous := s.current
	s.version++
	s.current = next
	s.history[s.version] = cloneGatewayConfig(next)
	s.audit = append(s.audit, ConfigAuditEvent{
		Action:          "swap",
		Actor:           actor,
		Version:         s.version,
		PreviousVersion: previousVersion,
		Summary:         configSummary(previous, next),
	})
	return s.version, nil
}
```

Local proof:

- [`internal/app/config_test.go`](../../capstone_ai_gateway_agent_runtime/internal/app/config_test.go)
- [`internal/platform/lifecycle/app_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go)

Control-plane lessons:

```text
invalid config -> reject before swap
accepted config -> audit actor/version/summary
rollback -> restore prior snapshot as a new version
```

### syncthing/syncthing -> Protocol And Long-Running State

Source reading:

- Read `GOALS.md` before code. Safety goals explain why protocol and state are carefully isolated.
- Read protocol types as long-lived compatibility boundaries.

Go translation:

```go
type StoredEvent struct {
	Version   int
	SessionID string
	Type      EventType
	Payload   json.RawMessage
}

type Upcaster func(StoredEvent) (Event, error)
```

Architecture transfer:

```text
goals first -> design priorities
protocol boundary -> stable external event shape
model state -> lifecycle + locks + stats
compatibility -> event upcaster
```

Local proof:

- [`internal/agent/event/versioned_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/versioned_test.go)

## Phase 05: Large System Sources

### maximhq/bifrost -> AI Gateway Routing And Fallback

Source reading:

- Read README promises, then provider queue, routing, fallback and telemetry paths.
- The paragraph to absorb: AI gateway is not a proxy; it understands provider capability, model route, fallback, errors, tokens and observability.

Go translation:

```go
func (e Executor) Execute(ctx context.Context, req core.ChatRequest, plan core.RoutePlan) (core.ChatResponse, error) {
	var lastErr error
	for i, route := range plan.Attempts {
		client, ok := e.registry.Client(route.Provider)
		if !ok {
			lastErr = core.GatewayError{Class: core.ErrorProviderUnavailable, Route: route, Err: core.ErrNoProvider}
			e.record(ctx, req, route, i, core.ChatResponse{}, lastErr)
			continue
		}

		resp, err := client.Chat(ctx, req.WithRoute(route))
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

- [`internal/gateway/fallback/executor_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor_test.go)
- [`internal/gateway/router/scoring_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/router/scoring_test.go)

### trpc-group/trpc-agent-go -> Agent Event / Tool / Graph

Source reading:

- Read agent abstraction, event model, runner and graph agent packages as one execution system.
- The paragraph to absorb: agent runtime is an evented workflow, not a single chat completion.

Go translation:

```go
func (r Runner) runTool(ctx context.Context, sessionID string, call ToolCall) error {
	_ = r.events.Append(ctx, sessionID, event.Event{
		Type:       event.ToolStarted,
		ToolCallID: call.ID,
		ToolName:   call.Name,
	})

	result, err := r.tools.Invoke(ctx, call.Name, call.Args)
	if err != nil {
		_ = r.events.Append(ctx, sessionID, event.Event{
			Type:       event.ToolFailed,
			ToolCallID: call.ID,
			Content:    err.Error(),
		})
		return err
	}

	return r.events.Append(ctx, sessionID, event.Event{
		Type:       event.ToolFinished,
		ToolCallID: call.ID,
		Content:    result,
	})
}
```

Graph translation:

```go
for step := 0; step < maxSteps; step++ {
	next, err := g.nodes[current].Run(ctx, state)
	if err != nil {
		return err
	}
	events.Append(NodeTransitioned(current, next.NodeID))
	current = next.NodeID
}
return ErrStepBudgetExceeded
```

Local proof:

- [`internal/agent/runner/runner_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner_test.go)
- [`internal/agent/graph/graph_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph_test.go)

### TykTechnologies/tyk -> Policy Pipeline And Analytics

Source reading:

- Read gateway middleware, rate limit and analytics paths as the mature API gateway baseline.
- The paragraph to absorb: auth, policy, quota and analytics are pipeline stages, not handler comments.

Go translation:

```go
func (s Service) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	policy, err := s.Policy.Authorize(ctx, req)
	if err != nil {
		return ChatResponse{}, err
	}
	if err := s.Limiter.Admit(ctx, req.TenantID, req.EstimatedTokens()); err != nil {
		return ChatResponse{}, err
	}
	plan, err := s.Router.Plan(ctx, req, policy)
	if err != nil {
		return ChatResponse{}, err
	}
	return s.Executor.Execute(ctx, req, plan)
}
```

Analytics translation:

```go
type RequestLog struct {
	RequestID     core.RequestID
	TenantID      core.TenantID
	Provider      core.ProviderName
	Model         core.ModelName
	FallbackIndex int
	InputTokens   int
	OutputTokens  int
	ErrorClass    core.ErrorClass
	CostMicros    int
}
```

Local proof:

- [`internal/gateway/policy/engine.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/engine.go)
- [`internal/gateway/audit/log_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/audit/log_test.go)

### cloudwego/hertz -> High-Concurrency HTTP Boundary

Source reading:

- Read engine, request context and middleware as high-performance transport infrastructure.
- The paragraph to absorb: business code should receive standard `context.Context` and decoded request data, not framework-owned request objects.

Go translation:

```go
type HandlerFunc func(ctx context.Context, req ChatRequest) (ChatResponse, error)

func AdaptHTTP(fn HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req, err := DecodeChatRequest(r)
		if err != nil {
			WriteError(w, err)
			return
		}
		resp, err := fn(r.Context(), req)
		WriteChatResponse(w, resp, err)
	}
}
```

Local proof:

- [`internal/gateway/httpapi/handler.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go)

### open-telemetry/opentelemetry-collector -> Telemetry Pipeline

Source reading:

- Read receiver/processor/exporter/component as a pipeline and lifecycle graph.
- The paragraph to absorb: telemetry is a system with backpressure and failure modes, not a direct synchronous log call.

Go translation:

```go
type AsyncExporter struct {
	queue chan Event
	next  Sink
}

func (e *AsyncExporter) Record(ctx context.Context, event Event) error {
	select {
	case e.queue <- event:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		e.dropped.Add(1)
		return ErrTelemetryQueueFull
	}
}
```

Local proof:

- [`internal/platform/telemetry/exporter_async_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async_test.go)

### temporalio/temporal -> Durable Event History

Source reading:

- Read history service, matching service and worker service as the durable execution triangle.
- The paragraph to absorb: if a workflow must survive crashes, save events/commands, not just final state.

Go translation:

```go
func Replay(events []Event) State {
	state := State{Status: StatusRunning, RunningTools: map[string]ToolCall{}}
	for _, event := range events {
		switch event.Type {
		case ToolStarted:
			state.RunningTools[event.ToolCallID] = ToolCall{ID: event.ToolCallID}
		case ToolFinished, ToolFailed:
			delete(state.RunningTools, event.ToolCallID)
		case RunCompleted:
			state.Status = StatusCompleted
		}
	}
	return state
}
```

Local proof:

- [`internal/agent/event/replay.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go)
- [`internal/platform/idempotency/store_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store_test.go)

### nats-io/nats-server -> Pub/Sub And Slow Consumer

Source reading:

- The fetched `client.go` shows explicit slow consumer state. Read subject/subscription matching and client delivery as a pressure system.
- The paragraph to absorb: slow consumers are a first-class failure mode, not an edge case.

Go translation:

```go
func (b *Bus) Publish(sessionID string, event event.Event) {
	b.mu.Lock()
	subscribers := append([]chan event.Event(nil), b.subscribers[sessionID]...)
	b.mu.Unlock()

	for _, subscriber := range subscribers {
		select {
		case subscriber <- event:
		default:
			b.dropped.Add(1)
		}
	}
}
```

Architecture transfer:

```text
subject -> session/topic
subscription -> client stream
slow consumer -> drop/disconnect/replay
JetStream -> durable event log
```

Local proof:

- [`internal/agent/stream/bus_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus_test.go)
- [`internal/agent/stream/replay_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/replay_test.go)

### study8677/awesome-architecture -> Architecture To Go Template

Source reading:

- Read templates as system maps: AI Gateway, Agent Platform, RAG, Inference Serving, Realtime Chat, Notification.
- The paragraph to absorb: architecture diagrams become useful only when translated into package boundaries, interfaces, tests and failure modes.

Go translation:

```text
AI Gateway:
  internal/gateway/httpapi
  internal/gateway/core
  internal/gateway/policy
  internal/gateway/router
  internal/gateway/provider
  internal/gateway/fallback

Agent Platform:
  internal/agent/event
  internal/agent/runner
  internal/agent/tool
  internal/agent/graph
  internal/agent/stream
```

Local proof:

- [`../../architecture_labs`](../../architecture_labs/README.md)
- [`../../capstone_ai_gateway_agent_runtime`](../../capstone_ai_gateway_agent_runtime/README.md)

## Closed Loop Summary

每个 source 的吸收标准：

```text
GitHub source
  -> source paragraph
  -> design pressure
  -> Go translation
  -> local package
  -> behavior test
  -> backlink into concept map
```

当前最强的闭环链路：

```text
go-kit endpoint middleware
  -> internal/gateway/core/endpoint.go
  -> TestEndpointMiddlewareWrapsServiceBoundary
  -> gateway policy/rate-limit/trace extension point
```

```text
Caddy config lifecycle
  -> internal/app/config.go
  -> TestConfigSwapRejectsUnknownProviderInTenantPolicy
  -> control-plane safety
```

```text
Bifrost fallback
  -> internal/gateway/fallback/executor.go
  -> TestGatewayFallbackRecordsTelemetry
  -> provider routing and observability
```

```text
trpc-agent-go + Temporal
  -> internal/agent/event + runner + graph
  -> replay/tool/interrupt tests
  -> durable agent runtime
```
