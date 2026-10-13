package fallback

import (
	"context"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/audit"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/provider"
	"example.com/capstone-ai-gateway-agent-runtime/internal/platform/telemetry"
)

type Registry interface {
	Client(name core.ProviderName) (provider.Client, bool)
}

type Executor struct {
	registry    Registry
	telemetry   telemetry.Sink
	audit       audit.Sink
	maxAttempts int
}

func NewExecutor(registry Registry, sink telemetry.Sink) Executor {
	return Executor{registry: registry, telemetry: sink}
}

func (e Executor) WithAudit(sink audit.Sink) Executor {
	e.audit = sink
	return e
}

func (e Executor) WithRetryBudget(maxAttempts int) Executor {
	e.maxAttempts = maxAttempts
	return e
}

func (e Executor) Execute(ctx context.Context, req core.ChatRequest, plan core.RoutePlan) (core.ChatResponse, error) {
	var lastErr error
	for i, route := range plan.Attempts {
		if e.maxAttempts > 0 && i >= e.maxAttempts {
			if lastErr == nil {
				lastErr = core.GatewayError{Class: core.ErrorRetryBudget, Err: core.ErrRetryBudgetExceeded}
			}
			break
		}

		client, ok := e.registry.Client(route.Provider)
		if !ok {
			lastErr = core.GatewayError{Class: core.ErrorProviderUnavailable, Route: route, Err: core.ErrNoProvider}
			e.record(ctx, req, route, i, core.ChatResponse{}, lastErr)
			if !core.CanFallback(lastErr) {
				break
			}
			continue
		}

		resp, err := client.Chat(ctx, req.WithRoute(route))
		e.record(ctx, req, route, i, resp, err)
		if err == nil {
			return resp, nil
		}

		lastErr = err
		if !core.CanFallback(err) {
			break
		}
	}
	if lastErr == nil {
		lastErr = core.GatewayError{Class: core.ErrorProviderUnavailable, Err: core.ErrNoProvider}
	}
	return core.ChatResponse{}, lastErr
}

func (e Executor) record(ctx context.Context, req core.ChatRequest, route core.Route, index int, resp core.ChatResponse, err error) {
	errorClass := core.ErrorClassOf(err)
	if e.telemetry != nil {
		_ = e.telemetry.Record(ctx, telemetry.Event{
			Name:          "gateway.provider_attempt",
			RequestID:     string(req.RequestID),
			TenantID:      string(req.TenantID),
			Model:         string(route.Model),
			Provider:      string(route.Provider),
			ErrorClass:    string(errorClass),
			FallbackIndex: index,
		})
	}
	if e.audit != nil {
		inputTokens := resp.InputTokens
		if inputTokens == 0 {
			inputTokens = req.EstimatedTokens()
		}
		_ = e.audit.Record(ctx, audit.RequestLog{
			RequestID:     req.RequestID,
			TenantID:      req.TenantID,
			Model:         route.Model,
			Provider:      route.Provider,
			FallbackIndex: index,
			InputTokens:   inputTokens,
			OutputTokens:  resp.OutputTokens,
			ErrorClass:    errorClass,
			CostMicros:    audit.EstimateCostMicros(inputTokens, resp.OutputTokens),
		})
	}
}
