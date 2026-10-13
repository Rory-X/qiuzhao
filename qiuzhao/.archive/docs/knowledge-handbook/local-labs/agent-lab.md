# Agent Lab Walkthrough

Local package: [`../../../architecture_labs/agent`](../../../architecture_labs/agent)

Architecture source:

- [AI Agent Platform template](../../architecture-to-go/templates/ai-agent-platform.md)
- [trpc-agent-go segment cards](../source-segments/large-system-segments.md#trpc-grouptrpc-agent-go)
- [Agent Runtime concept](../concepts/agent-runtime.md)
- [Durable Workflow concept](../concepts/durable-workflow.md)

## What This Lab Practices

The current lab focuses on event order and tool call lifecycle:

```text
user message
  -> tool call started
  -> tool call finished
  -> assistant message
```

This is the minimum foundation for:

- streaming UI timeline.
- audit trail.
- tool call correlation.
- future replay and recovery.

## Event Model

Current event type:

```go
type Event struct {
	Type       EventType
	Content    string
	ToolCallID string
	ToolName   string
}
```

Learning point:

- `EventType` is a defined type, not a raw string everywhere.
- `ToolCallID` links start and finish.
- This is a simplified event model; production needs event ID, session ID, timestamps and payload version.

## Test First Reading

```go
func TestSessionRecordsToolCallFlowInOrder(t *testing.T) {
	session := NewSession("session-1")

	session.AddUserMessage("find provider fallback docs")
	session.StartToolCall("tool-1", "search")
	session.FinishToolCall("tool-1", `{"results":1}`)
	session.AddAssistantMessage("I found one relevant result.")

	events := session.Events()
	if len(events) != 4 {
		t.Fatalf("expected 4 events, got %d", len(events))
	}
}
```

Why this test matters:

- It verifies the timeline is append-only.
- It verifies tool call correlation.
- It defines behavior before persistence exists.

## Implementation Reading

```go
func (s *Session) StartToolCall(id string, name string) {
	s.events = append(s.events, Event{
		Type:       EventToolCallStarted,
		ToolCallID: id,
		ToolName:   name,
	})
}
```

This is deliberately small. It does not validate state yet. That makes the event idea visible.

`Events()` copies:

```go
func (s *Session) Events() []Event {
	copied := make([]Event, len(s.events))
	copy(copied, s.events)
	return copied
}
```

Why it matters:

- Callers cannot mutate session internals.
- Event history is owned by the session.

## What Is Missing For Production

- Event ID.
- Session ID in each event.
- CreatedAt.
- Versioned payload.
- Tool failure event.
- State machine validation.
- EventStore persistence.
- Replay function.

## Next Tests

Tool failure:

```go
func TestSessionRecordsToolFailure(t *testing.T) {
	session := NewSession("s1")
	session.StartToolCall("tool-1", "search")
	session.FailToolCall("tool-1", "timeout")

	events := session.Events()
	if events[1].Type != EventToolCallFailed {
		t.Fatalf("expected tool failure, got %s", events[1].Type)
	}
}
```

Replay:

```go
func TestReplayFindsRunningTool(t *testing.T) {
	state := Replay([]Event{
		{Type: EventToolCallStarted, ToolCallID: "tool-1"},
	})

	if !state.RunningTools["tool-1"] {
		t.Fatal("expected tool-1 to be running")
	}
}
```

## Production Translation

```go
type Event struct {
	ID        string
	SessionID string
	Type      EventType
	Payload   json.RawMessage
	Version   string
	CreatedAt time.Time
}

type EventStore interface {
	Append(ctx context.Context, event Event) error
	List(ctx context.Context, sessionID string) ([]Event, error)
}
```

## Knowledge Backlinks

- [trpc-agent-go event model](../source-segments/large-system-segments.md#segment-event-model)
- [Temporal workflow history](../source-segments/large-system-segments.md#segment-workflow-history)
- [Event store and replay pattern](../go-code-patterns.md#11-event-store-and-replay)
- [Agent runtime production checklist](../production-readiness-checklist.md#agent-runtime)
