package runner

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"example.com/capstone-ai-gateway-agent-runtime/internal/agent/event"
	"example.com/capstone-ai-gateway-agent-runtime/internal/agent/tool"
)

func TestRunnerRecordsToolFlowAndReplayCompletes(t *testing.T) {
	store := event.NewMemoryStore()
	runner := New(
		store,
		NewScriptedModel([]Step{
			{Command: CallTool("tool-1", "search", `{"q":"docs"}`)},
			{Command: Answer("found it")},
		}),
		tool.Registry{"search": tool.FakeResult(`{"title":"doc"}`)},
	)

	if err := runner.Run(context.Background(), "session-1", "search docs"); err != nil {
		t.Fatalf("run: %v", err)
	}

	events, err := store.List(context.Background(), "session-1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	assertEventTypes(t, events, []event.EventType{
		event.UserMessage,
		event.ToolStarted,
		event.ToolFinished,
		event.AssistantMessage,
		event.RunCompleted,
	})

	state := event.Replay(events)
	if state.Status != event.StatusCompleted {
		t.Fatalf("status: %s", state.Status)
	}
	if len(state.RunningTools) != 0 {
		t.Fatalf("running tools: %+v", state.RunningTools)
	}
}

func TestRunnerRecordsToolFailureEvent(t *testing.T) {
	store := event.NewMemoryStore()
	toolErr := errors.New("search timeout")
	runner := New(
		store,
		NewScriptedModel([]Step{{Command: CallTool("tool-1", "search", `{}`)}}),
		tool.Registry{"search": tool.FakeError{Err: toolErr}},
	)

	err := runner.Run(context.Background(), "session-1", "search docs")
	if !errors.Is(err, toolErr) {
		t.Fatalf("want tool error, got %v", err)
	}

	events, _ := store.List(context.Background(), "session-1")
	assertEventTypes(t, events, []event.EventType{
		event.UserMessage,
		event.ToolStarted,
		event.ToolFailed,
	})
	if state := event.Replay(events); state.Status != event.StatusFailed {
		t.Fatalf("status: %s", state.Status)
	}
}

func assertEventTypes(t *testing.T, events []event.Event, want []event.EventType) {
	t.Helper()
	got := make([]event.EventType, 0, len(events))
	for _, event := range events {
		got = append(got, event.Type)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("event types: want %+v got %+v", want, got)
	}
}
