package event

import (
	"context"
	"fmt"
	"sync"
)

type Store interface {
	Append(ctx context.Context, sessionID string, event Event) error
	List(ctx context.Context, sessionID string) ([]Event, error)
}

type MemoryStore struct {
	mu       sync.Mutex
	nextID   int
	sessions map[string][]Event
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{sessions: map[string][]Event{}}
}

func (s *MemoryStore) Append(ctx context.Context, sessionID string, event Event) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextID++
	if event.ID == "" {
		event.ID = fmt.Sprintf("event-%d", s.nextID)
	}
	event.SessionID = sessionID
	s.sessions[sessionID] = append(s.sessions[sessionID], event)
	return nil
}

func (s *MemoryStore) List(ctx context.Context, sessionID string) ([]Event, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	events := s.sessions[sessionID]
	out := make([]Event, len(events))
	copy(out, events)
	return out, nil
}
