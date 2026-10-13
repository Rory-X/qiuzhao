# Real Project Segment Cards

These cards extract durable product architecture lessons from real Go systems.

## pocketbase/pocketbase

### Segment: Standalone App And Hooks

Anchor: `examples/base/main.go`, `pocketbase.go`.

Design extraction: product core stays stable; custom behavior enters through hooks.

Go translation:

```go
type GatewayApp struct {
	hooks []func(context.Context, *GatewayRequest) error
}

func (a *GatewayApp) BeforeProviderCall(fn func(context.Context, *GatewayRequest) error) {
	a.hooks = append(a.hooks, fn)
}

func (a GatewayApp) runHooks(ctx context.Context, req *GatewayRequest) error {
	for _, hook := range a.hooks {
		if err := hook(ctx, req); err != nil {
			return err
		}
	}
	return nil
}
```

Local proof: Capstone endpoint middleware and fallback audit hook point in [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint_test.go) and [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go).

Backlinks: [AI Gateway](../concepts/ai-gateway.md).

### Segment: Route Aggregation

Anchor: `apis/base.go`.

Design extraction: product APIs should be registered from one composition point, not scattered.

Go translation:

```go
func RegisterRoutes(mux *http.ServeMux, deps Deps) {
	RegisterHealthRoutes(mux, deps.Health)
	RegisterGatewayRoutes(mux, deps.Gateway)
	RegisterAgentRoutes(mux, deps.Agent)
	RegisterAdminRoutes(mux, deps.Admin)
}
```

Backlinks: [Architecture Boundaries](../concepts/architecture-boundaries.md).

## usememos/memos

### Segment: Server Lifecycle

Anchor: `cmd/memos/main.go`, `server/server.go`.

Design extraction: product server composes HTTP, static assets, API, background runners, shutdown.

Go translation:

```go
type ProductServer struct {
	httpServer *http.Server
	runners    []Runner
}

func (s ProductServer) Run(ctx context.Context) error {
	group, ctx := errgroup.WithContext(ctx)
	group.Go(func() error { return s.httpServer.ListenAndServe() })
	for _, runner := range s.runners {
		r := runner
		group.Go(func() error { return r.Run(ctx) })
	}
	return group.Wait()
}
```

Local proof: Capstone lifecycle runner and drain-order tests in [`../../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go).

Backlinks: [Architecture Boundaries](../concepts/architecture-boundaries.md), [Concurrency And Backpressure](../concepts/concurrency-backpressure.md).

### Segment: Main Path And Best-Effort Effects

Anchor: `server/router/api/v1/memo_service.go`.

Design extraction: create operations often have main persistence plus secondary side effects.

Go translation:

```go
func (s Service) AppendAgentEvent(ctx context.Context, event Event) error {
	if err := s.store.Append(ctx, event); err != nil {
		return err
	}
	if err := s.broadcast.Publish(ctx, event); err != nil {
		s.log.Warn("broadcast agent event", "event_id", event.ID, "err", err)
	}
	return nil
}
```

Backlinks: [Agent Runtime](../concepts/agent-runtime.md), [Durable Workflow](../concepts/durable-workflow.md).

## caddyserver/caddy

### Segment: Module Registry

Anchor: `modules.go`.

Design extraction: modules need identity, config, provision, validation and cleanup.

Go translation:

```go
type ModuleInfo struct {
	ID  string
	New func() Module
}

type Module interface {
	Provision(context.Context) error
	Validate() error
	Cleanup() error
}
```

Local proof: Capstone config validation and lifecycle tests in [`../../../capstone_ai_gateway_agent_runtime/internal/app/config_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/app/config_test.go) and [`../../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go).

Backlinks: [AI Gateway](../concepts/ai-gateway.md).

### Segment: Dynamic Admin Config

Anchor: `admin.go`, `caddy.go`.

Design extraction: runtime config changes should go through validation and lifecycle, not raw mutation.

Go translation:

```go
func (a Admin) UpdateProvider(ctx context.Context, cfg ProviderConfig) error {
	next, err := a.factory.Build(cfg)
	if err != nil {
		return err
	}
	if err := next.Validate(); err != nil {
		return err
	}
	return a.manager.Replace(ctx, next)
}
```

Backlinks: [Architecture Boundaries](../concepts/architecture-boundaries.md).

## syncthing/syncthing

### Segment: Goals Before Architecture

Anchor: `GOALS.md`.

Design extraction: state explicit priorities before technical design.

Go translation:

```text
AI Gateway + Agent Runtime goals:
1. Do not lose session events.
2. Do not let provider failures exhaust concurrency.
3. Preserve tenant quota and cost controls.
4. Make every routing/tool decision observable.
5. Keep protocol compatibility.
```

Local proof: [AI Gateway + Agent Runtime Playbook](../ai-gateway-agent-runtime-playbook.md).

Backlinks: [Durable Workflow](../concepts/durable-workflow.md).

### Segment: Protocol Boundary

Anchor: `lib/protocol/protocol.go`.

Design extraction: stable protocol types outlive internal handlers.

Go translation:

```go
type AgentStreamEvent struct {
	Version   string          `json:"version"`
	ID        string          `json:"id"`
	SessionID string          `json:"session_id"`
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
}
```

Backlinks: [Agent Runtime](../concepts/agent-runtime.md).

### Segment: Long-Running Model State

Anchor: `lib/model/model.go`.

Design extraction: complex long-running systems aggregate config, DB, events, runners, connections, stats and errors. Avoid spreading state across global variables.

Go translation:

```go
type Runtime struct {
	config  ConfigStore
	events  EventStore
	runners RunnerRegistry
	pubsub  EventBus
	stats   Stats
}
```

Backlinks: [Architecture Boundaries](../concepts/architecture-boundaries.md).
