# Capstone Implementation Manual

这份手册把前面的知识网络收束成一个最终练习项目：`AI Gateway + Agent Runtime`。它不是又一份概念图，而是按包、文件、接口、测试和验收顺序组织的实施说明。

目标系统：

```text
OpenAI-compatible gateway
  -> tenant policy / quota / token budget
  -> provider route plan / queue / fallback
  -> agent session / event store / tool call / graph
  -> RAG tool / streaming event bus
  -> telemetry pipeline / readiness / graceful shutdown
```

Source backlinks:

- Foundations: [`source-code-anchors-foundations.md`](source-code-anchors-foundations.md)
- Advanced systems: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)
- Source to Capstone network: [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)
- Reference snippets: [`reference-implementations.md`](reference-implementations.md)
- Flow blueprints: [`system-blueprints.md`](system-blueprints.md)
- Readiness: [`production-readiness-checklist.md`](production-readiness-checklist.md)

Real local implementation:

- Module: [`../../capstone_ai_gateway_agent_runtime/README.md`](../../capstone_ai_gateway_agent_runtime/README.md)
- Walkthrough: [`local-labs/capstone-lab.md`](local-labs/capstone-lab.md)
- Acceptance command:

```bash
cd capstone_ai_gateway_agent_runtime
go test ./...
```

## 1. Repository Shape

Use this shape when you create or extend the capstone project. The current local module already implements the first working slice under [`../../capstone_ai_gateway_agent_runtime`](../../capstone_ai_gateway_agent_runtime/README.md):

```text
cmd/gateway/
  main.go
  wire.go

internal/app/
  demo.go

internal/gateway/httpapi/
  handler.go
  middleware.go
  errors.go
  stream.go

internal/gateway/core/
  service.go
  types.go
  errors.go

internal/gateway/policy/
  engine.go
  memory_store.go
  limiter.go

internal/gateway/router/
  planner.go
  health.go
  route.go

internal/gateway/provider/
  client.go
  fake.go
  registry.go
  queue.go
  breaker.go

internal/gateway/fallback/
  executor.go
  taxonomy.go

internal/agent/event/
  event.go
  store.go
  replay.go

internal/agent/runner/
  runner.go
  model.go
  command.go

internal/agent/graph/
  graph.go

internal/agent/tool/
  tool.go
  registry.go
  executor.go
  rag.go

internal/agent/stream/
  bus.go
  sse.go

internal/platform/lifecycle/
  app.go
  signal.go
  readiness.go

internal/platform/telemetry/
  event.go
  pipeline.go
  exporter_memory.go
  exporter_async.go
```

Why this shape:

```text
project-layout -> cmd is composition root, internal is private implementation.
go-kit -> service / endpoint / transport boundary.
Bifrost -> provider registry, queue, fallback, plugin thinking.
trpc-agent-go + Temporal -> event/replay/runner/tool boundaries.
OTel Collector -> telemetry component graph and queue.
Memos + NATS -> SSE/event stream slow consumer policy.
Caddy -> module lifecycle and dynamic config.
```

The current local implementation uses [`../../capstone_ai_gateway_agent_runtime/internal/app/demo.go`](../../capstone_ai_gateway_agent_runtime/internal/app/demo.go) as the composition proof and [`../../capstone_ai_gateway_agent_runtime/cmd/gateway/main.go`](../../capstone_ai_gateway_agent_runtime/cmd/gateway/main.go) as the runnable entry.

## 2. `cmd/gateway`: Composition Root

Source anchors:

```text
project-layout cmd/README.md -> small main
modern-go-application cmd/main.go -> config/log/health/telemetry/db/run group
Caddy caddy.go -> Run/Load/Stop lifecycle
Hertz engine.go -> Run/Shutdown hooks
```

`cmd/gateway/main.go`:

```go
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"example.com/capstone/internal/platform/lifecycle"
)

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

	ctx := lifecycle.RootContext()
	if err := app.Run(ctx); err != nil && !errors.Is(err, context.Canceled) && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("run app", "err", err)
		os.Exit(1)
	}
}
```

Current runnable entry:

```go
demo := app.BuildDemo()
server := &http.Server{
	Addr:              ":8080",
	Handler:           demo.Handler,
	ReadHeaderTimeout: 5 * time.Second,
}
runtime := lifecycle.App{
	Components: []lifecycle.Component{
		lifecycle.NewHTTPServer("http", server),
	},
	ShutdownTimeout: 10 * time.Second,
}
```

`cmd/gateway/wire.go`:

