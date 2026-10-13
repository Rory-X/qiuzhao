# Large System Segment Cards

These cards extract large-system mechanics for AI gateway distribution, agent flow, high concurrency, high availability and observability.

## maximhq/bifrost

### Segment: Provider Queue

Anchor: `core/bifrost.go`, `ProviderQueue`.

Design extraction: provider concurrency is a first-class runtime object, not a hidden goroutine.

Go translation:

```go
type ProviderQueue struct {
	provider string
	jobs     chan ProviderJob
	workers  int
}

func (q ProviderQueue) TrySubmit(job ProviderJob) error {
	select {
	case q.jobs <- job:
		return nil
	default:
		return ErrProviderQueueFull
	}
}
```

Local proof: Capstone provider queue and bounded client tests in [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue_test.go) and [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/bounded_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/bounded_test.go).

Backlinks: [AI Gateway](../concepts/ai-gateway.md), [Concurrency And Backpressure](../concepts/concurrency-backpressure.md).

### Segment: Fallback Decision

Anchor: `shouldTryFallbacks`, `prepareFallbackRequest`, `shouldContinueWithFallbacks`.

Design extraction: fallback is controlled by error taxonomy, request config and context cancellation.

Go translation:

```go
func ShouldTryFallbacks(ctx context.Context, err error, fallbacks []Route) bool {
	if err == nil || ctx.Err() != nil || len(fallbacks) == 0 {
		return false
	}
	return CanFallback(err)
}
```

Local proof: Capstone fallback executor tests in [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor_test.go).

Backlinks: [AI Gateway](../concepts/ai-gateway.md).

### Segment: PreRequest Hook

Anchor: Bifrost request handling comments around hooks.

Design extraction: routing inputs can be changed by plugins before the core route decision.

Go translation:

```go
type PreRouteHook interface {
	Apply(ctx context.Context, req *ChatRequest) error
}
```

Backlinks: [Architecture Boundaries](../concepts/architecture-boundaries.md).

## trpc-group/trpc-agent-go

### Segment: Event Model

Anchor: `event/event.go`, A2A converters.

Design extraction: streaming text, tool calls and tool responses should all become structured events.

Go translation:

```go
type Event struct {
	ID         string
	Type       EventType
	ToolCallID string
	Message    *Message
	Error      *EventError
}
```

Local proof: `architecture_labs/agent`.

Backlinks: [Agent Runtime](../concepts/agent-runtime.md).

### Segment: Tool Boundary

Anchor: tool packages and examples.

Design extraction: tool calls are external side-effect boundaries; they need timeout, ID, input, output and error event.

Go translation:

```go
type Tool interface {
	Name() string
	Schema() json.RawMessage
	Invoke(context.Context, json.RawMessage) (json.RawMessage, error)
}
```

Backlinks: [Durable Workflow](../concepts/durable-workflow.md).

### Segment: Graph Agent

Anchor: `agent/graphagent/*`.

Design extraction: complex agent flows should represent nodes and transitions explicitly.

Go translation:

```go
type Node interface {
	Run(ctx context.Context, state *State) (Next, error)
}

type Next struct {
	NodeID string
	Reason string
}
```

Backlinks: [Agent Runtime](../concepts/agent-runtime.md).

## TykTechnologies/tyk

### Segment: Rate Limit Middleware

Anchor: `gateway/mw_rate_limiting.go`.

Design extraction: rate limit is middleware in gateway pipeline, before expensive upstream calls.

Go translation:

```go
func RateLimit(limiter Limiter) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if err := limiter.Allow(r.Context(), TenantKey(r)); err != nil {
				WriteError(w, err)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```

Backlinks: [AI Gateway](../concepts/ai-gateway.md).

### Segment: Analytics Pipeline

Anchor: `gateway/analytics.go`.

Design extraction: gateway analytics should not be a blocking DB write inside handler.

Go translation:

```go
func (a Analytics) Record(event GatewayEvent) {
	select {
	case a.queue <- event:
	default:
		a.dropped.Add(1)
	}
}
```

Backlinks: [Observability](../concepts/observability.md).

### Segment: API Definition

Anchor: `apidef/*`.

Design extraction: gateway behavior is config/policy driven. Tenant policy should be data, not hardcoded if statements.

Go translation:

```go
type TenantPolicy struct {
	AllowedModels      map[string]bool
	RequestsPerMinute int
	TokensPerDay      int
	AllowFallbacks    bool
}
```

Backlinks: [AI Gateway](../concepts/ai-gateway.md).

## cloudwego/hertz

### Segment: Engine And Middleware

Anchor: `pkg/route/engine.go`, `pkg/app`.

Design extraction: HTTP framework should remain transport boundary; business context should use `context.Context`.

Go translation:

```go
type BusinessHandler func(context.Context, Request) (Response, error)

func Adapt(fn BusinessHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := Decode(r)
		resp, err := fn(r.Context(), req)
		Encode(w, resp, err)
	}
}
```

