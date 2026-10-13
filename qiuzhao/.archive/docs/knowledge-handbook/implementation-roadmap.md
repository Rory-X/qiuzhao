# Implementation Roadmap

这份路线把知识手册推向下一批代码实战。它不是泛泛计划，而是从当前 `architecture_labs` 自然演进出来的实现顺序。

## Current State

Current local labs:

```text
architecture_labs/gateway       provider selection and fallback
architecture_labs/agent         session event flow
architecture_labs/rag           chunk / retrieve / rerank / citation
architecture_labs/inference     bounded batch queue
architecture_labs/realtime      sequence and idempotency
architecture_labs/notification  dedupe / limit / priority
```

## Stage 1: Strengthen Existing Labs

### Gateway

Add:

- route plan.
- fallback list.
- retryable error taxonomy.
- provider queue full error.

Test:

```go
func TestFallbackStopsOnNonRetryableError(t *testing.T) {
	err := GatewayError{Class: ErrorInvalidInput, Err: errors.New("bad request")}
	if CanFallback(err) {
		t.Fatal("invalid input should not fallback")
	}
}
```

### Agent

Add:

- `EventToolCallFailed`.
- event ID.
- replay state.

Test:

```go
func TestReplayClearsFinishedTool(t *testing.T) {
	state := Replay([]Event{
		{Type: EventToolCallStarted, ToolCallID: "t1"},
		{Type: EventToolCallFinished, ToolCallID: "t1"},
	})
	if state.RunningTools["t1"] {
		t.Fatal("tool should not be running after finish")
	}
}
```

### Inference

Add:

- token budget capacity.
- queue depth metric.
- context-aware enqueue.

Test:

```go
func TestEnqueueReturnsContextError(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	err := queue.Enqueue(ctx, Request{ID: "r1"})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context canceled, got %v", err)
	}
}
```

## Stage 2: Create `gateway_lab`

Package map:

```text
gateway_lab/
  cmd/gateway
  internal/httpapi
  internal/router
  internal/provider
  internal/fallback
  internal/ratelimit
  internal/telemetry
```

Minimum behavior:

```text
POST /v1/chat/completions
  -> auth fake tenant
  -> rate limit
  -> route provider
  -> fake provider call
  -> fallback if retryable
  -> telemetry memory exporter
```

Core interfaces:

```go
type ProviderClient interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type Router interface {
	Plan(ctx context.Context, req ChatRequest, policy TenantPolicy) (RoutePlan, error)
}

type TelemetrySink interface {
	Record(ctx context.Context, event TelemetryEvent)
}
```

First tests:

```go
func TestGatewayFallsBackToBackupProvider(t *testing.T) {}
func TestGatewayRejectsWhenRateLimited(t *testing.T) {}
func TestGatewayRecordsTelemetryForProviderCall(t *testing.T) {}
```

## Stage 3: Create `agent_runtime_lab`

Package map:

```text
agent_runtime_lab/
  internal/session
  internal/eventstore
  internal/runner
  internal/tool
  internal/graph
  internal/stream
```

Minimum behavior:

```text
append user message
  -> fake model returns tool call
  -> tool executor returns result
  -> append tool result
  -> fake model returns final answer
  -> stream all events
```

Core interfaces:

```go
type EventStore interface {
	Append(ctx context.Context, sessionID string, event Event) error
	List(ctx context.Context, sessionID string) ([]Event, error)
}

type ModelClient interface {
	Next(ctx context.Context, state State) (Step, error)
}

type ToolExecutor interface {
	Invoke(ctx context.Context, call ToolCall) (ToolResult, error)
}
```

First tests:

```go
func TestRunnerRecordsToolCallAndResult(t *testing.T) {}
func TestReplayRestoresSessionState(t *testing.T) {}
func TestRunnerStopsWhenToolFails(t *testing.T) {}
```

## Stage 4: Observability Lab

Package map:

```text
observability_lab/
  internal/telemetry
  internal/exporter/memory
  internal/processor/redact
  internal/processor/enrich
```

Pipeline:

```text
TelemetryEvent
  -> redact processor
  -> enrich processor
  -> memory exporter
```

Test:

```go
func TestTelemetryPipelineRedactsAPIKey(t *testing.T) {}
func TestTelemetryExporterReceivesProviderFields(t *testing.T) {}
```

## Stage 5: Reliability Lab

Focus:

- graceful shutdown.
- idempotency key.
- retry budget.
- dead letter queue.
- event replay after restart.

Test:

```go
func TestShutdownDrainsTelemetryWithTimeout(t *testing.T) {}
func TestDuplicateToolCallDoesNotRepeatSideEffect(t *testing.T) {}
func TestEventStoreReplayAfterRestart(t *testing.T) {}
```

## Stage 6: Capstone Implementation

Full manual: [`capstone-implementation-manual.md`](capstone-implementation-manual.md).
Real local module: [`../../capstone_ai_gateway_agent_runtime`](../../capstone_ai_gateway_agent_runtime/README.md).

Target shape:

```text
cmd/gateway
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
internal/platform/telemetry
internal/platform/lifecycle
```

The first capstone test should compose the system through public seams only:

```go
func TestCapstoneChatFallbackTelemetry(t *testing.T) {
	app := newCapstoneHarness(t,
		withTenantPolicy("demo", allowModels("gpt-demo"), allowFallbacks()),
		withProvider("primary", provider.FakeTimeout{}),
		withProvider("backup", provider.FakeSuccess{Content: "ok"}),
	)

	resp := app.PostChat(validChat("req-1", "demo", "gpt-demo"))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: %d body=%s", resp.StatusCode, resp.Body)
	}

	app.Telemetry.Assert(t, "gateway.provider_attempt", map[string]string{
		"provider": "primary",
		"error_class": "timeout",
	})
	app.Telemetry.Assert(t, "gateway.provider_attempt", map[string]string{
		"provider": "backup",
		"fallback_index": "1",
	})
}
```

Capstone is ready to start when stages 1-5 each have at least one passing failure-path test.

Current implemented proof slice:

```text
cmd/gateway      -> runnable HTTP server with lifecycle shutdown
internal/app     -> demo composition and E2E HTTP proof
gateway/core     -> policy + limiter + router + fallback executor
gateway/provider -> fake clients, registry, bounded queue
gateway/httpapi  -> thin HTTP adapter
agent/event      -> memory store and replay
agent/runner     -> scripted model command loop and tool events
platform         -> telemetry memory exporter and lifecycle shutdown
```

Run:

```bash
cd capstone_ai_gateway_agent_runtime
go test ./...
```

## Done Definition

A lab is complete when:

```text
1. It has tests for happy path and failure path.
2. It has a README explaining source inspirations.
3. It links back to knowledge-handbook.
4. It uses context for external or long-running work.
5. It has stable errors for key failure modes.
6. go test ./... passes.
7. The capstone package map links every package back to a GitHub source and a local acceptance test.
```