```go
type Config struct {
	HTTP struct {
		Addr            string
		ReadTimeout     time.Duration
		WriteTimeout    time.Duration
		ShutdownTimeout time.Duration
	}
	ProviderQueues map[string]int
	TokenBudgetPerMinute int
	TelemetryQueueCapacity int
}

func BuildApp(cfg Config, logger *slog.Logger) (lifecycle.App, error) {
	telemetry := telemetry.NewAsyncExporter(
		telemetry.NewMemoryExporter(),
		cfg.TelemetryQueueCapacity,
	)

	policies := policy.NewMemoryStore([]policy.TenantPolicy{
		{
			TenantID: "demo",
			AllowedModels: map[gateway.ModelName]bool{"gpt-demo": true},
			AllowedProviders: map[gateway.ProviderName]bool{"primary": true, "backup": true},
			AllowFallbacks: true,
		},
	})

	registry := provider.NewRegistry()
	registry.Replace("primary", provider.NewRuntime("primary", provider.FakeTimeout{}))
	registry.Replace("backup", provider.NewRuntime("backup", provider.FakeSuccess{Content: "ok"}))

	svc := gateway.NewService(gateway.ServiceDeps{
		Policy:    policy.NewEngine(policies),
		Limiter:   policy.NewTokenLimiter(cfg.TokenBudgetPerMinute),
		Router:    router.NewPlanner(registry),
		Fallback:  fallback.NewExecutor(registry, telemetry),
		Telemetry: telemetry,
	})

	handler := httpapi.NewHandler(svc, logger)
	mux := http.NewServeMux()
	httpapi.RegisterRoutes(mux, handler)

	server := &http.Server{
		Addr:         cfg.HTTP.Addr,
		Handler:      httpapi.Chain(mux, httpapi.WithRequestID(), httpapi.WithRecover(logger)),
		ReadTimeout:  cfg.HTTP.ReadTimeout,
		WriteTimeout: cfg.HTTP.WriteTimeout,
	}

	return lifecycle.App{
		Components: []lifecycle.Component{
			telemetry,
			lifecycle.NewHTTPServer("http", server, cfg.HTTP.ShutdownTimeout),
		},
	}, nil
}
```

Test idea:

```go
func TestBuildAppWiresRequiredComponents(t *testing.T) {
	app, err := BuildApp(testConfig(), slog.Default())
	if err != nil {
		t.Fatal(err)
	}
	if len(app.Components) == 0 {
		t.Fatal("expected lifecycle components")
	}
}
```

## 3. Gateway Core

Source anchors:

```text
Bifrost core/bifrost.go -> tryRequest / fallback / ProviderQueue
Tyk mw_rate_limiting.go -> admission before upstream
go-kit addendpoint -> endpoint middleware stack
Google styleguide -> small interfaces
```

`internal/gateway/core/types.go`:

```go
package gateway

import "context"

type TenantID string
type RequestID string
type ProviderName string
type ModelName string

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	RequestID RequestID
	TenantID  TenantID
	Model     ModelName
	Provider  ProviderName
	Messages  []Message
	Metadata  map[string]string
}

type ChatResponse struct {
	RequestID    RequestID    `json:"request_id"`
	Provider     ProviderName `json:"provider"`
	Model        ModelName    `json:"model"`
	Content      string       `json:"content"`
	InputTokens  int          `json:"input_tokens"`
	OutputTokens int          `json:"output_tokens"`
}

func (r ChatRequest) EstimatedTokens() int {
	total := 1
	for _, msg := range r.Messages {
		total += len(msg.Content)/4 + 4
	}
	return total
}

type ProviderClient interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}
```

`internal/gateway/core/service.go`:

```go
type PolicyEngine interface {
	Allow(ctx context.Context, req ChatRequest) (TenantPolicy, error)
}

type TokenLimiter interface {
	Consume(ctx context.Context, key string, tokens int) error
}

type Router interface {
	Plan(ctx context.Context, req ChatRequest, policy TenantPolicy) (RoutePlan, error)
}

type FallbackExecutor interface {
	Try(ctx context.Context, plan RoutePlan, req ChatRequest) (ChatResponse, error)
}

type TelemetrySink interface {
	Record(ctx context.Context, event TelemetryEvent)
}

type ServiceDeps struct {
	Policy    PolicyEngine
	Limiter   TokenLimiter
	Router    Router
	Fallback  FallbackExecutor
	Telemetry TelemetrySink
}

type Service struct {
	deps ServiceDeps
}

func NewService(deps ServiceDeps) Service {
	return Service{deps: deps}
}

func (s Service) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	start := time.Now()

	policy, err := s.deps.Policy.Allow(ctx, req)
	if err != nil {
		s.record(ctx, req, start, err)
		return ChatResponse{}, err
	}

	limitKey := string(req.TenantID) + ":" + string(req.Model)
	if err := s.deps.Limiter.Consume(ctx, limitKey, req.EstimatedTokens()); err != nil {
		s.record(ctx, req, start, err)
		return ChatResponse{}, err
	}

	plan, err := s.deps.Router.Plan(ctx, req, policy)
	if err != nil {
		s.record(ctx, req, start, err)
		return ChatResponse{}, err
	}

	resp, err := s.deps.Fallback.Try(ctx, plan, req)
	s.record(ctx, req, start, err)
	return resp, err
}

func (s Service) record(ctx context.Context, req ChatRequest, start time.Time, err error) {
	if s.deps.Telemetry == nil {
		return
	}
	s.deps.Telemetry.Record(ctx, TelemetryEvent{
		Name:       "gateway.chat",
		RequestID:  string(req.RequestID),
		TenantID:   string(req.TenantID),
		Model:      string(req.Model),
		Provider:   string(req.Provider),
		LatencyMS:  time.Since(start).Milliseconds(),
		ErrorClass: string(Classify(err)),
	})
}
```

