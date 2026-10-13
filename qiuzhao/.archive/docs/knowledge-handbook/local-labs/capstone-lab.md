# Capstone Lab Walkthrough

This walkthrough reads the real local Capstone module as a knowledge artifact. The point is not just that tests pass; the point is that every passing test proves a source-to-code learning chain.

Module:

- [`../../../capstone_ai_gateway_agent_runtime/README.md`](../../../capstone_ai_gateway_agent_runtime/README.md)
- [`../../../capstone_ai_gateway_agent_runtime/go.mod`](../../../capstone_ai_gateway_agent_runtime/go.mod)

Related handbooks:

- [`../source-to-capstone-crosswalk.md`](../source-to-capstone-crosswalk.md)
- [`../capstone-implementation-manual.md`](../capstone-implementation-manual.md)
- [`../source-code-anchors-advanced.md`](../source-code-anchors-advanced.md)
- [`../production-readiness-checklist.md`](../production-readiness-checklist.md)

## 1. Gateway Fallback Path

Local code:

- [`../../../capstone_ai_gateway_agent_runtime/internal/app/demo.go`](../../../capstone_ai_gateway_agent_runtime/internal/app/demo.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/app/demo_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/app/demo_test.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service_test.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor_test.go)

Source chain:

```text
Bifrost provider routing/fallback
  -> source-code-anchors-advanced.md
  -> source-to-capstone-crosswalk.md
  -> internal/app.BuildDemo
  -> internal/gateway/core.Service
  -> TestGatewayFallbackRecordsTelemetry
  -> TestDemoChatCompletionFallsBackAndRecordsProof
```

The service has four boundaries:

```go
type Service struct {
	Policy   Authorizer
	Limiter  Limiter
	Router   Router
	Executor Executor
}
```

That shape keeps HTTP, tenant policy, route planning and provider execution separate. The test wires real in-memory implementations:

```go
service := core.Service{
	Policy:   policy.NewEngine(store),
	Limiter:  policy.NewTokenLimiter(1000),
	Router:   router.NewPlanner(registry),
	Executor: fallback.NewExecutor(registry, events),
}
```

The behavior proof is not “the function returned ok”; it proves the full route:

```text
primary provider timeout
  -> fallback allowed
  -> backup provider succeeds
  -> telemetry records primary timeout
  -> telemetry records backup success
```

`internal/app.BuildDemo` wires the same path through HTTP:

```go
registry.Replace("primary", provider.NewRuntime("primary", provider.NewBreaker(provider.FakeTimeout{}, 2)))
registry.Replace("backup", provider.NewRuntime("backup", provider.FakeSuccess{
	Name:    "backup",
	Content: "ok from backup",
}))
```

The E2E test sends a real JSON request through `http.ServeMux` and verifies response, telemetry and audit logs.

The executor also has a retry budget:

```go
executor := fallback.NewExecutor(registry, events).WithRetryBudget(1)
```

That maps the Temporal/Tyk lesson directly into code: retry and fallback are not infinite. `TestExecutorRespectsRetryBudget` proves the backup provider is not attempted once the budget is spent.

## 1.1 Request Audit And Cost Log

Local code:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/audit/log.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/audit/log.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/audit/log_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/audit/log_test.go)

Source chain:

```text
Bifrost provider usage dimensions
  -> Tyk analytics
  -> Syncthing auditability goals
  -> audit.MemoryLog
  -> TestExecutorRecordsAuditLogs
```

Learning code:

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
	CostMicros    int64
}
```

The log is intentionally structured. Cost, tokens, provider, model and fallback index are queryable fields, not loose log text.

## 2. Gateway Policy Before Provider Call

Local code:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/engine.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/engine.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/errors.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/errors.go)

Source chain:

```text
Tyk policy and quota middleware
  -> gateway admission concept
  -> policy.Engine
  -> TestGatewayRejectsDisallowedModel
```

Key rule:

```text
Invalid tenant/model/provider should fail before route planning and provider calls.
```

Learning code:

```go
if len(policy.AllowedModels) > 0 && !policy.AllowedModels[req.Model] {
	return core.TenantPolicy{}, core.GatewayError{
		Class: core.ErrorInvalidInput,
		Err:   core.ErrModelNotAllowed,
	}
}
```

This is the API gateway lesson from Tyk translated into a tiny Go package: admission comes before expensive work.

## 3. Provider Queue Backpressure

Local code:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue_test.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/breaker.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/breaker.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/breaker_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/breaker_test.go)

Source chain:

```text
Go by Example worker pool/rate limit
  -> Bifrost provider queue
  -> OTel exporter queue
  -> provider.Queue.TrySubmit
  -> TestQueueRejectsWhenFull
