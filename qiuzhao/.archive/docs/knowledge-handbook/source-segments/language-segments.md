# Language Segment Cards

These cards connect language learning repositories to concrete Go patterns used later in gateway and agent systems.

## go101/go101

### Segment: Interface And Method Set

Anchor: `pages/fundamentals`, `pages/generics`, `README.md`.

What to read: interface value, method set, receiver type, type parameter constraints.

Design extraction: provider/client abstractions depend on method sets. If a method uses pointer receiver, only pointer values implement the interface. This matters when provider clients keep connection pools or mutable metrics.

Go translation:

```go
type ProviderClient interface {
	Chat(context.Context, ChatRequest) (ChatResponse, error)
}

type OpenAIClient struct {
	http *http.Client
}

func (c *OpenAIClient) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	return ChatResponse{}, nil
}

var _ ProviderClient = (*OpenAIClient)(nil)
```

Local proof: Capstone provider client interface and fake implementations in [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/client.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/client.go).

Backlinks: [Architecture Boundaries](../concepts/architecture-boundaries.md), [AI Gateway](../concepts/ai-gateway.md).

### Segment: Slice And Map Boundary

Anchor: `pages/fundamentals` collection/type semantics.

What to read: slice header, shared underlying array, map reference behavior.

Design extraction: returning internal slices/maps leaks mutable state. Event histories and message lists must be copied before returning.

Go translation:

```go
func (s *Session) Events() []Event {
	out := make([]Event, len(s.events))
	copy(out, s.events)
	return out
}

func (r *Registry) Providers() map[string]ProviderInfo {
	out := make(map[string]ProviderInfo, len(r.providers))
	for key, value := range r.providers {
		out[key] = value
	}
	return out
}
```

Local proof: `architecture_labs/agent.Session.Events()` already copies events.

Backlinks: [Agent Runtime](../concepts/agent-runtime.md).

## quii/learn-go-with-tests

### Segment: Behavior First

Anchor: `arrays/*`, `concurrency/*`, `context.md`, `http-server.md`.

What to read: tests name behavior before implementation exists.

Design extraction: gateway routing and agent event flow should start with tests. If the behavior cannot be expressed in a test, the abstraction is probably not clear yet.

Go translation:

```go
func TestToolCallLifecycle(t *testing.T) {
	session := NewSession("s1")

	require.NoError(t, session.StartToolCall("tool-1", "search"))
	require.NoError(t, session.FinishToolCall("tool-1", "result"))

	events := session.Events()
	require.Equal(t, EventToolCallStarted, events[0].Type)
	require.Equal(t, EventToolCallFinished, events[1].Type)
}
```

Local proof: all current `architecture_labs` packages are test-first style.

Backlinks: [Agent Runtime](../concepts/agent-runtime.md).

### Segment: Dependency As Function Or Interface

Anchor: `concurrency/*`.

What to read: fake website checker instead of real network calls.

Design extraction: tests should not depend on real providers, vector DBs, or external tool APIs.

Go translation:

```go
type ProviderFunc func(context.Context, ChatRequest) (ChatResponse, error)

func (f ProviderFunc) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	return f(ctx, req)
}
```

Local proof: use fake providers in gateway tests.

Backlinks: [AI Gateway](../concepts/ai-gateway.md).

## mmcgrana/gobyexample

### Segment: Channel Direction

Anchor: `examples/channel-directions`.

What to read: function signatures restrict channel capability.

Design extraction: event producers should not be able to read from broadcast channels; consumers should not send into system-owned channels.

Go translation:

```go
func publish(out chan<- Event, event Event) {
	out <- event
}

func consume(in <-chan Event, handle func(Event)) {
	for event := range in {
		handle(event)
	}
}
```

Local proof: Capstone stream bus exposes subscription ownership and proves slow consumers do not block publishers in [`../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus_test.go).

Backlinks: [Concurrency And Backpressure](../concepts/concurrency-backpressure.md).

### Segment: Rate Limiting

Anchor: `examples/rate-limiting`.

What to read: limiter channel/ticker shape.

Design extraction: API gateway rate limits are admission decisions, not after-the-fact logs.

Go translation:

```go
func (l *Limiter) Allow(ctx context.Context, key string) error {
	select {
	case <-l.bucketFor(key):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return ErrRateLimited
	}
}
```

Local proof: Capstone token admission in [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/limiter.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/limiter.go), plus endpoint short-circuit proof in `TestEndpointMiddlewareCanShortCircuitBeforeProviderCall`.

Backlinks: [AI Gateway](../concepts/ai-gateway.md), [Concurrency And Backpressure](../concepts/concurrency-backpressure.md).

### Segment: Worker Pool

Anchor: `examples/worker-pools`.

What to read: fixed workers consume jobs from a queue.

Design extraction: provider calls need bounded concurrency. A worker pool without a bounded queue only moves overload elsewhere.

Go translation:

```go
func StartWorkers(ctx context.Context, n int, jobs <-chan ProviderJob, provider ProviderClient) {
	for i := 0; i < n; i++ {
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case job := <-jobs:
					_, _ = provider.Chat(ctx, job.Request)
				}
			}
		}()
	}
}
```

Local proof: `architecture_labs/inference` currently practices bounded admission.

Backlinks: [Concurrency And Backpressure](../concepts/concurrency-backpressure.md).

## golang/example

### Segment: Minimal HTTP Server

Anchor: `helloserver/server.go`.

What to read: small handler with standard library HTTP.

Design extraction: start with standard library to learn boundaries. Frameworks can come later.

Go translation:

```go
func NewMux(handler Handler) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handler.Health)
	mux.HandleFunc("POST /resources", handler.CreateResource)
	return mux
}
```

Local proof: `api_service/internal/httpapi`.

Backlinks: [Architecture Boundaries](../concepts/architecture-boundaries.md).

### Segment: Background State

Anchor: `outyet/main.go`.

What to read: long-running state, locks, background update loop, test hooks.

Design extraction: provider health checks and pricing refreshers are background state, but must have locks and shutdown.

Go translation:

```go
type HealthRegistry struct {
	mu       sync.RWMutex
	healthy map[string]bool
}

func (r *HealthRegistry) Set(provider string, healthy bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.healthy[provider] = healthy
}
```

Local proof: Capstone router health filtering and scoring in [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/router/scoring_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/router/scoring_test.go).

Backlinks: [AI Gateway](../concepts/ai-gateway.md), [Concurrency And Backpressure](../concepts/concurrency-backpressure.md).

## inancgumus/learngo

### Segment: Defined Types

Anchor: `09-go-type-system`.

What to read: custom defined types and methods.

Design extraction: strings like `"tool_started"` should become typed constants with helper methods.

Go translation:

```go
type EventType string

func (t EventType) IsTerminal() bool {
	return t == EventRunCompleted || t == EventRunFailed
}
```

Local proof: `architecture_labs/agent.EventType`.

Backlinks: [Agent Runtime](../concepts/agent-runtime.md).
