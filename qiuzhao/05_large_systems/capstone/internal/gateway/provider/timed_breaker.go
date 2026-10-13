package provider

import (
	"context"
	"sync"
	"time"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type BreakerState string

const (
	BreakerClosed   BreakerState = "closed"
	BreakerOpen     BreakerState = "open"
	BreakerHalfOpen BreakerState = "half_open"
)

type TimedBreaker struct {
	next     Client
	limit    int
	cooldown time.Duration
	now      func() time.Time

	mu          sync.Mutex
	state       BreakerState
	failures    int
	openedUntil time.Time
}

func NewTimedBreaker(next Client, limit int, cooldown time.Duration, now func() time.Time) *TimedBreaker {
	if limit < 1 {
		limit = 1
	}
	if cooldown <= 0 {
		cooldown = time.Second
	}
	if now == nil {
		now = time.Now
	}
	return &TimedBreaker{
		next:     next,
		limit:    limit,
		cooldown: cooldown,
		now:      now,
		state:    BreakerClosed,
	}
}

func (b *TimedBreaker) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	b.mu.Lock()
	if b.state == BreakerOpen && b.now().Before(b.openedUntil) {
		b.mu.Unlock()
		return core.ChatResponse{}, core.GatewayError{
			Class: core.ErrorProviderUnavailable,
			Route: core.Route{Provider: req.Provider, Model: req.Model},
			Err:   core.ErrNoProvider,
		}
	}
	if b.state == BreakerOpen {
		b.state = BreakerHalfOpen
	}
	b.mu.Unlock()

	resp, err := b.next.Chat(ctx, req)
	b.afterCall(err)
	return resp, err
}

func (b *TimedBreaker) afterCall(err error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if err == nil {
		b.failures = 0
		b.state = BreakerClosed
		b.openedUntil = time.Time{}
		return
	}
	if !core.CanFallback(err) {
		return
	}

	b.failures++
	if b.state == BreakerHalfOpen || b.failures >= b.limit {
		b.state = BreakerOpen
		b.openedUntil = b.now().Add(b.cooldown)
	}
}

func (b *TimedBreaker) State() BreakerState {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.state
}
