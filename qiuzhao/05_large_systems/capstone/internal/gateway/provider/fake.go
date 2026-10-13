package provider

import (
	"context"
	"errors"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type FakeSuccess struct {
	Name    core.ProviderName
	Content string
}

func (f FakeSuccess) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	select {
	case <-ctx.Done():
		return core.ChatResponse{}, ctx.Err()
	default:
	}

	name := f.Name
	if name == "" {
		name = req.Provider
	}
	return core.ChatResponse{
		RequestID:    req.RequestID,
		Provider:     name,
		Model:        req.Model,
		Content:      f.Content,
		InputTokens:  req.EstimatedTokens(),
		OutputTokens: len(f.Content) / 4,
	}, nil
}

type FakeTimeout struct{}

func (FakeTimeout) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	return core.ChatResponse{}, core.GatewayError{
		Class: core.ErrorTimeout,
		Route: core.Route{Provider: req.Provider, Model: req.Model},
		Err:   context.DeadlineExceeded,
	}
}

type FakeFailure struct {
	Class core.ErrorClass
	Err   error
}

func (f FakeFailure) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	err := f.Err
	if err == nil {
		err = errors.New("provider failed")
	}
	return core.ChatResponse{}, core.GatewayError{
		Class: f.Class,
		Route: core.Route{Provider: req.Provider, Model: req.Model},
		Err:   err,
	}
}