`internal/gateway/core/endpoint.go`:

```go
type Endpoint func(ctx context.Context, req ChatRequest) (ChatResponse, error)

type EndpointMiddleware func(Endpoint) Endpoint

func MakeEndpoint(service Service) Endpoint {
	return service.Chat
}

func ChainEndpoint(endpoint Endpoint, middleware ...EndpointMiddleware) Endpoint {
	for i := len(middleware) - 1; i >= 0; i-- {
		endpoint = middleware[i](endpoint)
	}
	return endpoint
}
```

Endpoint tests:

```go
func TestEndpointMiddlewareCanShortCircuitBeforeProviderCall(t *testing.T) {
	called := false
	base := Endpoint(func(ctx context.Context, req ChatRequest) (ChatResponse, error) {
		called = true
		return ChatResponse{}, nil
	})
	deny := func(next Endpoint) Endpoint {
		return func(ctx context.Context, req ChatRequest) (ChatResponse, error) {
			return ChatResponse{}, GatewayError{Class: ErrorUnauthorized, Err: errors.New("missing api key")}
		}
	}

	_, err := ChainEndpoint(base, deny)(context.Background(), ChatRequest{})
	if ErrorClassOf(err) != ErrorUnauthorized {
		t.Fatalf("error class: %s", ErrorClassOf(err))
	}
	if called {
		t.Fatal("provider/service should not be called after middleware rejects")
	}
}
```

This is the local proof for the go-kit `service -> endpoint -> transport` reading path.

Core tests:

```go
func TestServiceRejectsUnauthorizedModelBeforeProviderCall(t *testing.T) {
	provider := &spyProvider{}
	svc := NewService(ServiceDeps{
		Policy:   denyPolicy{},
		Limiter:  allowLimiter{},
		Router:   staticRouter{},
		Fallback: provider,
	})

	_, err := svc.Chat(context.Background(), ChatRequest{TenantID: "t1", Model: "blocked"})
	if err == nil {
		t.Fatal("expected policy error")
	}
	if provider.calls != 0 {
		t.Fatalf("provider calls: want 0 got %d", provider.calls)
	}
}
```

## 4. Policy And Quota

Source anchors:

```text
Tyk RateLimitAndQuotaCheck -> policy/quota middleware
project-layout internal -> policy as private implementation
Uber channel-size -> capacity must document backpressure
```

`internal/gateway/policy/engine.go`:

```go
type TenantPolicy struct {
	TenantID         gateway.TenantID
	AllowedModels    map[gateway.ModelName]bool
	AllowedProviders map[gateway.ProviderName]bool
	AllowFallbacks   bool
}

type Store interface {
	Get(ctx context.Context, tenant gateway.TenantID) (TenantPolicy, error)
}

type Engine struct {
	store Store
}

func NewEngine(store Store) Engine {
	return Engine{store: store}
}

func (e Engine) Allow(ctx context.Context, req gateway.ChatRequest) (TenantPolicy, error) {
	policy, err := e.store.Get(ctx, req.TenantID)
	if err != nil {
		return TenantPolicy{}, err
	}
	if !policy.AllowedModels[req.Model] {
		return TenantPolicy{}, gateway.GatewayError{
			Class: gateway.ErrorUnauthorized,
			Err:   fmt.Errorf("model %s not allowed", req.Model),
		}
	}
	if req.Provider != "" && !policy.AllowedProviders[req.Provider] {
		return TenantPolicy{}, gateway.GatewayError{
			Class: gateway.ErrorUnauthorized,
			Err:   fmt.Errorf("provider %s not allowed", req.Provider),
		}
	}
	return policy, nil
}
```

`internal/gateway/policy/limiter.go`:

```go
type TokenLimiter struct {
	mu     sync.Mutex
	limit  int
	used   map[string]int
	window time.Time
}

func NewTokenLimiter(limit int) *TokenLimiter {
	return &TokenLimiter{
		limit:  limit,
		used:   map[string]int{},
		window: time.Now().Truncate(time.Minute),
	}
}

func (l *TokenLimiter) Consume(ctx context.Context, key string, tokens int) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if err := ctx.Err(); err != nil {
		return err
	}
	nowWindow := time.Now().Truncate(time.Minute)
	if nowWindow.After(l.window) {
		l.window = nowWindow
		l.used = map[string]int{}
	}
	if l.used[key]+tokens > l.limit {
		return gateway.GatewayError{Class: gateway.ErrorRateLimited, Err: errors.New("token budget exceeded")}
	}
	l.used[key] += tokens
	return nil
}
```

Policy tests:

```go
func TestPolicyRejectsBlockedProvider(t *testing.T) {
	engine := NewEngine(memoryStore{
		"tenant": {
			TenantID: "tenant",
			AllowedModels: map[gateway.ModelName]bool{"gpt": true},
			AllowedProviders: map[gateway.ProviderName]bool{"backup": true},
		},
	})

	_, err := engine.Allow(context.Background(), gateway.ChatRequest{
		TenantID: "tenant",
		Model: "gpt",
		Provider: "primary",
	})
	if gateway.Classify(err) != gateway.ErrorUnauthorized {
		t.Fatalf("want unauthorized got %v", err)
	}
}
```

## 5. Router And Provider Runtime

Source anchors:

```text
Bifrost ProviderQueue / requestQueues -> provider runtime object
Go by Example worker pool -> bounded provider workers
learngo copy -> route plan defensive copy
```

`internal/gateway/router/route.go`:

```go
type Route struct {
	Provider gateway.ProviderName
	Model    gateway.ModelName
	Reason   string
}

type RoutePlan struct {
	primary   Route
	fallbacks []Route
}

func NewRoutePlan(primary Route, fallbacks []Route) RoutePlan {
	out := append([]Route(nil), fallbacks...)
	return RoutePlan{primary: primary, fallbacks: out}
}

func (p RoutePlan) Primary() Route { return p.primary }

func (p RoutePlan) Attempts() []Route {
	out := make([]Route, 0, 1+len(p.fallbacks))
	out = append(out, p.primary)
	out = append(out, p.fallbacks...)
	return out
}
```

`internal/gateway/provider/queue.go`:

```go
type Job struct {
	Request gateway.ChatRequest
	Reply   chan Result
}

type Result struct {
	Response gateway.ChatResponse
	Err      error
}

type Queue struct {
	name gateway.ProviderName
	jobs chan Job
}

func NewQueue(name gateway.ProviderName, capacity int) *Queue {
	return &Queue{name: name, jobs: make(chan Job, capacity)}
}

func (q *Queue) TrySubmit(job Job) error {
	select {
	case q.jobs <- job:
		return nil
	default:
		return gateway.GatewayError{Class: gateway.ErrorOverloaded, Provider: q.name, Err: gateway.ErrQueueFull}
	}
}

func (q *Queue) Start(ctx context.Context, workers int, client gateway.ProviderClient) {
	for i := 0; i < workers; i++ {
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case job := <-q.jobs:
					resp, err := client.Chat(ctx, job.Request)
					job.Reply <- Result{Response: resp, Err: err}
				}
			}
		}()
	}
}
```

Provider runtime:

```go
type Runtime struct {
	name    gateway.ProviderName
	client  gateway.ProviderClient
	queue   *Queue
	closing atomic.Bool
}

func NewRuntime(name gateway.ProviderName, client gateway.ProviderClient, capacity int) *Runtime {
	return &Runtime{name: name, client: client, queue: NewQueue(name, capacity)}
}

func (r *Runtime) Chat(ctx context.Context, req gateway.ChatRequest) (gateway.ChatResponse, error) {
	if r.closing.Load() {
		return gateway.ChatResponse{}, gateway.GatewayError{Class: gateway.ErrorOverloaded, Provider: r.name, Err: errors.New("provider closing")}
	}
	reply := make(chan Result, 1)
	if err := r.queue.TrySubmit(Job{Request: req, Reply: reply}); err != nil {
		return gateway.ChatResponse{}, err
	}
	select {
	case result := <-reply:
		return result.Response, result.Err
	case <-ctx.Done():
		return gateway.ChatResponse{}, ctx.Err()
	}
}
```

Tests:

```go
func TestRoutePlanDoesNotExposeFallbackSlice(t *testing.T) {
	fallbacks := []Route{{Provider: "backup"}}
	plan := NewRoutePlan(Route{Provider: "primary"}, fallbacks)
	fallbacks[0].Provider = "mutated"

	if got := plan.Attempts()[1].Provider; got != "backup" {
		t.Fatalf("fallback mutated through input slice: %s", got)
	}
}

func TestProviderQueueFullClassifiesAsOverloaded(t *testing.T) {
	q := NewQueue("primary", 1)
	reply := make(chan Result, 1)
	if err := q.TrySubmit(Job{Reply: reply}); err != nil {
		t.Fatal(err)
	}
	err := q.TrySubmit(Job{Reply: reply})
	if gateway.Classify(err) != gateway.ErrorOverloaded {
		t.Fatalf("want overloaded got %v", err)
	}
}
```

## 6. Fallback Executor

Source anchors:

```text
Bifrost shouldTryFallbacks / prepareFallbackRequest / fallback index
Uber error wrapping -> preserve class
OTel trace dimensions -> fallback.index
```

`internal/gateway/fallback/taxonomy.go`:

```go
type ErrorClass string

const (
	ErrorTimeout       ErrorClass = "timeout"
	ErrorRateLimited   ErrorClass = "rate_limited"
	ErrorInvalidInput  ErrorClass = "invalid_input"
	ErrorUnauthorized  ErrorClass = "unauthorized"
	ErrorProviderError ErrorClass = "provider_error"
	ErrorOverloaded    ErrorClass = "overloaded"
)

func CanFallback(err error) bool {
	switch Classify(err) {
	case ErrorTimeout, ErrorRateLimited, ErrorProviderError, ErrorOverloaded:
		return true
	default:
		return false
	}
}
```

`internal/gateway/fallback/executor.go`:

```go
type ProviderRegistry interface {
	Get(name gateway.ProviderName) (gateway.ProviderClient, bool)
}

type Executor struct {
	registry  ProviderRegistry
	telemetry gateway.TelemetrySink
}

func NewExecutor(registry ProviderRegistry, telemetry gateway.TelemetrySink) Executor {
	return Executor{registry: registry, telemetry: telemetry}
}

func (e Executor) Try(ctx context.Context, plan router.RoutePlan, req gateway.ChatRequest) (gateway.ChatResponse, error) {
	var lastErr error
	for attempt, route := range plan.Attempts() {
		client, ok := e.registry.Get(route.Provider)
		if !ok {
			lastErr = gateway.GatewayError{Class: gateway.ErrorInvalidInput, Provider: route.Provider, Err: gateway.ErrNoProvider}
			break
		}
		attemptReq := prepareAttempt(req, route, attempt)
		start := time.Now()
		resp, err := client.Chat(ctx, attemptReq)
		e.record(ctx, attemptReq, route, attempt, time.Since(start), err)
		if err == nil {
			return resp, nil
		}
		lastErr = err
		if !CanFallback(err) || ctx.Err() != nil {
			break
		}
	}
	return gateway.ChatResponse{}, lastErr
}

func prepareAttempt(req gateway.ChatRequest, route router.Route, attempt int) gateway.ChatRequest {
	req.Provider = route.Provider
	req.Model = route.Model
	if req.Metadata == nil {
		req.Metadata = map[string]string{}
	}
	req.Metadata["fallback.index"] = strconv.Itoa(attempt)
	return req
}
```

Tests:

```go
func TestFallbackStopsOnInvalidInput(t *testing.T) {
	registry := fakeRegistry{
		"primary": fakeProvider{err: gateway.GatewayError{Class: gateway.ErrorInvalidInput, Err: errors.New("bad")}},
		"backup":  fakeProvider{resp: gateway.ChatResponse{Content: "ok"}},
	}
	executor := NewExecutor(registry, nil)
	_, err := executor.Try(context.Background(), routePlan("primary", "backup"), gateway.ChatRequest{Model: "gpt"})
	if gateway.Classify(err) != gateway.ErrorInvalidInput {
		t.Fatalf("want invalid input got %v", err)
	}
	if registry.calls["backup"] != 0 {
		t.Fatal("backup should not be called")
	}
}
```

## 7. Agent Event Store And Replay

Source anchors:

```text
trpc-agent-go event.Event -> model response + runtime metadata
Temporal MutableState -> Add*Event / Apply*Event / transaction
Syncthing protocol -> stable protocol boundary
```

`internal/agent/event/event.go`:

```go
type Type string

const (
	UserMessage      Type = "user_message"
	AssistantMessage Type = "assistant_message"
	ToolStarted      Type = "tool_started"
	ToolFinished     Type = "tool_finished"
	ToolFailed       Type = "tool_failed"
	RunCompleted     Type = "run_completed"
	RunFailed        Type = "run_failed"
)

type Event struct {
	ID         string          `json:"id"`
	Version    string          `json:"version"`
	SessionID  string          `json:"session_id"`
	RunID      string          `json:"run_id"`
	Type       Type            `json:"type"`
	Content    string          `json:"content,omitempty"`
	ToolCallID string          `json:"tool_call_id,omitempty"`
	ToolName   string          `json:"tool_name,omitempty"`
	Payload    json.RawMessage `json:"payload,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}
