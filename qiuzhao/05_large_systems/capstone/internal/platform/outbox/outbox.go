package outbox

import (
	"context"
	"sync"
	"time"
)

type Event struct {
	ID          string
	Topic       string
	Payload     []byte
	Attempts    int
	AvailableAt time.Time
	Done        bool
	DeadLetter  bool
}

type Store interface {
	Append(ctx context.Context, event Event) error
	ClaimDue(ctx context.Context, now time.Time, limit int) ([]Event, error)
	MarkDone(ctx context.Context, id string) error
	MarkRetry(ctx context.Context, id string, next time.Time) error
	MarkDeadLetter(ctx context.Context, id string) error
}

type MemoryStore struct {
	mu     sync.Mutex
	events map[string]Event
	order  []string
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{events: map[string]Event{}}
}

func (s *MemoryStore) Append(ctx context.Context, event Event) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.events[event.ID]; !ok {
		s.order = append(s.order, event.ID)
	}
	s.events[event.ID] = cloneEvent(event)
	return nil
}

func (s *MemoryStore) ClaimDue(ctx context.Context, now time.Time, limit int) ([]Event, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if limit < 1 {
		limit = len(s.order)
	}
	out := make([]Event, 0, limit)
	for _, id := range s.order {
		event := s.events[id]
		if event.Done || event.DeadLetter || event.AvailableAt.After(now) {
			continue
		}
		out = append(out, cloneEvent(event))
		if len(out) == limit {
			break
		}
	}
	return out, nil
}

func (s *MemoryStore) MarkDone(ctx context.Context, id string) error {
	return s.update(ctx, id, func(event Event) Event {
		event.Done = true
		return event
	})
}

func (s *MemoryStore) MarkRetry(ctx context.Context, id string, next time.Time) error {
	return s.update(ctx, id, func(event Event) Event {
		event.Attempts++
		event.AvailableAt = next
		return event
	})
}

func (s *MemoryStore) MarkDeadLetter(ctx context.Context, id string) error {
	return s.update(ctx, id, func(event Event) Event {
		event.Attempts++
		event.DeadLetter = true
		return event
	})
}

func (s *MemoryStore) Events() []Event {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Event, 0, len(s.order))
	for _, id := range s.order {
		out = append(out, cloneEvent(s.events[id]))
	}
	return out
}

func (s *MemoryStore) update(ctx context.Context, id string, fn func(Event) Event) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	event := s.events[id]
	s.events[id] = fn(event)
	return nil
}

func cloneEvent(event Event) Event {
	event.Payload = append([]byte(nil), event.Payload...)
	return event
}
