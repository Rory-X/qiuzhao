# Source To Capstone Knowledge Network

这份手册把所有已纳入的 GitHub 材料继续压实到最终 `AI Gateway + Agent Runtime` Capstone。它解决一个具体问题：读完一个仓库后，应该在本地写出哪个包、哪个接口、哪段测试，而不是只留下项目摘要。

读法：

```text
GitHub source
  -> source segment
  -> architecture concept
  -> Capstone package
  -> Go learning translation
  -> local proof test
```

Related:

- [`source-map.md`](source-map.md)
- [`project-deep-dive-index.md`](project-deep-dive-index.md)
- [`source-code-anchors-foundations.md`](source-code-anchors-foundations.md)
- [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)
- [`reference-implementations.md`](reference-implementations.md)
- [`capstone-implementation-manual.md`](capstone-implementation-manual.md)

## Capstone Package Map

```text
cmd/gateway
internal/app

internal/gateway/httpapi
internal/gateway/core
internal/gateway/policy
internal/gateway/router
internal/gateway/provider
internal/gateway/fallback

internal/agent/event
internal/agent/runner
internal/agent/tool
internal/agent/stream
internal/agent/graph

internal/platform/lifecycle
internal/platform/telemetry
internal/platform/idempotency
internal/platform/outbox
```

The package map is the learning target. Every source below should eventually prove itself by making one of these packages clearer, safer, more testable, or more observable.

## Phase 01: Language Sources To Runtime-Safe Code

### go101/go101 -> Type Boundaries

Local analysis:

