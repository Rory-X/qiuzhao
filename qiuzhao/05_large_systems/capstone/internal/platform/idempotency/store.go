package idempotency

import (
	"context"
	"sync"
)

type Store struct {
	mu   sync.Mutex
	keys map[string]struct{}
}

func NewStore() *Store {
	return &Store{keys: map[string]struct{}{}}
}

func (s *Store) Claim(ctx context.Context, key string) (bool, error) {
	select {
	case <-ctx.Done():
		return false, ctx.Err()
	default:
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.keys[key]; ok {
		return false, nil
	}
	s.keys[key] = struct{}{}
	return true, nil
}

func (s *Store) Seen(key string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.keys[key]
	return ok
}