```

The important decision is `default`:

```go
select {
case q.jobs <- job:
	return nil
case <-ctx.Done():
	return ctx.Err()
default:
	return core.GatewayError{
		Class: core.ErrorOverloaded,
		Err:   core.ErrProviderQueueFull,
	}
}
```

Without the `default`, overload hides as latency. With it, queue full becomes a visible, testable failure mode.

The breaker adds a second protection layer:

```go
resp, err := b.next.Chat(ctx, req)
if err != nil && core.CanFallback(err) {
	b.failures++
	if b.failures >= b.limit {
		b.open = true
	}
	return core.ChatResponse{}, err
}
```

Queue full protects the local process from too much work. Breaker protects the provider path from repeated retryable failure.

## 4. Agent Event Replay

Local code:

- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph_test.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner_test.go)

Source chain:

```text
trpc-agent-go event/tool runtime
  -> Temporal event history and replay
  -> event.MemoryStore + event.Replay
  -> runner.Run
  -> TestRunnerRecordsToolFlowAndReplayCompletes
```

The runner never mutates hidden session state directly. It appends facts:

```go
UserMessage
ToolStarted
ToolFinished
AssistantMessage
RunCompleted
```

Replay derives state:

```go
case ToolStarted:
	state.RunningTools[event.ToolCallID] = ToolCall{ID: event.ToolCallID, Name: event.ToolName}
case ToolFinished:
	delete(state.RunningTools, event.ToolCallID)
case RunCompleted:
	state.Status = StatusCompleted
```

This is the durable workflow lesson in its smallest useful form.

## 4.1 Graph Node Flow And Interrupts

Source chain:

```text
trpc-agent-go GraphAgent
  -> Temporal command validation and step budget
  -> graph.Graph
  -> TestGraphRecordsTransitionAndCompletion
  -> TestGraphRecordsHumanInterrupt
```

Graph execution is explicit:

```go
graph := graph.New(store, map[string]graph.Node{
	"plan": graph.NodeFunc(func(ctx context.Context, state event.State) (graph.Result, error) {
		return graph.Result{NextNodeID: "answer"}, nil
	}),
	"answer": graph.NodeFunc(func(ctx context.Context, state event.State) (graph.Result, error) {
		return graph.Result{Complete: true}, nil
	}),
})
```

Each transition is persisted:

```go
event.Event{
	Type:       event.NodeTransitioned,
	NodeID:     current,
	NextNodeID: result.NextNodeID,
}
```

Human interrupt is not a hidden boolean in memory:

```go
event.Event{
	Type:    event.RunInterrupted,
	NodeID:  current,
	Content: result.Reason,
}
```

This gives the UI and audit layer a stable fact: the run stopped because it needs human approval.

## 5. Tool Failure Is A Timeline Event

Local code:

- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/tool/tool.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/tool/tool.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/tool/rag.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/tool/rag.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/tool/rag_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/tool/rag_test.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go)

Source chain:

```text
Learn Go with Tests fake dependencies
  -> trpc-agent-go tool execution
  -> Temporal command validation
  -> TestRunnerRecordsToolFailureEvent
```

Learning code:

```go
result, err := r.tools.Invoke(ctx, *cmd.Tool)
if err != nil {
	_ = r.events.Append(ctx, sessionID, event.Event{
		Type:       event.ToolFailed,
		ToolCallID: cmd.Tool.ID,
		ToolName:   cmd.Tool.Name,
		Content:    err.Error(),
	})
	return err
}
```

Failure does not disappear into logs. It becomes replayable state.

The RAG tool is intentionally small, but it proves the tool boundary can host local knowledge retrieval:

```go
rag := tool.NewRAGTool([]tool.Document{
	{ID: "doc-1", Title: "Gateway fallback", Content: "Provider timeout should fallback"},
}, 2)
result, err := rag.Invoke(ctx, tool.Call{Name: "rag", Input: "fallback"})
```

That maps `awesome-architecture` RAG templates into an agent tool without coupling the runner to a vector database.

## 6. Event Stream Slow Consumer Policy

Local code:

- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus_test.go)

Source chain:

```text
Memos SSE/broadcast
  -> NATS slow consumer policy
  -> stream.Bus
  -> TestBusDoesNotBlockOnSlowSubscriber