- [`01_language_basics/github-project-analysis.md`](../../01_language_basics/github-project-analysis.md#go101go101)
- [`source-code-anchors-foundations.md#01-language-basics`](source-code-anchors-foundations.md#01-language-basics)

What this source contributes:

- method set literacy for pointer/value receiver decisions.
- interface value and nil-interface awareness for provider clients.
- slice/map/channel semantics for session state and queue code.
- generics restraint: use typed helpers only after the concrete shape is stable.

Capstone landing:

```text
internal/gateway/provider
internal/agent/event
internal/gateway/router
```

Learning translation:

```go
package provider

import "context"

type ChatClient interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type HTTPClient struct {
	name string
}

func (c *HTTPClient) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	return ChatResponse{Provider: c.name}, nil
}

var _ ChatClient = (*HTTPClient)(nil)
```

Why it matters:

```text
If Chat has a pointer receiver, only *HTTPClient implements ChatClient.
That is usually correct for clients with mutexes, caches, metrics, or connection pools.
```

Local proof:

```go
func TestProviderClientIsReplaceable(t *testing.T) {
	var client provider.ChatClient = provider.FakeSuccess{Content: "ok"}
	resp, err := client.Chat(context.Background(), provider.ChatRequest{Model: "gpt-demo"})
	if err != nil {
		t.Fatalf("chat: %v", err)
	}
	if resp.Content != "ok" {
		t.Fatalf("content: %q", resp.Content)
	}
}
```

Backlinks:

- [`concepts/architecture-boundaries.md`](concepts/architecture-boundaries.md)
- [`concepts/ai-gateway.md`](concepts/ai-gateway.md)

### quii/learn-go-with-tests -> Behavior-First Design

Local analysis:

- [`01_language_basics/github-project-analysis.md`](../../01_language_basics/github-project-analysis.md#quiilearn-go-with-tests)
- [`source-segments/language-segments.md`](source-segments/language-segments.md)

What this source contributes:

- test first forces the public behavior before implementation.
- fake dependencies make provider/model/tool code deterministic.
- table tests are the best first shape for fallback, policy and replay rules.
- `context.Context` is part of the API, not an afterthought.

Capstone landing:

```text
internal/gateway/core
internal/gateway/fallback
internal/agent/runner
internal/agent/tool
```

Learning translation:

```go
func TestFallbackPolicyByErrorClass(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"timeout", gateway.Error{Class: gateway.ErrorTimeout}, true},
		{"rate limited", gateway.Error{Class: gateway.ErrorRateLimited}, true},
		{"bad input", gateway.Error{Class: gateway.ErrorInvalidInput}, false},
		{"unauthorized", gateway.Error{Class: gateway.ErrorUnauthorized}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := fallback.CanTryNext(tt.err); got != tt.want {
				t.Fatalf("fallback: want %v got %v", tt.want, got)
			}
		})
	}
}
```

Local proof rule:

```text
No Capstone interface is accepted until it has at least one fake implementation and one failure-path test.
```

### mmcgrana/gobyexample -> Concurrency Building Blocks

Local analysis:

- [`01_language_basics/github-project-analysis.md`](../../01_language_basics/github-project-analysis.md#mmcgranagobyexample)
- [`concepts/concurrency-backpressure.md`](concepts/concurrency-backpressure.md)

What this source contributes:

- worker pool shape.
- rate limit shape.
- channel direction as API boundary.
- context cancellation around long-running work.

Capstone landing:

```text
internal/gateway/provider/queue.go
internal/agent/tool/executor.go
internal/agent/stream/bus.go
```

Learning translation:

```go
type ProviderQueue struct {
	jobs chan ProviderJob
}

func NewProviderQueue(capacity int) *ProviderQueue {
	if capacity < 1 {
		capacity = 1
	}
	return &ProviderQueue{jobs: make(chan ProviderJob, capacity)}
}

func (q *ProviderQueue) TrySubmit(ctx context.Context, job ProviderJob) error {
	select {
	case q.jobs <- job:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return ErrProviderQueueFull
	}
}
```

Local proof:

```go
func TestProviderQueueRejectsWhenFull(t *testing.T) {
	q := NewProviderQueue(1)
	if err := q.TrySubmit(context.Background(), ProviderJob{ID: "1"}); err != nil {
		t.Fatalf("submit first: %v", err)
	}
	if err := q.TrySubmit(context.Background(), ProviderJob{ID: "2"}); !errors.Is(err, ErrProviderQueueFull) {
		t.Fatalf("want queue full, got %v", err)
	}
}
```

### golang/example -> Standard HTTP And Small Services

Local analysis:

- [`01_language_basics/github-project-analysis.md`](../../01_language_basics/github-project-analysis.md#golangexample)

What this source contributes:

- standard library HTTP is enough for the first gateway boundary.
- small programs show `main`/handler separation.
- long-running examples introduce background goroutine and safe shared state.

Capstone landing:

```text
cmd/gateway
internal/gateway/httpapi
internal/platform/lifecycle
```

Learning translation:

```go
func RegisterRoutes(mux *http.ServeMux, h Handler) {
	mux.HandleFunc("POST /v1/chat/completions", h.Chat)
	mux.HandleFunc("GET /healthz", h.Health)
}

func (h Handler) Health(w http.ResponseWriter, r *http.Request) {
	if !h.readiness.Ready() {
		http.Error(w, "not ready", http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}
```

Proof:

```go
func TestHealthReturnsOKWhenReady(t *testing.T) {
	h := NewHandler(fakeGateway{}, readiness.AlwaysReady{})
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	h.Health(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d", rec.Code)
	}
}
```

### inancgumus/learngo -> Practice Volume And Named Domain Types

Local analysis:

- [`01_language_basics/github-project-analysis.md`](../../01_language_basics/github-project-analysis.md#inancgumuslearngo)

What this source contributes:

- repeated syntax and type exercises.
- receiver methods and domain-specific named types.
- interface drills before large abstractions.

Capstone landing:

```text
internal/agent/event
internal/gateway/core/types.go
```

Learning translation:

```go
type EventType string

const (
	UserMessage      EventType = "user_message"
	AssistantMessage EventType = "assistant_message"
	ToolStarted      EventType = "tool_started"
	ToolFinished     EventType = "tool_finished"
	ToolFailed       EventType = "tool_failed"
)

func (t EventType) IsTerminalToolEvent() bool {
	return t == ToolFinished || t == ToolFailed
}
```

Local proof:

```go
func TestToolEventClassification(t *testing.T) {
	if !ToolFailed.IsTerminalToolEvent() {
		t.Fatal("tool failure should be terminal for a tool call")
	}
	if UserMessage.IsTerminalToolEvent() {
		t.Fatal("user message is not a tool terminal event")
	}
}
```

## Phase 02: Structure And Style Sources To Package Discipline

### golang-standards/project-layout -> Intentional Directories

Local analysis:

- [`02_project_structure/github-project-analysis.md`](../../02_project_structure/github-project-analysis.md#golang-standardsproject-layout)

What this source contributes:

- `cmd` is a composition root.
- `internal` is a compiler-enforced boundary.
- `pkg` is a public promise; avoid it until there is a real external API.
- `api` contains contracts, not business logic.

Capstone landing:

```text
cmd/gateway/main.go
internal/*
```

Learning translation:

```go
func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := LoadConfig()
	if err != nil {
		logger.Error("load config", "err", err)
		os.Exit(1)
	}

	app, err := BuildApp(cfg, logger)
	if err != nil {
		logger.Error("build app", "err", err)
		os.Exit(1)
	}

	if err := app.Run(lifecycle.RootContext()); err != nil {
		logger.Error("run", "err", err)
		os.Exit(1)
	}
}
```

Directory rule:

```text
cmd/gateway may wire dependencies.
internal/gateway/core may know gateway policy and router interfaces.
internal/gateway/httpapi may know HTTP.
internal/agent/runner may know model/tool interfaces.
internal/platform may know process lifecycle and telemetry plumbing.
```

### uber-go/guide -> Error, Copy And Goroutine Hygiene

Local analysis:

- [`02_project_structure/github-project-analysis.md`](../../02_project_structure/github-project-analysis.md#uber-goguide)

What this source contributes:

- wrap errors with context and preserve `errors.Is` / `errors.As`.
- copy slices/maps crossing boundaries.
- channel capacity is a design decision.
- goroutines need an exit path.

Capstone landing:

```text
internal/gateway/core/errors.go
internal/agent/event/store.go
internal/platform/telemetry/exporter_async.go
```

Learning translation:

```go
type GatewayError struct {
	Class ErrorClass
	Route Route
	Err   error
}

func (e GatewayError) Error() string {
	return fmt.Sprintf("%s %s/%s: %v", e.Class, e.Route.Provider, e.Route.Model, e.Err)
}

func (e GatewayError) Unwrap() error {
	return e.Err
}

func ErrorClassOf(err error) ErrorClass {
	var gatewayErr GatewayError
	if errors.As(err, &gatewayErr) {
		return gatewayErr.Class
	}
	return ErrorUnknown
}
```

Proof:

```go
func TestGatewayErrorSupportsErrorsAs(t *testing.T) {
	err := fmt.Errorf("call provider: %w", GatewayError{Class: ErrorTimeout, Err: context.DeadlineExceeded})

	var got GatewayError
	if !errors.As(err, &got) {
		t.Fatal("expected GatewayError")
	}
	if got.Class != ErrorTimeout {
		t.Fatalf("class: %s", got.Class)
	}
}
```

### google/styleguide Go -> Small Consumer Interfaces

Local analysis:

- [`02_project_structure/github-project-analysis.md`](../../02_project_structure/github-project-analysis.md#googlestyleguide-go)

What this source contributes:

- clarity beats cleverness.
- interfaces are often best defined by consumers.
- names should explain domain intent.

Capstone landing:

```text
internal/gateway/httpapi
internal/agent/runner
```

Learning translation:

```go
package httpapi

type ChatService interface {
	Chat(ctx context.Context, req gateway.ChatRequest) (gateway.ChatResponse, error)
}

type Handler struct {
	chat ChatService
}
```

Why not a giant interface:

```go
// Avoid at the HTTP layer:
type ProviderPlatform interface {
	Chat(context.Context, ChatRequest) (ChatResponse, error)
	Embeddings(context.Context, EmbeddingRequest) (EmbeddingResponse, error)
	Images(context.Context, ImageRequest) (ImageResponse, error)
	Health(context.Context) error
	Pricing(context.Context) (Pricing, error)
}
```

### sagikazarmark/modern-go-application -> Production Startup Surface

Local analysis:

- [`02_project_structure/github-project-analysis.md`](../../02_project_structure/github-project-analysis.md#sagikazarmarkmodern-go-application)

What this source contributes:

- config, logging, telemetry, health and server lifecycle belong in the startup surface.
- platform dependencies should be separate from business use cases.
- production apps usually run more than one component.

Capstone landing:

```text
cmd/gateway/wire.go
internal/platform/lifecycle
internal/platform/telemetry
```

Learning translation:

```go
type Component interface {
	Name() string
	Start(ctx context.Context) error
	Shutdown(ctx context.Context) error
}

type App struct {
	components []Component
}

func (a App) Run(ctx context.Context) error {
	group, ctx := errgroup.WithContext(ctx)
	for _, component := range a.components {
		c := component
		group.Go(func() error { return c.Start(ctx) })
	}
	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	for i := len(a.components) - 1; i >= 0; i-- {
		_ = a.components[i].Shutdown(shutdownCtx)
	}
	return group.Wait()
}
```

## Phase 03: Architecture Pattern Sources To Business Boundaries

### ThreeDotsLabs/wild-workouts-go-ddd-example -> State Changes Behind Methods

Local analysis:

- [`03_architecture_patterns/github-project-analysis.md`](../../03_architecture_patterns/github-project-analysis.md#threedotslabswild-workouts-go-ddd-example)

What this source contributes:

- domain objects protect invariants.
- command handlers call repositories and domain methods.
- repository update closures keep read-modify-write safe.

Capstone landing:

```text
internal/agent/event
internal/agent/runner
```

Learning translation:

```go
type Session struct {
	id     string
	status Status
	events []Event
}

func (s *Session) StartTool(call ToolCall) error {
	if s.status == StatusCompleted || s.status == StatusFailed {
		return ErrSessionClosed
	}
	if call.ID == "" || call.Name == "" {
		return ErrInvalidToolCall
	}
	s.events = append(s.events, Event{
		Type:       ToolStarted,
		ToolCallID: call.ID,
		ToolName:   call.Name,
	})
	return nil
}
```

Proof:

```go
func TestClosedSessionRejectsToolStart(t *testing.T) {
	s := NewSession("s1")
	s.Complete()
	err := s.StartTool(ToolCall{ID: "tool-1", Name: "search"})
	if !errors.Is(err, ErrSessionClosed) {
		t.Fatalf("want closed session, got %v", err)
	}
}
```

### amitshekhariitbhu/go-backend-clean-architecture -> Controller/Usecase/Repository

Local analysis:

- [`03_architecture_patterns/github-project-analysis.md`](../../03_architecture_patterns/github-project-analysis.md#amitshekhariitbhugo-backend-clean-architecture)

What this source contributes:

- HTTP controller should not own business rules.
- usecase can enforce timeout.
- repository hides storage mechanics.

Capstone landing:

```text
internal/gateway/httpapi
internal/gateway/core
internal/agent/event
```

Learning translation:

```go
func (h Handler) Chat(w http.ResponseWriter, r *http.Request) {
	req, err := DecodeChatRequest(r)
	if err != nil {
		WriteError(w, err)
		return
	}

	resp, err := h.service.Chat(r.Context(), req)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, resp)
}
```

Usecase timeout:

```go
func (s Service) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	return s.executeRoutePlan(ctx, req)
}
```

### evrone/go-clean-template -> Multi-Transport Usecases And State Machines

Local analysis:

- [`03_architecture_patterns/github-project-analysis.md`](../../03_architecture_patterns/github-project-analysis.md#evronego-clean-template)

What this source contributes:

- same usecase can serve REST, gRPC, worker or CLI.
- entities carry state transitions.
- repositories are adapters, not the center of the design.

Capstone landing:

```text
internal/agent/tool
internal/agent/runner
internal/gateway/core
```

Learning translation:

```go
func (c *ToolCall) Transition(next ToolStatus) error {
	switch c.Status {
	case ToolPending:
		if next != ToolRunning && next != ToolFailed {
			return ErrInvalidTransition
		}
	case ToolRunning:
		if next != ToolSucceeded && next != ToolFailed {
			return ErrInvalidTransition
		}
	case ToolSucceeded, ToolFailed:
		return ErrTerminalState
	}
	c.Status = next
	return nil
}
```

Proof:

```go
func TestToolCallCannotLeaveTerminalState(t *testing.T) {
	call := ToolCall{Status: ToolSucceeded}
	err := call.Transition(ToolRunning)
	if !errors.Is(err, ErrTerminalState) {
		t.Fatalf("want terminal state, got %v", err)
	}
}
```

### go-kit/examples -> Endpoint Middleware

Local analysis:

- [`03_architecture_patterns/github-project-analysis.md`](../../03_architecture_patterns/github-project-analysis.md#go-kitexamples)

What this source contributes:

- service, endpoint and transport are separate.
- cross-cutting behavior wraps endpoint.
- middleware order is explicit and testable.

Capstone landing:

```text
internal/gateway/core
internal/gateway/core/endpoint.go
internal/gateway/httpapi
internal/platform/telemetry
```

Learning translation:

```go
type Endpoint func(ctx context.Context, req ChatRequest) (ChatResponse, error)

func WithTelemetry(sink TelemetrySink, next Endpoint) Endpoint {
	return func(ctx context.Context, req ChatRequest) (ChatResponse, error) {
		start := time.Now()
		resp, err := next(ctx, req)
		sink.Record(ctx, TelemetryEvent{
			Name:      "gateway.chat",
			TenantID:  req.TenantID,
			Model:     req.Model,
			LatencyMS: time.Since(start).Milliseconds(),
			ErrorClass: ErrorClassOf(err),
		})
		return resp, err
	}
}
```

Local proof:

```text
TestEndpointMiddlewareWrapsServiceBoundary
TestEndpointMiddlewareCanShortCircuitBeforeProviderCall
```

## Phase 04: Real Project Sources To Long-Running Product Shape

### pocketbase/pocketbase -> Single Binary And Hooks

Local analysis:

- [`04_real_projects/github-project-analysis.md`](../../04_real_projects/github-project-analysis.md#pocketbasepocketbase)

What this source contributes:

- a product backend can begin as one binary.
- stable core with hooks is easier to evolve than scattered extension code.
- admin API and business API should be separated.

Capstone landing:

```text
internal/gateway/provider
internal/gateway/httpapi
```

Learning translation:

```go
type ProviderHook func(ctx context.Context, event ProviderEvent) error

type ProviderPipeline struct {
	client ChatClient
	hooks  []ProviderHook
}

func (p ProviderPipeline) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	resp, err := p.client.Chat(ctx, req)
	event := ProviderEvent{Request: req, Response: resp, Err: err}
	for _, hook := range p.hooks {
		if hookErr := hook(ctx, event); hookErr != nil {
			// Hooks are observability/extension points; they do not rewrite provider result here.
			continue
		}
	}
	return resp, err
}
```

### usememos/memos -> Main Path Plus Best-Effort Side Effects

Local analysis:

- [`04_real_projects/github-project-analysis.md`](../../04_real_projects/github-project-analysis.md#usememosmemos)

What this source contributes:

- product server combines HTTP, static assets, API, runners and graceful shutdown.
- write path often has side effects such as webhook, broadcast, notification.
- side effects need explicit reliability classification.

Capstone landing:

```text
internal/agent/event
internal/agent/stream
internal/platform/lifecycle
```

Learning translation:

```go
func (s Service) AppendUserMessage(ctx context.Context, sessionID string, content string) error {
	event := Event{
		SessionID: sessionID,
		Type:      UserMessage,
		Content:   content,
	}
	if err := s.store.Append(ctx, sessionID, event); err != nil {
		return err
	}
	if err := s.stream.Publish(ctx, sessionID, event); err != nil {
		s.logger.Warn("publish agent event", "session_id", sessionID, "err", err)
	}
	return nil
}
```

Reliability rule:

```text
Event store append is the main path.
SSE publish is best effort unless the product explicitly promises real-time delivery.
```

### caddyserver/caddy -> Module Lifecycle And Dynamic Config

Local analysis:

- [`04_real_projects/github-project-analysis.md`](../../04_real_projects/github-project-analysis.md#caddyservercaddy)

What this source contributes:

- modules have identity, config, validation and lifecycle.
- dynamic config requires a clear load/stop boundary.
- admin/control plane must be isolated from data plane.

Capstone landing:

```text
internal/app/config.go
internal/gateway/provider/registry.go
internal/platform/lifecycle
```

Learning translation:

```go
type ProviderModule interface {
	ID() string
	Validate() error
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	Client() ChatClient
}

type Registry struct {
	mu       sync.RWMutex
	modules  map[string]ProviderModule
}

func (r *Registry) Replace(ctx context.Context, name string, next ProviderModule) error {
	if err := next.Validate(); err != nil {
		return err
	}
	if err := next.Start(ctx); err != nil {
		return err
	}
	r.mu.Lock()
	old := r.modules[name]
	r.modules[name] = next
	r.mu.Unlock()
	if old != nil {
		_ = old.Stop(ctx)
	}
	return nil
}
```

Local proof:

```text
TestConfigSwapRejectsUnknownProviderInTenantPolicy
TestConfigSwapRecordsAuditEvent
TestConfigRollbackRestoresPriorVersionAsNewVersion
TestGracefulDrainStopsIngressBeforeWorkers
```

### syncthing/syncthing -> Goals, Protocols And Long-Running State

Local analysis:

- [`04_real_projects/github-project-analysis.md`](../../04_real_projects/github-project-analysis.md#syncthingsyncthing)

What this source contributes:

- write explicit goals before optimizing mechanics.
- protocol boundary should outlive implementation details.
- long-running systems need lifecycle, locking, stats and safe shutdown.

Capstone landing:

```text
internal/agent/event
internal/agent/stream
internal/platform/lifecycle
```

Learning translation:

```go
type AgentEventEnvelope struct {
	Version   string          `json:"version"`
	ID        string          `json:"id"`
	SessionID string          `json:"session_id"`
	Type      EventType       `json:"type"`
	Payload   json.RawMessage `json:"payload"`
}

func DecodeEnvelope(data []byte) (AgentEventEnvelope, error) {
	var event AgentEventEnvelope
	if err := json.Unmarshal(data, &event); err != nil {
		return AgentEventEnvelope{}, err
	}
	if event.Version == "" || event.ID == "" || event.SessionID == "" {
		return AgentEventEnvelope{}, ErrInvalidEventEnvelope
	}
	return event, nil
}
```

Product goal order:

```text
1. Do not lose persisted agent events.
2. Do not allow unbounded provider/tool concurrency.
3. Preserve tenant and model observability dimensions.
4. Prefer graceful degradation over cascading failure.
5. Optimize latency after the safety gates are visible.
```

## Phase 05: Large System Sources To Production Mechanisms

### maximhq/bifrost -> Provider Routing, Queue And Fallback

Local analysis:

- [`05_large_systems/github-project-analysis.md`](../../05_large_systems/github-project-analysis.md#maximhqbifrost)
- [`source-code-anchors-advanced.md#1-bifrost-provider-queue-fallback-and-plugin-pipeline`](source-code-anchors-advanced.md#1-bifrost-provider-queue-fallback-and-plugin-pipeline)

What this source contributes:

- provider registry and runtime are first-class.
- queue/backpressure is part of provider safety.
- fallback is policy-driven and observable.
- provider attempts need telemetry dimensions.

Capstone landing:

```text
internal/gateway/router
internal/gateway/provider
internal/gateway/fallback
internal/platform/telemetry
```

Learning translation:

```go
func (e Executor) Execute(ctx context.Context, req ChatRequest, plan RoutePlan) (ChatResponse, error) {
	var lastErr error
	for i, route := range plan.Attempts {
		resp, err := e.registry.Client(route.Provider).Chat(ctx, req.WithRoute(route))
		e.telemetry.Record(ctx, TelemetryEvent{
			Name:          "gateway.provider_attempt",
			TenantID:      req.TenantID,
			Model:         route.Model,
			Provider:      route.Provider,
			FallbackIndex: i,
			ErrorClass:    ErrorClassOf(err),
		})
		if err == nil {
			return resp, nil
		}
		lastErr = err
		if !CanFallback(err) {
			break
		}
	}
	return ChatResponse{}, lastErr
}
```

Proof:

```go
func TestExecutorRecordsEveryProviderAttempt(t *testing.T) {
	telemetry := telemetry.NewMemoryExporter()
	executor := NewExecutor(registryWithTimeoutThenSuccess(), telemetry)

	_, err := executor.Execute(context.Background(), validChat(), RoutePlan{
		Attempts: []Route{
			{Provider: "primary", Model: "gpt-demo"},
			{Provider: "backup", Model: "gpt-demo"},
		},
	})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	telemetry.Assert(t, "gateway.provider_attempt", map[string]string{"provider": "primary"})
	telemetry.Assert(t, "gateway.provider_attempt", map[string]string{"provider": "backup"})
}
```

### trpc-group/trpc-agent-go -> Agent, Runner, Event, Tool And Graph

Local analysis:

- [`05_large_systems/github-project-analysis.md`](../../05_large_systems/github-project-analysis.md#trpc-grouptrpc-agent-go)
- [`source-code-anchors-advanced.md#2-trpc-agent-go-event-as-agent-runtime-fact`](source-code-anchors-advanced.md#2-trpc-agent-go-event-as-agent-runtime-fact)

What this source contributes:

- agent execution is a sequence of events and decisions.
- tool call and tool result belong in the timeline.
- graph agents need explicit node/edge representation.

Capstone landing:

```text
internal/agent/runner
internal/agent/tool
internal/agent/event
internal/agent/graph
```

Learning translation:

```go
func (r Runner) Run(ctx context.Context, sessionID string, input string) error {
	if err := r.events.Append(ctx, sessionID, Event{Type: UserMessage, Content: input}); err != nil {
		return err
	}

	for step := 0; step < r.maxSteps; step++ {
		state, err := r.events.Replay(ctx, sessionID)
		if err != nil {
			return err
		}
		cmd, err := r.model.Next(ctx, state)
		if err != nil {
			return err
		}
		if err := r.applyCommand(ctx, sessionID, cmd); err != nil {
			return err
		}
		if cmd.Type == CommandAnswer {
			return r.events.Append(ctx, sessionID, Event{Type: RunCompleted})
		}
	}
	return ErrStepBudgetExceeded
}
```

Proof:

```go
func TestRunnerPersistsToolTimeline(t *testing.T) {
	store := event.NewMemoryStore()
	runner := NewRunner(store, scriptedToolModel(), fakeToolRegistry())

	if err := runner.Run(context.Background(), "s1", "search docs"); err != nil {
		t.Fatalf("run: %v", err)
	}
	events, _ := store.List(context.Background(), "s1")
	assertEventTypes(t, events, UserMessage, ToolStarted, ToolFinished, AssistantMessage, RunCompleted)
}
```

Graph proof:

```go
func TestGraphRecordsHumanInterrupt(t *testing.T) {
	store := event.NewMemoryStore()
	graph := graph.New(store, map[string]graph.Node{
		"approval": graph.NodeFunc(func(ctx context.Context, state event.State) (graph.Result, error) {
			return graph.Result{Interrupt: true, Reason: "needs human approval"}, nil
		}),
	})

	err := graph.Execute(context.Background(), "session-1", "approval")
	if !errors.Is(err, graph.ErrInterrupted) {
		t.Fatalf("want interrupt, got %v", err)
	}
}
```

### TykTechnologies/tyk -> API Gateway Policy Pipeline

Local analysis:

- [`05_large_systems/github-project-analysis.md`](../../05_large_systems/github-project-analysis.md#tyktechnologiestyk)
- [`source-code-anchors-advanced.md#3-tyk-rate-limit-and-quota-are-gateway-middleware`](source-code-anchors-advanced.md#3-tyk-rate-limit-and-quota-are-gateway-middleware)

What this source contributes:

- auth, quota, policy and analytics are gateway pipeline concerns.
- request identity must be established before routing.
- analytics should survive provider failures.

Capstone landing:

```text
internal/gateway/httpapi/middleware.go
internal/gateway/policy
internal/platform/telemetry
```

Learning translation:

```go
func WithTenantPolicy(engine PolicyEngine, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := TenantID(r.Header.Get("X-Tenant-ID"))
		policy, err := engine.PolicyFor(r.Context(), tenantID)
		if err != nil {
			WriteError(w, err)
			return
		}
		ctx := context.WithValue(r.Context(), tenantPolicyKey{}, policy)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
```

### cloudwego/hertz -> High-Performance HTTP Boundary

Local analysis:

- [`05_large_systems/github-project-analysis.md`](../../05_large_systems/github-project-analysis.md#cloudwegohertz)
- [`source-code-anchors-advanced.md#4-hertz-engine-lifecycle-and-transport-boundary`](source-code-anchors-advanced.md#4-hertz-engine-lifecycle-and-transport-boundary)

What this source contributes:

- HTTP framework context is not the business context.
- middleware order is part of performance and correctness.
- server start/shutdown hooks matter.

Capstone landing:

```text
internal/gateway/httpapi
internal/platform/lifecycle
```

Learning translation:

```go
type HTTPAdapter struct {
	service ChatService
}

func (a HTTPAdapter) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	req, err := DecodeChatRequest(r)
	if err != nil {
		WriteError(w, err)
		return
	}
	resp, err := a.service.Chat(ctx, req)
	EncodeChatResponse(w, resp, err)
}
```

Framework migration rule:

```text
The business package accepts context.Context and domain request structs.
Only the adapter package knows net/http, Hertz or any other framework context.
```

### open-telemetry/opentelemetry-collector -> Telemetry Pipeline

Local analysis:

- [`05_large_systems/github-project-analysis.md`](../../05_large_systems/github-project-analysis.md#open-telemetryopentelemetry-collector)
- [`source-code-anchors-advanced.md#5-opentelemetry-collector-graph-component-lifecycle-and-export-queue`](source-code-anchors-advanced.md#5-opentelemetry-collector-graph-component-lifecycle-and-export-queue)

What this source contributes:

- observability has component boundaries: receiver, processor, exporter.
- async queues protect the main path.
- dropped telemetry is itself a metric.

Capstone landing:

```text
internal/platform/telemetry
```

Learning translation:

```go
type Processor interface {
	Process(ctx context.Context, event TelemetryEvent) (TelemetryEvent, error)
}

type Exporter interface {
	Export(ctx context.Context, event TelemetryEvent) error
}

type Pipeline struct {
	processors []Processor
	exporter   Exporter
}

func (p Pipeline) Record(ctx context.Context, event TelemetryEvent) error {
	var err error
	for _, processor := range p.processors {
		event, err = processor.Process(ctx, event)
		if err != nil {
			return err
		}
	}
	return p.exporter.Export(ctx, event)
}
```

Proof:

```go
func TestTelemetryRedactsAPIKeyBeforeExport(t *testing.T) {
	exporter := NewMemoryExporter()
	pipeline := Pipeline{
		processors: []Processor{RedactKeys{}},
		exporter:   exporter,
	}
	_ = pipeline.Record(context.Background(), TelemetryEvent{APIKey: "secret"})

	events := exporter.Events()
	if events[0].APIKey != "[redacted]" {
		t.Fatalf("api key leaked: %q", events[0].APIKey)
	}
}
```

### temporalio/temporal -> Durable History And Replay

Local analysis:

- [`05_large_systems/github-project-analysis.md`](../../05_large_systems/github-project-analysis.md#temporaliotemporal)
- [`source-code-anchors-advanced.md#6-temporal-mutable-state-command-validation-and-matching`](source-code-anchors-advanced.md#6-temporal-mutable-state-command-validation-and-matching)

What this source contributes:

- durable systems replay history into current state.
- command validation prevents impossible transitions.
- workers and task queues decouple scheduling from execution.

Capstone landing:

```text
internal/agent/event
internal/agent/runner
```

Learning translation:

```go
func Replay(events []Event) State {
	state := State{RunningTools: map[string]ToolCall{}}
	for _, event := range events {
		switch event.Type {
		case UserMessage:
			state.Messages = append(state.Messages, Message{Role: "user", Content: event.Content})
		case ToolStarted:
			state.RunningTools[event.ToolCallID] = ToolCall{ID: event.ToolCallID, Name: event.ToolName}
		case ToolFinished, ToolFailed:
			delete(state.RunningTools, event.ToolCallID)
		case AssistantMessage:
			state.Messages = append(state.Messages, Message{Role: "assistant", Content: event.Content})
		case RunCompleted:
			state.Status = StatusCompleted
		}
	}
	return state
}
```

Proof:

```go
func TestReplayClearsFailedTool(t *testing.T) {
	state := Replay([]Event{
		{Type: ToolStarted, ToolCallID: "tool-1"},
		{Type: ToolFailed, ToolCallID: "tool-1"},
	})
	if len(state.RunningTools) != 0 {
		t.Fatalf("running tools: %+v", state.RunningTools)
	}
}
```

### nats-io/nats-server -> Pub/Sub, Fan-Out And Slow Consumers

Local analysis:

- [`05_large_systems/github-project-analysis.md`](../../05_large_systems/github-project-analysis.md#nats-ionats-server)
- [`source-code-anchors-advanced.md#7-nats-server-slow-consumer-is-a-first-class-failure-mode`](source-code-anchors-advanced.md#7-nats-server-slow-consumer-is-a-first-class-failure-mode)

What this source contributes:

- subject-based routing.
- subscription fan-out.
- slow consumer policy.
- durable stream thinking for replay and recovery.

Capstone landing:

```text
internal/agent/stream
internal/gateway/provider/queue.go
```

Learning translation:

```go
type Bus struct {
	mu   sync.RWMutex
	subs map[string][]chan Event
}

func (b *Bus) Subscribe(sessionID string, capacity int) <-chan Event {
	ch := make(chan Event, capacity)
	b.mu.Lock()
	b.subs[sessionID] = append(b.subs[sessionID], ch)
	b.mu.Unlock()
	return ch
}

func (b *Bus) Publish(sessionID string, event Event) {
	b.mu.RLock()
	subs := append([]chan Event(nil), b.subs[sessionID]...)
	b.mu.RUnlock()

	for _, sub := range subs {
		select {
		case sub <- event:
		default:
			// Slow consumer policy: drop live stream event, keep durable store as source of truth.
		}
	}
}
```

Proof:

```go
func TestBusDoesNotBlockOnSlowSubscriber(t *testing.T) {
	bus := NewBus()
	slow := bus.Subscribe("s1", 1)
	bus.Publish("s1", Event{ID: "1"})
	bus.Publish("s1", Event{ID: "2"})

	select {
	case <-slow:
	case <-time.After(time.Second):
		t.Fatal("publish blocked behind slow subscriber")
	}
}
```

### study8677/awesome-architecture -> System Templates To Go Packages

Local analysis:

- [`05_large_systems/github-project-analysis.md`](../../05_large_systems/github-project-analysis.md#study8677awesome-architecture)
- [`../architecture-to-go/README.md`](../architecture-to-go/README.md)

What this source contributes:

- architecture topic map for AI gateway, agent platform, RAG, inference, realtime and notification.
- system templates that should be translated into Go packages, not copied as diagrams.
- high-level vocabulary for the final learning route.

Capstone landing:

```text
all Capstone packages
architecture_labs/*
```

Template-to-package translation:

| Template | Local lab | Capstone package |
|---|---|---|
| AI Gateway | `architecture_labs/gateway` | `internal/gateway/*` |
| AI Agent Platform | `architecture_labs/agent` | `internal/agent/*` |
| RAG Knowledge Base | `architecture_labs/rag` | `capstone_ai_gateway_agent_runtime/internal/agent/tool/rag.go` |
| Inference Serving | `architecture_labs/inference` | `internal/gateway/provider/queue.go` |
| Realtime Chat | `architecture_labs/realtime` | `capstone_ai_gateway_agent_runtime/internal/agent/stream` |
| Notification System | `architecture_labs/notification` | future async side-effect pipeline |

Learning translation:

```go
type Capstone struct {
	Gateway GatewayService
	Agent   AgentRunner
	Stream  EventBus
	Metrics TelemetrySink
}

func (c Capstone) ChatThenRunAgent(ctx context.Context, req ChatRequest) error {
	resp, err := c.Gateway.Chat(ctx, req)
	if err != nil {
		return err
	}
	return c.Agent.Run(ctx, req.SessionID, resp.Content)
}
```

## Cross-Source Patterns

### Pattern 1: Request Path

Sources:

```text
golang/example -> net/http boundary
go-kit/examples -> endpoint middleware
Tyk -> policy pipeline
Bifrost -> route/fallback
OpenTelemetry Collector -> telemetry pipeline
```

Capstone path:

```text
cmd/gateway
  -> app.BuildDemo
  -> httpapi.Handler
  -> policy.Engine
  -> core.Service
  -> router.Planner
  -> fallback.Executor
  -> provider.Client
  -> telemetry.Pipeline
```

Code skeleton:

```go
func (s Service) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	policy, err := s.policies.Check(ctx, req.TenantID, req.Model)
	if err != nil {
		return ChatResponse{}, err
	}
	if err := s.limiter.Admit(ctx, policy, req.EstimatedTokens()); err != nil {
		return ChatResponse{}, err
	}
	plan, err := s.router.Plan(ctx, req, policy)
	if err != nil {
		return ChatResponse{}, err
	}
	return s.fallback.Execute(ctx, req, plan)
}
```

Local proof:

```text
capstone_ai_gateway_agent_runtime/internal/app
  -> TestDemoChatCompletionFallsBackAndRecordsProof
```

### Pattern 2: Agent Event Path

Sources:

```text
learn-go-with-tests -> fake model/tool tests
Wild Workouts -> domain methods
trpc-agent-go -> runner/tool/event
Temporal -> replay
Memos -> stream side effects
NATS -> slow consumer policy
```

Capstone path:

```text
runner.Run
  -> event.Store.Append(UserMessage)
  -> model.Next
  -> tool.Executor.Invoke
  -> event.Store.Append(ToolFinished/ToolFailed)
  -> stream.Bus.Publish
  -> event.Replay
```

Code skeleton:

```go
func (r Runner) applyCommand(ctx context.Context, sessionID string, cmd Command) error {
	switch cmd.Type {
	case CommandCallTool:
		if err := r.events.Append(ctx, sessionID, ToolStartedEvent(cmd.ToolCall)); err != nil {
			return err
		}
		result, err := r.tools.Invoke(ctx, cmd.ToolCall)
		if err != nil {
			_ = r.events.Append(ctx, sessionID, ToolFailedEvent(cmd.ToolCall.ID, err))
			return err
		}
		return r.events.Append(ctx, sessionID, ToolFinishedEvent(cmd.ToolCall.ID, result))
	case CommandAnswer:
		if err := r.events.Append(ctx, sessionID, AssistantMessageEvent(cmd.Text)); err != nil {
			return err
		}
		return r.events.Append(ctx, sessionID, Event{Type: RunCompleted})
	default:
		return ErrUnknownCommand
	}
}
```

### Pattern 3: High Availability Path

Sources:

```text
modern-go-application -> app composition
Caddy -> module lifecycle
Hertz -> server hooks
NATS -> slow consumer
OpenTelemetry Collector -> async exporter
Syncthing -> safety goals
```

Capstone path:

```text
lifecycle.App
  -> http.Server
  -> provider registry
  -> config store
  -> background health checks
  -> telemetry async exporter
  -> graceful shutdown and drain order
```

Code skeleton:

```go
func ShutdownAll(ctx context.Context, components []Component) error {
	var errs []error
	for i := len(components) - 1; i >= 0; i-- {
		if err := components[i].Shutdown(ctx); err != nil {
			errs = append(errs, fmt.Errorf("%s shutdown: %w", components[i].Name(), err))
		}
	}
	return errors.Join(errs...)
}
```

## Completion Checklist For A Source

Mark a GitHub source as fully absorbed only when all five items are true:

```text
1. It has a source snapshot and read anchors.
2. It has at least one segment or source-code anchor.
3. It maps to a concept page and one Capstone package.
4. It has a learning-version Go code block.
5. It has a local proof test or an explicit acceptance test target.
```

Current proof files:

- Phase docs: `01-05/*/github-project-analysis.md`
- Segment cards: [`source-segments/README.md`](source-segments/README.md)
- Source anchors: [`source-code-anchors-foundations.md`](source-code-anchors-foundations.md), [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)
- Code templates and crosswalks: [`go-code-patterns.md`](go-code-patterns.md), [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md), [`reference-implementations.md`](reference-implementations.md), [`capstone-implementation-manual.md`](capstone-implementation-manual.md)
- Local tests: `architecture_labs/*`, `api_service/*`, [`../../capstone_ai_gateway_agent_runtime`](../../capstone_ai_gateway_agent_runtime/README.md), including audit log, retry budget and idempotency tests.