Backlinks: [Architecture Boundaries](../concepts/architecture-boundaries.md).

### Segment: Client Middleware

Anchor: `pkg/app/client/middleware.go`.

Design extraction: outgoing provider calls need middleware too: timeout, retry budget, trace, metrics.

Go translation:

```go
type ProviderEndpoint func(context.Context, ChatRequest) (ChatResponse, error)

func WithProviderTrace(next ProviderEndpoint) ProviderEndpoint {
	return func(ctx context.Context, req ChatRequest) (ChatResponse, error) {
		ctx, span := tracer.Start(ctx, "provider.call")
		defer span.End()
		return next(ctx, req)
	}
}
```

Backlinks: [Observability](../concepts/observability.md).

## open-telemetry/opentelemetry-collector

### Segment: Receiver Processor Exporter

Anchor: `receiver`, `processor`, `exporter`, `component`.

Design extraction: telemetry pipeline should be built from composable components.

Go translation:

```go
type Pipeline struct {
	processors []Processor
	exporter   Exporter
}

func (p Pipeline) Handle(ctx context.Context, event TelemetryEvent) error {
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

Backlinks: [Observability](../concepts/observability.md).

### Segment: Export Queue

Anchor: `exporter/exporterhelper/internal/queue/*`.

Design extraction: exporters need retry and queue because downstream telemetry backends fail.

Go translation:

```go
func (e AsyncExporter) Export(ctx context.Context, event TelemetryEvent) error {
	select {
	case e.queue <- event:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return ErrTelemetryQueueFull
	}
}
```

Backlinks: [Concurrency And Backpressure](../concepts/concurrency-backpressure.md).

## temporalio/temporal

### Segment: Workflow History

Anchor: `service/history/*`.

Design extraction: durable execution stores event history and replays state.

Go translation:

```go
func Replay(events []WorkflowEvent) WorkflowState {
	var state WorkflowState
	for _, event := range events {
		state.Apply(event)
	}
	return state
}
```

Backlinks: [Durable Workflow](../concepts/durable-workflow.md).

### Segment: Matching And Worker

Anchor: `service/matching/*`, `service/worker/*`.

Design extraction: work should be matched to workers through queues, not tied to HTTP request lifetime.

Go translation:

```go
type TaskQueue interface {
	Poll(ctx context.Context) (Task, error)
	Complete(ctx context.Context, taskID string, result Result) error
}
```

Backlinks: [Concurrency And Backpressure](../concepts/concurrency-backpressure.md).

### Segment: Command Validation

Anchor: history command validation paths.

Design extraction: workflow commands need validation before mutating history.

Go translation:

```go
func ValidateCommand(cmd Command, state WorkflowState) error {
	if cmd.Type == CommandComplete && state.Status != Running {
		return ErrInvalidCommand
	}
	return nil
}
```

Backlinks: [Durable Workflow](../concepts/durable-workflow.md).

## nats-io/nats-server

### Segment: Subject And Subscription

Anchor: `server/sublist.go`, `server/client.go`.

Design extraction: pub/sub requires efficient subject matching and slow consumer handling.

Go translation:

```go
type Bus struct {
	subs map[string][]chan Message
}

func (b Bus) Publish(subject string, msg Message) {
	for _, sub := range b.subs[subject] {
		select {
		case sub <- msg:
		default:
			// slow consumer policy
		}
	}
}
```

Backlinks: [Concurrency And Backpressure](../concepts/concurrency-backpressure.md).

### Segment: Routing

Anchor: `server/route.go`.

Design extraction: multi-node systems need route metadata and loop prevention.

Go translation:

```go
type RoutedEvent struct {
	OriginNode string
	Subject    string
	Message    Message
}
```

Backlinks: [Architecture Boundaries](../concepts/architecture-boundaries.md).

### Segment: JetStream

Anchor: `server/jetstream.go`.

Design extraction: persistent streams turn ephemeral messages into replayable event logs.

Go translation:

```go
type Stream interface {
	Append(ctx context.Context, subject string, msg Message) (Sequence, error)
	ReadFrom(ctx context.Context, subject string, seq Sequence) ([]Message, error)
}
```

Backlinks: [Durable Workflow](../concepts/durable-workflow.md).

## study8677/awesome-architecture

### Segment: Template To Package

Anchor: `templates/*`.

Design extraction: architecture templates become Go package boundaries and tests.

Go translation:

```text
AI Gateway template
  -> internal/gateway/router
  -> internal/gateway/provider
  -> internal/gateway/fallback
  -> internal/gateway/telemetry

Agent Platform template
  -> internal/agent/session
  -> internal/agent/event
  -> internal/agent/runner
  -> internal/agent/tool
  -> internal/agent/graph
```

Local proof: `architecture_labs/*`.

Backlinks: [AI Gateway](../concepts/ai-gateway.md), [Agent Runtime](../concepts/agent-runtime.md).