```

The core behavior is non-blocking fan-out:

```go
for _, sub := range subs {
	select {
	case sub <- evt:
	default:
		b.dropped++
	}
}
```

The durable event store remains the source of truth. The live stream may drop if a subscriber cannot keep up.

## 7. HTTP Adapter Boundary

Local code:

- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler_test.go)

Source chain:

```text
golang/example HTTP server
  -> Hertz transport boundary
  -> go-kit transport/service split
  -> core.Endpoint middleware
  -> httpapi.Handler
```

The handler knows HTTP and JSON. It does not know provider fallback:

```go
resp, err := h.service.Chat(r.Context(), req)
if err != nil {
	writeError(w, statusFor(err), err)
	return
}
writeJSON(w, http.StatusOK, resp)
```

That is the boundary rule from project-layout and go-kit made concrete.

Endpoint middleware proof:

```text
internal/gateway/core/endpoint.go
  -> TestEndpointMiddlewareWrapsServiceBoundary
  -> TestEndpointMiddlewareCanShortCircuitBeforeProviderCall
```

## 8. Telemetry Async Export

Local code:

- [`../../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async_test.go)

Source chain:

```text
OpenTelemetry Collector exporter queue
  -> Tyk analytics should not block gateway
  -> telemetry.AsyncExporter
  -> TestAsyncExporterDropsWhenQueueFull
```

Learning code:

```go
select {
case e.queue <- event:
	return nil
case <-ctx.Done():
	return ctx.Err()
default:
	e.dropped++
	return nil
}
```

Telemetry is important, but the request path should not collapse because the telemetry backend is slow.

## 9. Idempotency For External Side Effects

Local code:

- [`../../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store_test.go)

Source chain:

```text
Temporal retry safety
  -> Memos best-effort side effects
  -> Notification template idempotency key
  -> idempotency.Store
  -> TestClaimSuppressesDuplicateKey
```

Learning code:

```go
first, _ := store.Claim(ctx, "tool:session-1:call-1")
second, _ := store.Claim(ctx, "tool:session-1:call-1")
```

The first claim wins; the second is suppressed. This is the minimum safe shape before a tool writes to Slack, email, billing or a third-party API.

## 10. Lifecycle Shutdown

Local code:

- [`../../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go)

Source chain:

```text
modern-go-application startup surface
  -> Caddy module lifecycle
  -> Hertz shutdown hooks
  -> lifecycle.App
  -> TestAppShutdownsComponentsAfterContextCancel
  -> TestGracefulDrainStopsIngressBeforeWorkers
```

The minimum high-availability lesson:

```text
Root context cancels
  -> components stop receiving work
  -> Shutdown runs in reverse order
  -> ingress stops before workers drain
  -> timeout bounds cleanup
```

## 11. Config Hot Swap Validation

Local code:

- [`../../../capstone_ai_gateway_agent_runtime/internal/app/config.go`](../../../capstone_ai_gateway_agent_runtime/internal/app/config.go)
- [`../../../capstone_ai_gateway_agent_runtime/internal/app/config_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/app/config_test.go)

Source chain:

```text
Caddy dynamic config
  -> Tyk tenant/provider policy
  -> app.GatewayConfig
  -> ConfigStore.Swap
  -> TestConfigSwapRejectsUnknownProviderInTenantPolicy
  -> TestConfigSwapRecordsAuditEvent
  -> TestConfigRollbackRestoresPriorVersionAsNewVersion
```

Learning code:

```go
err := store.Swap(GatewayConfig{
	Providers: []ProviderConfig{{Name: "primary"}},
	Tenants: []core.TenantPolicy{
		{
			TenantID: "demo",
			AllowedProviders: map[core.ProviderName]bool{
				"primary": true,
				"ghost":   true,
			},
		},
	},
})
```

The invalid config must fail before it replaces the current snapshot. In a real AI gateway, this prevents a control-plane change from routing live traffic to a missing provider.

Audit and rollback code:

```go
version, err := store.SwapWithAudit("ops@example.com", next)
```

```go
rollbackVersion, err := store.Rollback("incident@example.com", 1)
```

The rollback creates a new current version instead of mutating history. That gives operators a clean audit trail when a bad provider/model policy has to be backed out during an incident.

## Run

```bash
cd capstone_ai_gateway_agent_runtime
go test ./...
```

This module is intentionally still small. The next learning step is not to add a database immediately; it is to preserve these boundaries while swapping memory implementations for Postgres/NATS/Redis/OpenTelemetry exporters.
