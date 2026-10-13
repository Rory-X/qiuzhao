package provider

import (
	"context"
	"testing"
	"time"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

func TestTimedBreakerMovesToHalfOpenAfterCooldown(t *testing.T) {
	now := time.Date(2026, 7, 6, 12, 0, 0, 0, time.UTC)
	calls := 0
	breaker := NewTimedBreaker(ClientFunc(func(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
		calls++
		if calls == 1 {
			return core.ChatResponse{}, core.GatewayError{
				Class: core.ErrorTimeout,
				Route: core.Route{Provider: req.Provider, Model: req.Model},
				Err:   context.DeadlineExceeded,
			}
		}
		return core.ChatResponse{Provider: req.Provider, Model: req.Model, Content: "ok"}, nil
	}), 1, time.Minute, func() time.Time { return now })
	req := core.ChatRequest{Provider: "primary", Model: "gpt-demo"}

	_, _ = breaker.Chat(context.Background(), req)
	if breaker.State() != BreakerOpen {
		t.Fatalf("state: want open got %s", breaker.State())
	}

	_, err := breaker.Chat(context.Background(), req)
	if core.ErrorClassOf(err) != core.ErrorProviderUnavailable {
		t.Fatalf("want provider unavailable while open, got %v", err)
	}
	if calls != 1 {
		t.Fatalf("open breaker should not call provider, calls=%d", calls)
	}

	now = now.Add(time.Minute + time.Nanosecond)
	resp, err := breaker.Chat(context.Background(), req)
	if err != nil {
		t.Fatalf("half-open probe: %v", err)
	}
	if resp.Content != "ok" {
		t.Fatalf("response: %+v", resp)
	}
	if breaker.State() != BreakerClosed {
		t.Fatalf("state: want closed got %s", breaker.State())
	}
}
