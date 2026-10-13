# AI Gateway + Agent Runtime Playbook

这个文件把所有 GitHub 材料收束到最终目标系统：高并发、高可用、可观测的 AI Gateway + Agent Runtime。

Related:

- [`architecture-experience-lessons.md`](architecture-experience-lessons.md)
- [`architecture-anti-patterns.md`](architecture-anti-patterns.md)
- [`production-readiness-checklist.md`](production-readiness-checklist.md)
- [`go-code-patterns.md`](go-code-patterns.md)
- [`capstone-implementation-manual.md`](capstone-implementation-manual.md)

## Target Package Map

```text
cmd/gateway

internal/gateway/httpapi
internal/gateway/auth
internal/gateway/policy
internal/gateway/ratelimit
internal/gateway/router
internal/gateway/provider
internal/gateway/fallback
internal/gateway/telemetry

internal/agent/session
internal/agent/event
internal/agent/runner
internal/agent/tool
internal/agent/graph
internal/agent/memory

internal/platform/store
internal/platform/queue
internal/platform/pubsub
internal/platform/observability
internal/platform/config
```

## Request Flow: Chat Completion

```text
client
  -> httpapi decode OpenAI-compatible request
  -> auth identify tenant
  -> policy check model/provider permission
  -> ratelimit consume request/token budget
  -> router plan primary + fallbacks
  -> provider queue/admission
  -> provider client call
  -> fallback loop if retryable
  -> normalize response
  -> telemetry export
```

Learning code:

```go
func (h Handler) Chat(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	req, err := DecodeChatRequest(r)
	if err != nil {
		WriteError(w, err)
		return
	}

	resp, err := h.gateway.Chat(ctx, req)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, resp)
}
```

Gateway core:

```go
func (g Gateway) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	tenant, err := g.auth.RequireTenant(ctx)
	if err != nil {
		return ChatResponse{}, err
	}
	if err := g.policy.Allow(tenant, req.Model); err != nil {
		return ChatResponse{}, err
	}
	if err := g.limiter.Consume(ctx, tenant.ID, req.EstimatedTokens()); err != nil {
		return ChatResponse{}, err
	}

	plan := g.router.Plan(req)
	return g.fallback.Try(ctx, plan, req)
}
```

## Request Flow: Agent Run

```text
client
  -> create or load session
  -> append user message event
  -> runner asks model for next step
  -> tool calls are emitted as events
  -> tool executor runs with timeout and audit
  -> tool results are appended
  -> graph chooses next node or final response
  -> event stream broadcasts to UI
  -> event store persists for replay
```

Learning code:

```go
func (r Runner) Run(ctx context.Context, sessionID string, input string) error {
	if err := r.events.Append(ctx, sessionID, Event{Type: EventUserMessage, Content: input}); err != nil {
		return err
	}

	for {
		state, err := r.events.Replay(ctx, sessionID)
		if err != nil {
			return err
		}

		step, err := r.model.Next(ctx, state)
		if err != nil {
			return err
		}

		if step.Final != "" {
			return r.events.Append(ctx, sessionID, Event{Type: EventAssistantMessage, Content: step.Final})
		}

		for _, call := range step.ToolCalls {
			if err := r.executeTool(ctx, sessionID, call); err != nil {
				return err
			}
		}
	}
}
```

## Reliability Rules

From Bifrost, Tyk, Temporal, NATS, Syncthing:

```text
1. Every external call has a context deadline.
2. Every queue has a capacity and overflow policy.
3. Every retry has a budget and error taxonomy.
4. Every workflow step has a stable ID.
5. Every agent event is append-only and replayable.
6. Every provider decision is observable.
7. Every side effect is either main-path or best-effort.
8. Every long-running goroutine has shutdown.
```

## Observability Fields

AI gateway telemetry:

```go
type GatewaySpanFields struct {
	TraceID       string
	TenantID      string
	RequestID     string
	Model         string
	Provider      string
	FallbackIndex int
	LatencyMS     int64
	InputTokens   int
	OutputTokens  int
	ErrorClass    string
}
```

Agent runtime telemetry:

```go
type AgentSpanFields struct {
	TraceID    string
	SessionID  string
	RunID      string
	NodeID     string
	ToolCallID string
	EventID    string
	LatencyMS  int64
	ErrorClass string
}
```

## Testing Ladder

```text
Unit tests:
  router, limiter, fallback taxonomy, event replay

Integration tests:
  HTTP handler -> gateway -> fake provider
  runner -> fake model -> fake tool -> event store

Concurrency tests:
  queue full, context cancel, worker shutdown

Observability tests:
  telemetry exporter receives provider/model/error fields

Failure tests:
  provider timeout, non-retryable 400, tool failure, duplicate event
```

Example test:

```go
func TestFallbackStopsOnInvalidInput(t *testing.T) {
	gateway := NewGateway(
		WithProvider("primary", failingProvider(GatewayError{Class: ErrorInvalidInput, Err: errors.New("bad request")})),
		WithProvider("backup", successfulProvider()),
	)

	_, err := gateway.Chat(context.Background(), ChatRequest{
		Provider: "primary",
		Fallbacks: []Route{{Provider: "backup"}},
	})
	if err == nil {
		t.Fatal("expected invalid input error")
	}
	if gateway.Attempts() != 1 {
		t.Fatalf("expected no fallback for invalid input, got %d attempts", gateway.Attempts())
	}
}
```

## Source To Final System Map

| Source | Final system capability |
|---|---|
| Bifrost | provider routing, fallback, provider queues, observability |
| trpc-agent-go | agent interface, event stream, tool call, graph agent |
| Tyk | auth, policy, rate limit, analytics pipeline |
| Hertz | high-throughput HTTP boundary and middleware |
| OpenTelemetry Collector | telemetry receiver/processor/exporter |
| Temporal | durable history, replay, worker/task queue |
| NATS | pub/sub, fan-out, slow consumer, persistent stream |
| Caddy | provider/plugin module lifecycle and admin config |
| Memos | server lifecycle, background runner, best-effort side effects |
| Syncthing | goals-first design, protocol stability, long-running state |
| go-kit | service/endpoint/transport split |
| Wild Workouts | domain invariants and repository update closure |
