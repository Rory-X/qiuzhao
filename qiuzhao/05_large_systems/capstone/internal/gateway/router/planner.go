package router

import (
	"context"
	"sort"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type HealthView interface {
	Healthy(name core.ProviderName) bool
}

type Planner struct {
	health HealthView
}

func NewPlanner(health HealthView) Planner {
	return Planner{health: health}
}

func (p Planner) Plan(ctx context.Context, req core.ChatRequest, policy core.TenantPolicy) (core.RoutePlan, error) {
	select {
	case <-ctx.Done():
		return core.RoutePlan{}, ctx.Err()
	default:
	}

	var attempts []core.Route
	add := func(route core.Route) {
		if route.Provider == "" {
			return
		}
		if route.Model == "" {
			route.Model = req.Model
		}
		if len(policy.AllowedProviders) > 0 && !policy.AllowedProviders[route.Provider] {
			return
		}
		if p.health != nil && !p.health.Healthy(route.Provider) {
			return
		}
		for _, existing := range attempts {
			if existing.Provider == route.Provider && existing.Model == route.Model {
				return
			}
		}
		attempts = append(attempts, route)
	}

	add(core.Route{Provider: req.Provider, Model: req.Model})
	if policy.AllowFallbacks {
		for _, fallback := range req.Fallbacks {
			add(fallback)
		}
		if len(req.Fallbacks) == 0 {
			for _, provider := range sortedProviders(policy.AllowedProviders) {
				add(core.Route{Provider: provider, Model: req.Model})
			}
		}
	}

	if len(attempts) == 0 {
		return core.RoutePlan{}, core.GatewayError{Class: core.ErrorProviderUnavailable, Err: core.ErrNoProvider}
	}
	return core.RoutePlan{Attempts: attempts}, nil
}

func sortedProviders(providers map[core.ProviderName]bool) []core.ProviderName {
	names := make([]string, 0, len(providers))
	for provider, allowed := range providers {
		if allowed {
			names = append(names, string(provider))
		}
	}
	sort.Strings(names)

	out := make([]core.ProviderName, 0, len(names))
	for _, name := range names {
		out = append(out, core.ProviderName(name))
	}
	return out
}
