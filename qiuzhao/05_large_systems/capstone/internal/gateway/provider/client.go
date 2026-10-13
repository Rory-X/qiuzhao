package provider

import (
	"context"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type Client interface {
	Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error)
}

type ClientFunc func(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error)

func (fn ClientFunc) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	return fn(ctx, req)
}
