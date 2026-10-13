# Practice Workbook

这份 workbook 把知识手册变成动手练习。每个练习都有来源、目标、测试骨架、实现骨架和验收标准。

## How To Use

```text
1. Pick one exercise.
2. Copy the test skeleton into the target lab.
3. Make the test fail.
4. Implement the smallest code.
5. Run go test ./...
6. Add notes back to the related concept page.
```

## Exercise 1: Gateway Route Plan

Sources:

- Bifrost fallback segments.
- Tyk policy segments.
- `architecture_labs/gateway`.

Target: `architecture_labs/gateway`.

Goal: move from single `Select(preferred)` to a route plan that contains primary and fallbacks.

Test skeleton:

```go
func TestRouterBuildsRoutePlan(t *testing.T) {
	router := NewRouter([]Provider{
		{Name: "openai", Healthy: true},
		{Name: "anthropic", Healthy: true},
		{Name: "mock", Healthy: true},
	})

	plan, err := router.Plan(RouteRequest{
		Preferred: "openai",
		Fallbacks: []string{"anthropic", "mock"},
	})
	if err != nil {
		t.Fatalf("plan: %v", err)
	}
	if len(plan.Attempts) != 3 {
		t.Fatalf("expected 3 attempts, got %d", len(plan.Attempts))
	}
}
```

Implementation skeleton:

```go
type RouteRequest struct {
	Preferred string
	Fallbacks []string
}

type RoutePlan struct {
	Attempts []Provider
}

func (r Router) Plan(req RouteRequest) (RoutePlan, error) {
	// First add preferred when healthy.
	// Then add configured healthy fallbacks.
	// Return ErrNoHealthyProvider when empty.
	return RoutePlan{}, nil
}
```

Done when:

- preferred healthy is first.
- unhealthy fallback is skipped.
- no healthy provider returns stable error.

Backlinks:

- [Gateway Lab](local-labs/gateway-lab.md)
- [AI Gateway Concept](concepts/ai-gateway.md)

## Exercise 2: Gateway Error Taxonomy

Target: `architecture_labs/gateway`.

Goal: define retryable vs non-retryable provider errors.

Test skeleton:

```go
func TestCanFallbackByErrorClass(t *testing.T) {
	tests := []struct {
		class ErrorClass
		want  bool
	}{
		{ErrorTimeout, true},
		{ErrorProviderUnavailable, true},
		{ErrorRateLimited, true},
		{ErrorInvalidInput, false},
		{ErrorUnauthorized, false},
	}

	for _, tt := range tests {
		err := GatewayError{Class: tt.class, Err: errors.New(string(tt.class))}
		if got := CanFallback(err); got != tt.want {
			t.Fatalf("%s: want %v got %v", tt.class, tt.want, got)
		}
	}
}
```

Implementation skeleton:

```go
type ErrorClass string

const (
	ErrorTimeout             ErrorClass = "timeout"
	ErrorProviderUnavailable ErrorClass = "provider_unavailable"
	ErrorRateLimited         ErrorClass = "rate_limited"
	ErrorInvalidInput        ErrorClass = "invalid_input"
	ErrorUnauthorized        ErrorClass = "unauthorized"
)

type GatewayError struct {
	Class ErrorClass
	Err   error
}

func (e GatewayError) Error() string { return e.Err.Error() }
func (e GatewayError) Unwrap() error { return e.Err }
```

Done when:

- `errors.As` works with `GatewayError`.
- invalid input and unauthorized do not fallback.

## Exercise 3: Agent Tool Failure Event

Target: `architecture_labs/agent`.

Goal: add failure event to tool lifecycle.

Test skeleton:

```go
func TestSessionRecordsToolFailure(t *testing.T) {
	session := NewSession("s1")
	session.AddUserMessage("search")
	session.StartToolCall("tool-1", "search")
	session.FailToolCall("tool-1", "timeout")

	events := session.Events()
	if events[2].Type != EventToolCallFailed {
		t.Fatalf("expected failure event, got %s", events[2].Type)
	}
	if events[2].ToolCallID != "tool-1" {
		t.Fatal("tool call id should be preserved")
	}
}
```

Implementation skeleton:

```go
const EventToolCallFailed EventType = "tool_call_failed"

func (s *Session) FailToolCall(id string, reason string) {
	s.events = append(s.events, Event{
		Type:       EventToolCallFailed,
		ToolCallID: id,
		Content:    reason,
	})
}
```

Done when:

- tool failure is visible in timeline.
- tool call ID is preserved.
- `Events()` remains copy-safe.

## Exercise 4: Agent Replay

Target: `architecture_labs/agent`.

Goal: reconstruct session state from events.

Test skeleton:

