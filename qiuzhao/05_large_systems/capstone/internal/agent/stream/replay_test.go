package stream

import (
	"context"
	"testing"

	"example.com/capstone-ai-gateway-agent-runtime/internal/agent/event"
)

func TestStreamReplayFromCursorFillsDroppedEvents(t *testing.T) {
	store := event.NewMemoryStore()
	_ = store.Append(context.Background(), "session-1", event.Event{Type: event.UserMessage, Content: "one"})
	_ = store.Append(context.Background(), "session-1", event.Event{Type: event.AssistantMessage, Content: "two"})
	_ = store.Append(context.Background(), "session-1", event.Event{Type: event.UserMessage, Content: "three"})

	var replayed []event.Event
	err := ReplayFrom(context.Background(), store, Cursor{SessionID: "session-1", Offset: 1}, func(evt event.Event) error {
		replayed = append(replayed, evt)
		return nil
	})
	if err != nil {
		t.Fatalf("replay: %v", err)
	}
	if len(replayed) != 2 {
		t.Fatalf("replayed: %+v", replayed)
	}
	if replayed[0].Content != "two" || replayed[1].Content != "three" {
		t.Fatalf("replayed: %+v", replayed)
	}
}