```

`internal/agent/event/store.go`:

```go
type Store interface {
	Append(ctx context.Context, sessionID string, event Event) error
	List(ctx context.Context, sessionID string) ([]Event, error)
}

type MemoryStore struct {
	mu     sync.Mutex
	events map[string][]Event
}

func (s *MemoryStore) Append(ctx context.Context, sessionID string, event Event) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if event.ID == "" {
		return errors.New("event id required")
	}
	event.SessionID = sessionID
	if event.Version == "" {
		event.Version = "v1"
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now()
	}
	s.events[sessionID] = append(s.events[sessionID], event)
	return nil
}
```

`internal/agent/event/replay.go`:

```go
type State struct {
	SessionID    string
	Messages     []gateway.Message
	RunningTools map[string]string
	Completed    bool
	Failed       bool
}

func Replay(sessionID string, events []Event) State {
	state := State{SessionID: sessionID, RunningTools: map[string]string{}}
	for _, event := range events {
		switch event.Type {
		case UserMessage:
			state.Messages = append(state.Messages, gateway.Message{Role: "user", Content: event.Content})
		case AssistantMessage:
			state.Messages = append(state.Messages, gateway.Message{Role: "assistant", Content: event.Content})
		case ToolStarted:
			state.RunningTools[event.ToolCallID] = event.ToolName
		case ToolFinished, ToolFailed:
			delete(state.RunningTools, event.ToolCallID)
		case RunCompleted:
			state.Completed = true
		case RunFailed:
			state.Failed = true
		}
	}
	return state
}
```

Replay test:

```go
func TestReplayClearsFinishedTool(t *testing.T) {
	state := Replay("s1", []Event{
		{Type: UserMessage, Content: "search"},
		{Type: ToolStarted, ToolCallID: "t1", ToolName: "search"},
		{Type: ToolFinished, ToolCallID: "t1"},
	})
	if len(state.RunningTools) != 0 {
		t.Fatalf("running tools: %+v", state.RunningTools)
	}
}
```

## 8. Runner, Commands And Tools

Source anchors:

```text
Temporal CommandAttrValidator -> validate command sequence before mutating history
trpc-agent-go Tool/Event -> tool call as structured event
go-clean-template entity transition -> explicit run status transition
```

`internal/agent/runner/command.go`:

```go
type CommandType string

const (
	CommandCallTool CommandType = "call_tool"
	CommandAnswer   CommandType = "answer"
	CommandFail     CommandType = "fail"
)

type Command struct {
	Type CommandType
	Tool *tool.Call
	Text string
}

func ValidateCommands(commands []Command) error {
	terminal := false
	for _, cmd := range commands {
		if terminal {
			return errors.New("command after terminal command")
		}
		switch cmd.Type {
		case CommandCallTool:
			if cmd.Tool == nil || cmd.Tool.ID == "" || cmd.Tool.Name == "" {
				return errors.New("invalid tool command")
			}
		case CommandAnswer, CommandFail:
			terminal = true
		default:
			return fmt.Errorf("unknown command: %s", cmd.Type)
		}
	}
	return nil
}
```

`internal/agent/runner/runner.go`:

```go
type Model interface {
	Next(ctx context.Context, state event.State) ([]Command, error)
}

type Runner struct {
	store event.Store
	model Model
	tools tool.Executor
	newID func() string
}

func (r Runner) Run(ctx context.Context, sessionID, runID, input string) error {
	if err := r.store.Append(ctx, sessionID, event.Event{ID: r.newID(), RunID: runID, Type: event.UserMessage, Content: input}); err != nil {
		return err
	}
	return r.Resume(ctx, sessionID, runID)
}

func (r Runner) Resume(ctx context.Context, sessionID, runID string) error {
	events, err := r.store.List(ctx, sessionID)
	if err != nil {
		return err
	}
	state := event.Replay(sessionID, events)
	commands, err := r.model.Next(ctx, state)
	if err != nil {
		_ = r.store.Append(ctx, sessionID, event.Event{ID: r.newID(), RunID: runID, Type: event.RunFailed, Content: err.Error()})
		return err
	}
	if err := ValidateCommands(commands); err != nil {
		return err
	}
	return r.apply(ctx, sessionID, runID, commands)
}
```

Tool executor:

```go
type Tool interface {
	Name() string
	Invoke(ctx context.Context, input json.RawMessage) (json.RawMessage, error)
}

type Executor struct {
	registry Registry
	timeout  time.Duration
}

