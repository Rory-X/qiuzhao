# Structure Segment Cards

These cards turn project layout and style material into concrete Go design habits.

## golang-standards/project-layout

### Segment: `cmd`

Anchor: `cmd/README.md`.

Design extraction: `cmd` is an executable entry, not a business package.

Go translation:

```go
func main() {
	cfg := LoadConfig()
	app := BuildApp(cfg)
	if err := app.Run(context.Background()); err != nil {
		log.Fatal(err)
	}
}
```

Local proof: `api_service/cmd/api/main.go`, `capstone_ai_gateway_agent_runtime/cmd/gateway`.

Backlinks: [Architecture Boundaries](../concepts/architecture-boundaries.md).

### Segment: `internal`

Anchor: `internal/README.md`.

Design extraction: `internal` is the default home for business implementation. It prevents accidental external dependency.

Go translation:

```text
internal/gateway/router
internal/gateway/provider
internal/agent/session
internal/platform/observability
```

Local proof: `api_service/internal`.

Backlinks: [Architecture Boundaries](../concepts/architecture-boundaries.md).

### Segment: `pkg`

Anchor: `pkg/README.md`.

Design extraction: `pkg` means public reusable API. Avoid it until you are ready to support external importers.

Go translation:

```text
Do not start with:
pkg/gateway
pkg/agent

Start with:
internal/gateway
internal/agent
```

Local proof: current workspace does not create unnecessary `pkg`.

## uber-go/guide

### Segment: Error Wrapping

Anchor: `src/error-wrap.md`.

Design extraction: errors crossing layers need context and optional unwrap.

Go translation:

```go
func (c Client) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	resp, err := c.transport.Send(ctx, req)
	if err != nil {
		return ChatResponse{}, fmt.Errorf("provider %s chat: %w", c.name, err)
	}
	return resp, nil
}
```

Local proof: Capstone `TestErrorClassOfFindsWrappedGatewayError` uses wrapped `GatewayError` and proves classification through `errors.As`.

Backlinks: [AI Gateway](../concepts/ai-gateway.md).

### Segment: Channel Size

Anchor: `src/channel-size.md`.

Design extraction: channel capacity should document a throughput/backpressure decision.

Go translation:

```go
const providerQueueCapacity = 128 // maximum queued calls before overload shedding

jobs := make(chan ProviderJob, providerQueueCapacity)
```

Local proof: `architecture_labs/inference.NewBatchQueue(capacity)`.

Backlinks: [Concurrency And Backpressure](../concepts/concurrency-backpressure.md).

### Segment: Container Copy

Anchor: `src/container-copy.md`.

Design extraction: slice/map crossing a boundary should not expose mutable internals.

Go translation:

```go
func (r Registry) List() []ProviderInfo {
	out := make([]ProviderInfo, len(r.providers))
	copy(out, r.providers)
	return out
}
```

Local proof: `agent.Events()`, `realtime.Messages()`.

## google/styleguide Go

### Segment: Small Interface

Anchor: `go/best-practices.md`.

Design extraction: interfaces are consumer contracts. Large interfaces make testing and evolution harder.

Go translation:

```go
type EventReader interface {
	List(ctx context.Context, sessionID string) ([]Event, error)
}

type EventWriter interface {
	Append(ctx context.Context, sessionID string, event Event) error
}
```

Local proof: `capstone_ai_gateway_agent_runtime/internal/agent/event` keeps event append/list behind a store interface.

Backlinks: [Agent Runtime](../concepts/agent-runtime.md).

### Segment: Comment Why

Anchor: `go/guide.md`, `go/decisions.md`.

Design extraction: comments should explain non-obvious decisions, especially concurrency and reliability choices.

Go translation:

```go
// Drop telemetry rather than blocking the request path. The dropped counter
// is exported so overload is visible.
func (s Sink) Record(event TelemetryEvent) {
	select {
	case s.queue <- event:
	default:
		s.dropped.Add(1)
	}
}
```

Backlinks: [Observability](../concepts/observability.md).

## sagikazarmark/modern-go-application

### Segment: Production Startup Surface

Anchor: `cmd/modern-go-application/main.go`.

Design extraction: real startup composes config, logging, health, telemetry, DB, HTTP, workers.

Go translation:

```go
type App struct {
	HTTP      *http.Server
	Workers   []Runner
	Telemetry Telemetry
}

func (a App) Run(ctx context.Context) error {
	group, ctx := errgroup.WithContext(ctx)
	group.Go(func() error { return a.HTTP.ListenAndServe() })
	for _, worker := range a.Workers {
		w := worker
		group.Go(func() error { return w.Run(ctx) })
	}
	return group.Wait()
}
```

Local proof: `capstone_ai_gateway_agent_runtime/cmd/gateway` and `internal/platform/lifecycle`.

Backlinks: [Observability](../concepts/observability.md), [Architecture Boundaries](../concepts/architecture-boundaries.md).

### Segment: Platform Package

Anchor: `internal/platform/*`.

Design extraction: platform dependencies should be isolated from business packages.

Go translation:

```text
internal/platform/store
internal/platform/queue
internal/platform/observability
internal/gateway/router
internal/agent/runner
```

Local proof: target package map in [AI Gateway + Agent Runtime Playbook](../ai-gateway-agent-runtime-playbook.md).
