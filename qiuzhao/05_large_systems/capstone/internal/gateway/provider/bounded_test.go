package provider

import (
	"context"
	"testing"
	"time"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

func TestBoundedClientRejectsWhenInFlightFull(t *testing.T) {
	block := make(chan struct{})
	started := make(chan struct{})
	client := NewBoundedClient(ClientFunc(func(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
		close(started)
		<-block
		return core.ChatResponse{}, nil
	}), 1)

	done := make(chan struct{})
	go func() {
		_, _ = client.Chat(context.Background(), core.ChatRequest{Provider: "primary", Model: "gpt-demo"})
		close(done)
	}()
	<-started

	_, err := client.Chat(context.Background(), core.ChatRequest{Provider: "primary", Model: "gpt-demo"})
	if core.ErrorClassOf(err) != core.ErrorOverloaded {
		t.Fatalf("error class: want overloaded got %s err=%v", core.ErrorClassOf(err), err)
	}

	close(block)
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("first request did not finish")
	}
}
