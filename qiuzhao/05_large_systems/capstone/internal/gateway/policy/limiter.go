package policy

import (
	"context"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type TokenLimiter struct {
	maxTokens int
}

func NewTokenLimiter(maxTokens int) TokenLimiter {
	return TokenLimiter{maxTokens: maxTokens}
}

func (l TokenLimiter) Admit(ctx context.Context, tenantID core.TenantID, tokens int) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	if l.maxTokens > 0 && tokens > l.maxTokens {
		return core.GatewayError{Class: core.ErrorQuotaExceeded, Err: core.ErrTokenBudgetExceeded}
	}
	return nil
}
