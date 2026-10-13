package provider

import (
	"context"
	"sync"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type Breaker struct {
	next     Client
	limit    int
	mu       sync.Mutex
	failures int
	open     bool
}

func NewBreaker(next Client, limit int) *Breaker {
	if limit < 1 {
		limit = 1
	}
	return &Breaker{next: next, limit: limit}
}

func (b *Breaker) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	b.mu.Lock()
	if b.open {
		b.mu.Unlock()
		return core.ChatResponse{}, core.GatewayError{
			Class: core.ErrorProviderUnavailable,
			Route: core.Route{Provider: req.Provider, Model: req.Model},
			Err:   core.ErrNoProvider,
		}
	}
	b.mu.Unlock()

	resp, err := b.next.Chat(ctx, req)
	b.mu.Lock()
	defer b.mu.Unlock()
	if err != nil && core.CanFallback(err) {
		b.failures++
		if b.failures >= b.limit {
			b.open = true
		}
		return core.ChatResponse{}, err
	}
	if err == nil {
		b.failures = 0
	}
	return resp, err
}

func (b *Breaker) Open() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.open
}