func (e Executor) Invoke(ctx context.Context, call Call) (Result, error) {
	tool, ok := e.registry.Get(call.Name)
	if !ok {
		return Result{}, ErrToolNotFound
	}
	toolCtx, cancel := context.WithTimeout(ctx, e.timeout)
	defer cancel()
	out, err := tool.Invoke(toolCtx, call.Input)
	return Result{CallID: call.ID, Output: out}, err
}
```

Runner test:

```go
func TestRunnerRecordsToolCallAndFinalAnswer(t *testing.T) {
	store := event.NewMemoryStore()
	model := scriptedModel{
		{Type: CommandCallTool, Tool: &tool.Call{ID: "call-1", Name: "search"}},
		{Type: CommandAnswer, Text: "done"},
	}
	runner := NewRunner(store, model, tool.NewExecutor(fakeSearch{}), deterministicID())

	if err := runner.Run(context.Background(), "s1", "r1", "find docs"); err != nil {
		t.Fatal(err)
	}
	events, _ := store.List(context.Background(), "s1")
	assertEventTypes(t, events, event.UserMessage, event.ToolStarted, event.ToolFinished, event.AssistantMessage, event.RunCompleted)
}
```

## 9. Streaming And Slow Consumer Policy

Source anchors:

```text
Memos sse_hub.go -> buffered client channel, drop slow event
NATS client.go -> slow consumer as explicit failure mode
Syncthing protocol.go -> stable stream protocol
```

Event bus:

```go
type Bus struct {
	mu      sync.RWMutex
	clients map[string]map[string]*Client
}

type Client struct {
	ID     string
	Events chan event.Event
}

func (b *Bus) Subscribe(streamID, clientID string) *Client {
	client := &Client{ID: clientID, Events: make(chan event.Event, 32)}
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.clients[streamID] == nil {
		b.clients[streamID] = map[string]*Client{}
	}
	b.clients[streamID][clientID] = client
	return client
}

func (b *Bus) Publish(streamID string, ev event.Event) int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	dropped := 0
	for _, client := range b.clients[streamID] {
		select {
		case client.Events <- ev:
		default:
			dropped++
		}
	}
	return dropped
}
```

SSE handler:

```go
func WriteSSE(ctx context.Context, w http.ResponseWriter, client *Client) error {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, _ := w.(http.Flusher)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case ev := <-client.Events:
			payload, _ := json.Marshal(ev)
			if _, err := fmt.Fprintf(w, "id: %s\nevent: %s\ndata: %s\n\n", ev.ID, ev.Type, payload); err != nil {
				return err
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
	}
}
```

Test:

```go
func TestBusDropsForSlowClient(t *testing.T) {
	bus := NewBus()
	client := bus.Subscribe("s1", "c1")
	for i := 0; i < cap(client.Events); i++ {
		client.Events <- event.Event{ID: strconv.Itoa(i)}
	}
	dropped := bus.Publish("s1", event.Event{ID: "overflow"})
	if dropped != 1 {
		t.Fatalf("dropped: want 1 got %d", dropped)
	}
}
```

## 10. Telemetry Pipeline

Source anchors:

```text
OpenTelemetry Collector component.go -> Start/Shutdown
OTel graph.go -> downstream starts before upstream, upstream stops before downstream
OTel queue.go -> Offer/Size/Capacity
Bifrost fallback index -> provider/fallback dimensions
```

Telemetry event:

```go
type Event struct {
	Name          string
	TraceID       string
	RequestID     string
	TenantID      string
	SessionID     string
	RunID         string
	Provider      string
	Model         string
	FallbackIndex int
	LatencyMS     int64
	ErrorClass    string
	Attributes    map[string]string
}
```

Pipeline:

```go
type Processor interface {
	Process(ctx context.Context, event Event) (Event, error)
}

type Exporter interface {
	lifecycle.Component
	Export(ctx context.Context, event Event) error
}

type Pipeline struct {
	processors []Processor
	exporter   Exporter
}

func (p Pipeline) Record(ctx context.Context, event Event) {
	for _, processor := range p.processors {
		next, err := processor.Process(ctx, event)
		if err != nil {
			return
		}
		event = next
	}
	_ = p.exporter.Export(ctx, event)
}
```

Async exporter:

```go
type AsyncExporter struct {
	queue   chan Event
	next    Exporter
	dropped atomic.Int64
}

func NewAsyncExporter(next Exporter, capacity int) *AsyncExporter {
	return &AsyncExporter{queue: make(chan Event, capacity), next: next}
}

func (e *AsyncExporter) Export(ctx context.Context, event Event) error {
	select {
	case e.queue <- event:
		return nil
	default:
		e.dropped.Add(1)
		return nil
	}
}

