package provider

import (
	"context"
	"testing"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

func TestBreakerOpensAfterRetryableFailures(t *testing.T) {
	breaker := NewBreaker(FakeTimeout{}, 2)
	req := core.ChatRequest{Provider: "primary", Model: "gpt-demo"}

	_, _ = breaker.Chat(context.Background(), req)
	if breaker.Open() {
		t.Fatal("breaker opened too early")
	}
	_, _ = breaker.Chat(context.Background(), req)
	if !breaker.Open() {
		t.Fatal("breaker should be open")
	}

	_, err := breaker.Chat(context.Background(), req)
	if core.ErrorClassOf(err) != core.ErrorProviderUnavailable {
		t.Fatalf("error class: %s err=%v", core.ErrorClassOf(err), err)
	}
}
