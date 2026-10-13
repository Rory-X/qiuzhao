package stream

import (
	"testing"
	"time"

	"example.com/capstone-ai-gateway-agent-runtime/internal/agent/event"
)

func TestBusDoesNotBlockOnSlowSubscriber(t *testing.T) {
	bus := NewBus()
	sub := bus.Subscribe("session-1", 1)

	bus.Publish("session-1", event.Event{ID: "event-1", Type: event.UserMessage})
	bus.Publish("session-1", event.Event{ID: "event-2", Type: event.AssistantMessage})

	select {
	case got := <-sub:
		if got.ID != "event-1" {
			t.Fatalf("first event: %+v", got)
		}
	case <-time.After(time.Second):
		t.Fatal("publish blocked behind slow subscriber")
	}

	if bus.Dropped() != 1 {
		t.Fatalf("dropped: want 1 got %d", bus.Dropped())
	}
}