```go
func TestReplaySessionState(t *testing.T) {
	events := []Event{
		{Type: EventUserMessage, Content: "hi"},
		{Type: EventToolCallStarted, ToolCallID: "t1"},
		{Type: EventToolCallFinished, ToolCallID: "t1"},
		{Type: EventAssistantMessage, Content: "done"},
	}

	state := Replay(events)
	if state.UserMessages != 1 {
		t.Fatalf("expected 1 user message")
	}
	if len(state.RunningTools) != 0 {
		t.Fatalf("expected no running tools")
	}
}
```

Implementation skeleton:

```go
type SessionState struct {
	UserMessages int
	AssistantMessages int
	RunningTools map[string]bool
}

func Replay(events []Event) SessionState {
	state := SessionState{RunningTools: map[string]bool{}}
	for _, event := range events {
		switch event.Type {
		case EventUserMessage:
			state.UserMessages++
		case EventAssistantMessage:
			state.AssistantMessages++
		case EventToolCallStarted:
			state.RunningTools[event.ToolCallID] = true
		case EventToolCallFinished, EventToolCallFailed:
			delete(state.RunningTools, event.ToolCallID)
		}
	}
	return state
}
```

Done when:

- replay handles started, finished and failed tool calls.

## Exercise 5: Token-Based Inference Queue

Target: `architecture_labs/inference`.

Goal: queue capacity by token count, not request count.

Test skeleton:

```go
func TestTokenQueueRejectsWhenTokenBudgetExceeded(t *testing.T) {
	queue := NewTokenQueue(100)
	if err := queue.Enqueue(Request{ID: "r1", Tokens: 70}); err != nil {
		t.Fatalf("enqueue r1: %v", err)
	}
	if err := queue.Enqueue(Request{ID: "r2", Tokens: 40}); err != ErrQueueFull {
		t.Fatalf("expected queue full, got %v", err)
	}
}
```

Implementation skeleton:

```go
type TokenQueue struct {
	tokenCapacity int
	tokenUsed     int
	items         []Request
}

func (q *TokenQueue) Enqueue(req Request) error {
	if q.tokenUsed+req.Tokens > q.tokenCapacity {
		return ErrQueueFull
	}
	q.tokenUsed += req.Tokens
	q.items = append(q.items, req)
	return nil
}
```

## Exercise 6: Realtime Ack

Target: `architecture_labs/realtime`.

Goal: add per-user ack tracking.

Test skeleton:

```go
func TestConversationTracksAck(t *testing.T) {
	conversation := NewConversation("c1")
	msg := conversation.Accept("client-1", "hello")

	conversation.Ack("user-1", msg.Seq)

	if got := conversation.LastAck("user-1"); got != msg.Seq {
		t.Fatalf("expected ack %d, got %d", msg.Seq, got)
	}
}
```

Implementation skeleton:

```go
type Conversation struct {
	acks map[string]int64
}

func (c *Conversation) Ack(userID string, seq int64) {
	if seq > c.acks[userID] {
		c.acks[userID] = seq
	}
}
```

## Exercise 7: Notification Idempotency Key

Target: `architecture_labs/notification`.

Goal: separate notification ID from external delivery idempotency key.

Test skeleton:

```go
func TestPipelineSuppressesDuplicateIdempotencyKey(t *testing.T) {
	pipeline := NewPipeline(10)
	first := Notification{ID: "n1", UserID: "u1", IdempotencyKey: "email:u1:welcome"}
	second := Notification{ID: "n2", UserID: "u1", IdempotencyKey: "email:u1:welcome"}

	if !pipeline.Accept(first) {
		t.Fatal("expected first accepted")
	}
	if pipeline.Accept(second) {
		t.Fatal("expected duplicate idempotency key suppressed")
	}
}
```

Implementation skeleton:

```go
type Notification struct {
	ID             string
	UserID         string
	IdempotencyKey string
	Priority       int
	Body           string
}
```

## Exercise 8: Telemetry Memory Exporter

Target: `capstone_ai_gateway_agent_runtime/internal/platform/telemetry`.

Goal: implement a telemetry pipeline with processor and exporter.

Test skeleton:

```go
func TestPipelineExportsProviderLatency(t *testing.T) {
	exporter := NewMemoryExporter()
	pipeline := NewPipeline(exporter)

	err := pipeline.Handle(context.Background(), TelemetryEvent{
		Name: "provider.call",
		Provider: "openai",
		LatencyMS: 120,
	})
	if err != nil {
		t.Fatalf("handle telemetry: %v", err)
	}

	events := exporter.Events()
	if events[0].Provider != "openai" {
		t.Fatalf("expected provider openai")
	}
}
```

Implementation skeleton:

```go
type MemoryExporter struct {
	mu     sync.Mutex
	events []TelemetryEvent
}

func (e *MemoryExporter) Export(ctx context.Context, event TelemetryEvent) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.events = append(e.events, event)
	return nil
}
```

