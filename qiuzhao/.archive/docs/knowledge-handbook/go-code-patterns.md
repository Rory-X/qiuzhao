# Go Code Patterns For Architecture Learning

这个文件是本地可复制的 Go 架构模式库。所有代码都是学习版翻译，用来把 GitHub 项目的设计落到自己的 Go 项目里。

## 1. Small Interface

Sources: Go 101, Google Go Styleguide, go-kit.

```go
type ChatCaller interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type GatewayHandler struct {
	chat ChatCaller
}
```

Rule:

```text
接口由使用方定义。
先定义最小 chat 能力，embedding/image/audio 后面按业务面扩展。
```

## 2. Table Test For Routing

Sources: Learn Go with Tests, Bifrost, Tyk.

```go
func TestRoutePlan(t *testing.T) {
	tests := []struct {
		name      string
		providers []Provider
		preferred string
		want      string
		wantErr   error
	}{
		{
			name: "preferred healthy",
			providers: []Provider{{Name: "openai", Healthy: true}},
			preferred: "openai",
			want: "openai",
		},
		{
			name: "fallback",
			providers: []Provider{
				{Name: "primary", Healthy: false},
				{Name: "backup", Healthy: true},
			},
			preferred: "primary",
			want: "backup",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := NewRouter(tt.providers)
			got, err := router.Select(tt.preferred)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err: want %v got %v", tt.wantErr, err)
			}
			if got.Name != tt.want {
				t.Fatalf("provider: want %q got %q", tt.want, got.Name)
			}
		})
	}
}
```

## 3. Context Timeout In Usecase

Sources: go-backend-clean-architecture, Hertz, Go by Example.

```go
type Usecase struct {
	timeout time.Duration
	client  ChatCaller
}

func (u Usecase) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, u.timeout)
	defer cancel()

	resp, err := u.client.Chat(ctx, req)
	if err != nil {
		return ChatResponse{}, fmt.Errorf("chat usecase: %w", err)
	}
	return resp, nil
}
```

## 4. Bounded Queue

Sources: Go by Example, Uber Go Guide, Bifrost, OpenTelemetry Collector exporterhelper queue.

```go
var ErrQueueFull = errors.New("queue full")

type Queue[T any] struct {
	items chan T
}

func NewQueue[T any](capacity int) *Queue[T] {
	if capacity < 1 {
		capacity = 1
	}
	return &Queue[T]{items: make(chan T, capacity)}
}

func (q *Queue[T]) TryPut(item T) error {
	select {
	case q.items <- item:
		return nil
	default:
		return ErrQueueFull
	}
}
```

## 5. Worker Pool

Sources: Go by Example, NATS, Temporal matching/worker, Bifrost provider concurrency.

```go
type WorkerPool[T any] struct {
	jobs <-chan T
	run  func(context.Context, T) error
}

func (p WorkerPool[T]) Start(ctx context.Context, n int) <-chan error {
	errs := make(chan error, n)
	for i := 0; i < n; i++ {
		go func() {
			for {
				select {
				case <-ctx.Done():
					errs <- ctx.Err()
					return
				case job, ok := <-p.jobs:
					if !ok {
						errs <- nil
						return
					}
					if err := p.run(ctx, job); err != nil {
						errs <- err
					}
				}
			}
		}()
	}
	return errs
}
```

## 6. Provider Fallback Error Taxonomy

Sources: Bifrost, Tyk, Uber Go Guide.

```go
type ErrorClass string

const (
	ErrorTimeout       ErrorClass = "timeout"
	ErrorRateLimited   ErrorClass = "rate_limited"
	ErrorInvalidInput  ErrorClass = "invalid_input"
	ErrorUnauthorized  ErrorClass = "unauthorized"
	ErrorProviderError ErrorClass = "provider_error"
)

type GatewayError struct {
	Class ErrorClass
	Err   error
}

func (e GatewayError) Error() string { return e.Err.Error() }
func (e GatewayError) Unwrap() error { return e.Err }

func CanFallback(err error) bool {
	var ge GatewayError
	if !errors.As(err, &ge) {
		return false
	}
	return ge.Class == ErrorTimeout || ge.Class == ErrorProviderError || ge.Class == ErrorRateLimited
}
```