func (e *AsyncExporter) Start(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event := <-e.queue:
			_ = e.next.Export(ctx, event)
		}
	}
}
```

Test:

```go
func TestTelemetryRecordsFallbackDimensions(t *testing.T) {
	exporter := NewMemoryExporter()
	pipeline := Pipeline{exporter: exporter}
	pipeline.Record(context.Background(), Event{
		Name: "gateway.provider_attempt",
		Provider: "backup",
		Model: "gpt",
		FallbackIndex: 1,
		ErrorClass: "timeout",
	})

	got := exporter.Events()
	if got[0].FallbackIndex != 1 || got[0].Provider != "backup" {
		t.Fatalf("missing fallback dimensions: %+v", got[0])
	}
}
```

## 11. End-To-End Acceptance Suite

The capstone is not done until these pass:

### Gateway Acceptance

```go
func TestE2EChatFallsBackAndRecordsTelemetry(t *testing.T) {
	app := newTestApp(t,
		withProvider("primary", timeoutProvider()),
		withProvider("backup", successProvider("hello")),
	)

	resp := app.PostChat(ChatRequest{
		RequestID: "req-1",
		TenantID: "demo",
		Model: "gpt-demo",
		Messages: []Message{{Role: "user", Content: "hi"}},
	})

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: %d body=%s", resp.StatusCode, resp.Body)
	}
	app.Telemetry.Assert(t, "gateway.provider_attempt", map[string]string{
		"provider": "primary",
		"error_class": "timeout",
	})
	app.Telemetry.Assert(t, "gateway.provider_attempt", map[string]string{
		"provider": "backup",
		"error_class": "",
	})
}
```

### Agent Acceptance

```go
func TestE2EAgentRunsToolAndStreamsEvents(t *testing.T) {
	app := newTestApp(t,
		withModel(scriptedModel{
			{Type: CommandCallTool, Tool: &tool.Call{ID: "tool-1", Name: "search"}},
			{Type: CommandAnswer, Text: "found it"},
		}),
		withTool("search", fakeToolResult(`{"title":"doc"}`)),
	)

	run := app.StartRun("session-1", "search docs")
	events := app.Events("session-1")

	assertEventTypes(t, events,
		event.UserMessage,
		event.ToolStarted,
		event.ToolFinished,
		event.AssistantMessage,
		event.RunCompleted,
	)
	if run.Status != RunCompleted {
		t.Fatalf("run status: %s", run.Status)
	}
}
```

### Backpressure Acceptance

```go
func TestE2EProviderQueueFullReturnsOverloaded(t *testing.T) {
	app := newTestApp(t, withProviderQueueCapacity("primary", 1), withBlockingProvider("primary"))
	app.BlockProvider("primary")

	first := app.PostChatAsync(validChat("req-1"))
	second := app.PostChat(validChat("req-2"))

	if second.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status: want 503 got %d", second.StatusCode)
	}
	app.UnblockProvider("primary")
	first.Wait()
}
```

### Shutdown Acceptance

```go
func TestE2EShutdownStopsBackgroundComponents(t *testing.T) {
	app := newTestApp(t)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- app.Run(ctx) }()

	cancel()
	select {
	case <-time.After(2 * time.Second):
		t.Fatal("shutdown timed out")
	case err := <-done:
		if err != nil && !errors.Is(err, context.Canceled) {
			t.Fatalf("shutdown: %v", err)
		}
	}
}
```

## 12. Capstone Definition Of Done

You can consider the capstone learning loop closed when:

```text
1. Every package has a source backlink.
2. Every public interface has at least one fake implementation in tests.
3. Every external call has context timeout or cancellation path.
4. Every queue has capacity and overflow behavior.
5. Every fallback decision uses error taxonomy.
6. Every agent mutation is represented as an event.
7. Replay can restore agent state from event history.
8. Telemetry contains tenant/model/provider/error_class/fallback_index.
9. Shutdown drains HTTP, provider queues and telemetry exporters.
10. E2E tests cover success, fallback, overload, tool failure and shutdown.
```

Manual audit table:

| Capability | Source learning | Required local proof |
|---|---|---|
| HTTP boundary | golang/example, Hertz, go-kit | handler tests and e2e HTTP test |
| Package layout | project-layout, modern-go-application | `cmd` only wires dependencies |
| Error wrapping | Uber guide, Bifrost taxonomy | `errors.As` test for `GatewayError` |
| Provider routing | Bifrost, Tyk | fallback and non-fallback tests |
| Backpressure | Go by Example, OTel queue, NATS | queue full test |
| Agent event flow | trpc-agent-go, Temporal | replay test |
| Tool execution | trpc-agent-go, Temporal command validation | tool success/failure event tests |
| SSE stream | Memos, NATS | slow client drop/disconnect test |
| Module lifecycle | Caddy, OTel component | Start/Shutdown tests |
| Observability | OTel Collector, Bifrost | memory exporter assertions |
