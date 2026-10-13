package telemetry

import (
	"context"
	"sync"
)

type MemoryExporter struct {
	mu     sync.Mutex
	events []Event
}

func NewMemoryExporter() *MemoryExporter {
	return &MemoryExporter{}
}

func (e *MemoryExporter) Record(ctx context.Context, event Event) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	e.mu.Lock()
	defer e.mu.Unlock()
	e.events = append(e.events, event)
	return nil
}

func (e *MemoryExporter) Events() []Event {
	e.mu.Lock()
	defer e.mu.Unlock()

	events := make([]Event, len(e.events))
	copy(events, e.events)
	return events
}

func (e *MemoryExporter) Contains(name string, attrs map[string]string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, event := range e.events {
		if event.Name != name {
			continue
		}
		if eventMatches(event, attrs) {
			return true
		}
	}
	return false
}

func eventMatches(event Event, attrs map[string]string) bool {
	for key, want := range attrs {
		var got string
		switch key {
		case "request_id":
			got = event.RequestID
		case "tenant_id":
			got = event.TenantID
		case "model":
			got = event.Model
		case "provider":
			got = event.Provider
		case "error_class":
			got = event.ErrorClass
		case "fallback_index":
			got = intString(event.FallbackIndex)
		default:
			return false
		}
		if got != want {
			return false
		}
	}
	return true
}

func intString(v int) string {
	if v == 0 {
		return "0"
	}

	var buf [20]byte
	i := len(buf)
	n := v
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
