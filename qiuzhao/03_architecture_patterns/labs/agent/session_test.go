package agent

import "testing"

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

	expectedTypes := []EventType{
		EventUserMessage,
		EventToolCallStarted,
		EventToolCallFinished,
		EventAssistantMessage,
	}
	for i, want := range expectedTypes {
		if events[i].Type != want {
			t.Fatalf("event %d: expected %s, got %s", i, want, events[i].Type)
		}
	}

	if events[1].ToolCallID != "tool-1" || events[2].ToolCallID != "tool-1" {
		t.Fatalf("tool call id was not preserved: %+v", events)
	}
}