## 7. Middleware Chain

Sources: Tyk, Hertz, go-kit.

```go
type Middleware func(http.Handler) http.Handler

func Chain(h http.Handler, mws ...Middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

func WithRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = uuid.NewString()
		}
		ctx := context.WithValue(r.Context(), requestIDKey{}, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
```

## 8. Endpoint Middleware

Sources: go-kit, OpenTelemetry, AI gateway telemetry.

```go
type Endpoint[Req any, Resp any] func(context.Context, Req) (Resp, error)

func WithEndpointMetrics[Req any, Resp any](name string, next Endpoint[Req, Resp]) Endpoint[Req, Resp] {
	return func(ctx context.Context, req Req) (Resp, error) {
		start := time.Now()
		resp, err := next(ctx, req)
		recordEndpointLatency(name, time.Since(start), err)
		return resp, err
	}
}
```

## 9. Domain State Machine

Sources: Wild Workouts, go-clean-template, trpc-agent-go.

```go
type RunStatus string

const (
	RunPending   RunStatus = "pending"
	RunRunning   RunStatus = "running"
	RunCompleted RunStatus = "completed"
	RunFailed    RunStatus = "failed"
)

type Run struct {
	ID     string
	Status RunStatus
}

func (r *Run) Transition(next RunStatus) error {
	switch r.Status {
	case RunCompleted, RunFailed:
		return ErrTerminalState
	case RunPending:
		if next != RunRunning && next != RunFailed {
			return ErrInvalidTransition
		}
	case RunRunning:
		if next != RunCompleted && next != RunFailed {
			return ErrInvalidTransition
		}
	}
	r.Status = next
	return nil
}
```

## 10. Repository Update Closure

Sources: Wild Workouts.

```go
type Repository[T any] interface {
	Update(ctx context.Context, id string, fn func(*T) error) error
}

func CompleteRun(ctx context.Context, repo Repository[Run], id string) error {
	return repo.Update(ctx, id, func(run *Run) error {
		return run.Transition(RunCompleted)
	})
}
```

## 11. Event Store And Replay

Sources: Temporal, trpc-agent-go, Syncthing protocol thinking.

```go
type EventStore interface {
	Append(ctx context.Context, streamID string, event Event) error
	List(ctx context.Context, streamID string) ([]Event, error)
}

func ReplaySession(events []Event) SessionState {
	var state SessionState
	for _, event := range events {
		switch event.Type {
		case EventUserMessage:
			state.Messages++
		case EventToolCallStarted:
			state.RunningTools[event.ToolCallID] = true
		case EventToolCallFinished:
			delete(state.RunningTools, event.ToolCallID)
		}
	}
	return state
}
```

## 12. Tool Executor

Sources: trpc-agent-go, Temporal activity boundary.

```go
type Tool interface {
	Name() string
	Invoke(ctx context.Context, input json.RawMessage) (json.RawMessage, error)
}

type ToolRegistry struct {
	tools map[string]Tool
}

func (r ToolRegistry) Invoke(ctx context.Context, name string, input json.RawMessage) (json.RawMessage, error) {
	tool, ok := r.tools[name]
	if !ok {
		return nil, ErrToolNotFound
	}
	return tool.Invoke(ctx, input)
}
```

## 13. Graph Execution

Sources: trpc-agent-go GraphAgent, Temporal workflow.

```go
type Next struct {
	NodeID string
}

type Node[S any] interface {
	Run(ctx context.Context, state *S) (Next, error)
}

type Graph[S any] struct {
	nodes map[string]Node[S]
}

func (g Graph[S]) Execute(ctx context.Context, start string, state *S) error {
	for current := start; current != ""; {
		node, ok := g.nodes[current]
		if !ok {
			return fmt.Errorf("graph node %q: %w", current, ErrNotFound)
		}
		next, err := node.Run(ctx, state)
		if err != nil {
			return err
		}
		current = next.NodeID
	}
	return nil
}
```

## 14. Telemetry Pipeline

Sources: OpenTelemetry Collector, modern-go-application, Bifrost observability.

