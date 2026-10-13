package policy

import (
	"context"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type MemoryStore struct {
	policies map[core.TenantID]core.TenantPolicy
}

func NewMemoryStore(policies []core.TenantPolicy) *MemoryStore {
	store := &MemoryStore{policies: map[core.TenantID]core.TenantPolicy{}}
	for _, policy := range policies {
		store.policies[policy.TenantID] = policy
	}
	return store
}

type Engine struct {
	store *MemoryStore
}

func NewEngine(store *MemoryStore) Engine {
	return Engine{store: store}
}

func (e Engine) Authorize(ctx context.Context, req core.ChatRequest) (core.TenantPolicy, error) {
	select {
	case <-ctx.Done():
		return core.TenantPolicy{}, ctx.Err()
	default:
	}

	policy, ok := e.store.policies[req.TenantID]
	if !ok {
		return core.TenantPolicy{}, core.GatewayError{Class: core.ErrorUnauthorized, Err: core.ErrTenantNotAllowed}
	}
	if len(policy.AllowedModels) > 0 && !policy.AllowedModels[req.Model] {
		return core.TenantPolicy{}, core.GatewayError{Class: core.ErrorInvalidInput, Err: core.ErrModelNotAllowed}
	}
	if req.Provider != "" && len(policy.AllowedProviders) > 0 && !policy.AllowedProviders[req.Provider] {
		return core.TenantPolicy{}, core.GatewayError{Class: core.ErrorUnauthorized, Err: core.ErrProviderNotAllowed}
	}
	return policy, nil
}
