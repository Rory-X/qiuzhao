package stream

import (
	"sync"

	"example.com/capstone-ai-gateway-agent-runtime/internal/agent/event"
)

type Bus struct {
	mu      sync.RWMutex
	subs    map[string][]chan event.Event
	dropped int
}

func NewBus() *Bus {
	return &Bus{subs: map[string][]chan event.Event{}}
}

func (b *Bus) Subscribe(sessionID string, capacity int) <-chan event.Event {
	if capacity < 1 {
		capacity = 1
	}
	ch := make(chan event.Event, capacity)

	b.mu.Lock()
	defer b.mu.Unlock()
	b.subs[sessionID] = append(b.subs[sessionID], ch)
	return ch
}

func (b *Bus) Publish(sessionID string, evt event.Event) {
	b.mu.RLock()
	subs := append([]chan event.Event(nil), b.subs[sessionID]...)
	b.mu.RUnlock()

	for _, sub := range subs {
		select {
		case sub <- evt:
		default:
			b.mu.Lock()
			b.dropped++
			b.mu.Unlock()
		}
	}
}

func (b *Bus) Dropped() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.dropped
}