```go
type TelemetryReceiver interface {
	Start(ctx context.Context, out chan<- TelemetryEvent) error
}

type TelemetryProcessor interface {
	Process(ctx context.Context, event TelemetryEvent) (TelemetryEvent, error)
}

type TelemetryExporter interface {
	Export(ctx context.Context, event TelemetryEvent) error
}

type TelemetryPipeline struct {
	processors []TelemetryProcessor
	exporter   TelemetryExporter
}

func (p TelemetryPipeline) Handle(ctx context.Context, event TelemetryEvent) error {
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

## 15. Pub/Sub With Slow Consumer Policy

Sources: NATS, Memos SSE, Realtime Chat template.

```go
type Subscriber chan Message

type Bus struct {
	mu   sync.RWMutex
	subs map[string][]Subscriber
}

func (b *Bus) Subscribe(subject string, buffer int) Subscriber {
	ch := make(Subscriber, buffer)
	b.mu.Lock()
	defer b.mu.Unlock()
	b.subs[subject] = append(b.subs[subject], ch)
	return ch
}

func (b *Bus) Publish(subject string, msg Message) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, sub := range b.subs[subject] {
		select {
		case sub <- msg:
		default:
			// Policy choice: drop, disconnect, retry, or dead letter.
		}
	}
}
```

## 16. Provider Module Lifecycle

Sources: Caddy, PocketBase hooks, Bifrost plugins.

```go
type ProviderModule interface {
	ID() string
	Provision(ctx context.Context, cfg ProviderConfig) error
	Validate() error
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	ChatCaller
}
```

## 17. Main Path And Best-Effort Side Effects

Sources: Memos, notification systems, gateway analytics.

```go
func (s *Service) CreateMessage(ctx context.Context, input CreateMessage) (Message, error) {
	msg, err := s.store.Create(ctx, input)
	if err != nil {
		return Message{}, err
	}

	if err := s.events.Publish(ctx, MessageCreated{ID: msg.ID}); err != nil {
		s.log.Warn("publish message created", "err", err)
	}

	return msg, nil
}
```

## 18. Graceful Shutdown

Sources: modern-go-application, Memos, Caddy, NATS.

```go
func RunServer(ctx context.Context, srv *http.Server) error {
	errs := make(chan error, 1)
	go func() {
		errs <- srv.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	case err := <-errs:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}
```

## Pattern To Lab Map

| Pattern | First local target | Production expansion |
|---|---|---|
| Small interface | `architecture_labs/gateway` | provider client package |
| Table test | all labs | regression suite |
| Context timeout | `api_service` | provider call timeout |
| Bounded queue | `architecture_labs/inference` | provider queue |
| Worker pool | `capstone_ai_gateway_agent_runtime/internal/gateway/provider` | adaptive concurrency |
| Fallback taxonomy | `capstone_ai_gateway_agent_runtime/internal/gateway/core` | circuit breaker |
| Middleware chain | `api_service` | auth/rate-limit/tracing |
| Endpoint middleware | `capstone_ai_gateway_agent_runtime/internal/gateway/httpapi` | go-kit style stack |
| State machine | `architecture_labs/agent` | run/tool status |
| Repository closure | `capstone_ai_gateway_agent_runtime/internal/agent/event` | transactional session update |
| Event replay | `capstone_ai_gateway_agent_runtime/internal/agent/event` | durable workflow |
| Tool executor | `capstone_ai_gateway_agent_runtime/internal/agent/tool` | sandbox/tool permissions |
| Graph execution | `capstone_ai_gateway_agent_runtime/internal/agent/graph` | human-in-the-loop |
| Telemetry pipeline | `capstone_ai_gateway_agent_runtime/internal/platform/telemetry` | OpenTelemetry exporter |
| Pub/Sub | `architecture_labs/realtime` | NATS/JetStream |
| Module lifecycle | `capstone_ai_gateway_agent_runtime/internal/platform/lifecycle` | dynamic config |
| Best-effort side effect | notification lab | webhook/SSE/analytics |
| Graceful shutdown | `capstone_ai_gateway_agent_runtime/internal/platform/lifecycle` | drain workers and queues |
