package provider

import (
	"context"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type BoundedClient struct {
	next      Client
	semaphore chan struct{}
}

func NewBoundedClient(next Client, maxInFlight int) *BoundedClient {
	if maxInFlight < 1 {
		maxInFlight = 1
	}
	return &BoundedClient{
		next:      next,
		semaphore: make(chan struct{}, maxInFlight),
	}
}

func (c *BoundedClient) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	select {
	case c.semaphore <- struct{}{}:
		defer func() { <-c.semaphore }()
	case <-ctx.Done():
		return core.ChatResponse{}, ctx.Err()
	default:
		return core.ChatResponse{}, core.GatewayError{
			Class: core.ErrorOverloaded,
			Route: core.Route{Provider: req.Provider, Model: req.Model},
			Err:   core.ErrProviderQueueFull,
		}
	}

	return c.next.Chat(ctx, req)
}