## Exercise 9: Gateway HTTP Integration

Target: `capstone_ai_gateway_agent_runtime/internal/gateway/httpapi` and `internal/gateway/core`.

Goal: HTTP handler -> gateway usecase -> fake provider.

Test skeleton:

```go
func TestChatHTTPReturnsProviderResponse(t *testing.T) {
	handler := NewHandler(NewGateway(FakeProvider{
		Response: ChatResponse{Content: "hello"},
	}))

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"mock"}`))
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
```

Done when:

- no real network.
- handler test proves decode/usecase/encode.

## Exercise 10: Agent Runner Integration

Target: `capstone_ai_gateway_agent_runtime/internal/agent/runner`.

Goal: fake model returns tool call, fake tool returns result, runner records events.

Test skeleton:

```go
func TestRunnerRecordsToolCallAndFinalAnswer(t *testing.T) {
	store := NewMemoryEventStore()
	runner := NewRunner(
		store,
		FakeModel{
			Steps: []Step{
				{ToolCalls: []ToolCall{{ID: "t1", Name: "search"}}},
				{Final: "done"},
			},
		},
		FakeTools{"search": `{"ok":true}`},
	)

	if err := runner.Run(context.Background(), "s1", "search docs"); err != nil {
		t.Fatalf("run: %v", err)
	}

	events, _ := store.List(context.Background(), "s1")
	if len(events) < 4 {
		t.Fatalf("expected event timeline, got %+v", events)
	}
}
```

## Exercise 11: Capstone Gateway Acceptance

Target: final Capstone project.

Source links:

- [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)
- [`capstone-implementation-manual.md`](capstone-implementation-manual.md)

Goal: prove tenant policy, provider fallback and telemetry work in one request path.

Test skeleton:

```go
func TestCapstoneGatewayFallbackPath(t *testing.T) {
	app := newCapstoneHarness(t,
		withPolicy(policy.TenantPolicy{
			TenantID: "demo",
			AllowedModels: map[gateway.ModelName]bool{
				"gpt-demo": true,
			},
			AllowedProviders: map[gateway.ProviderName]bool{
				"primary": true,
				"backup": true,
			},
			AllowFallbacks: true,
		}),
		withProvider("primary", provider.FakeTimeout{}),
		withProvider("backup", provider.FakeSuccess{Content: "ok"}),
	)

	resp := app.PostChat(gateway.ChatRequest{
		RequestID: "req-1",
		TenantID: "demo",
		Model: "gpt-demo",
		Messages: []gateway.Message{{Role: "user", Content: "hi"}},
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
		"fallback_index": "1",
	})
}
```

Done when:

- invalid tenant/model returns stable error.
- timeout falls back.
- telemetry includes tenant/model/provider/error_class/fallback_index.

## Exercise 12: Capstone Agent Acceptance

Target: final Capstone project.

Goal: prove user input, model decision, tool call, tool result, final answer and stream events form a replayable timeline.

Test skeleton:

```go
func TestCapstoneAgentToolFlowReplay(t *testing.T) {
	store := event.NewMemoryStore()
	runner := runner.New(runner.Deps{
		Events: store,
		Model: runner.ScriptedModel{
			Steps: []runner.Step{
				{Command: runner.CallTool("tool-1", "search", `{"q":"docs"}`)},
				{Command: runner.Answer("found it")},
			},
		},
		Tools: tool.Registry{
			"search": tool.FakeResult(`{"title":"doc"}`),
		},
	})

	if err := runner.Run(context.Background(), "session-1", "search docs"); err != nil {
		t.Fatalf("run: %v", err)
	}

	events, err := store.List(context.Background(), "session-1")
	if err != nil {
		t.Fatalf("list events: %v", err)
	}
	assertEventTypes(t, events,
		event.UserMessage,
		event.ToolStarted,
		event.ToolFinished,
		event.AssistantMessage,
		event.RunCompleted,
	)

	state := event.Replay(events)
	if state.Status != event.StatusCompleted {
		t.Fatalf("status: %s", state.Status)
	}
}
```

Done when:

- every mutation is an event.
- replay restores terminal state.
- tool failure creates `ToolFailed` and does not silently vanish.

## Workbook Progress Checklist

```text
[ ] Gateway Route Plan
[ ] Gateway Error Taxonomy
[ ] Agent Tool Failure Event
[ ] Agent Replay
[ ] Token-Based Inference Queue
[ ] Realtime Ack
[ ] Notification Idempotency Key
[ ] Telemetry Memory Exporter
[ ] Gateway HTTP Integration
[ ] Agent Runner Integration
[ ] Capstone Gateway Acceptance
[ ] Capstone Agent Acceptance
```
