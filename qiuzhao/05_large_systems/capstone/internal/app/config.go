package app

import (
	"fmt"
	"sync"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type ProviderConfig struct {
	Name        core.ProviderName
	Models      map[core.ModelName]bool
	MaxInFlight int
}

type GatewayConfig struct {
	Providers []ProviderConfig
	Tenants   []core.TenantPolicy
}

func (c GatewayConfig) Validate() error {
	providers := make(map[core.ProviderName]ProviderConfig, len(c.Providers))
	models := map[core.ModelName]bool{}
	for _, provider := range c.Providers {
		if provider.Name == "" {
			return fmt.Errorf("provider name is required")
		}
		if _, exists := providers[provider.Name]; exists {
			return fmt.Errorf("provider %s is duplicated", provider.Name)
		}
		if provider.MaxInFlight < 0 {
			return fmt.Errorf("provider %s max in-flight must be non-negative", provider.Name)
		}
		providers[provider.Name] = provider
		for model, enabled := range provider.Models {
			if enabled {
				models[model] = true
			}
		}
	}
	if len(providers) == 0 {
		return fmt.Errorf("at least one provider is required")
	}

	tenants := map[core.TenantID]bool{}
	for _, tenant := range c.Tenants {
		if tenant.TenantID == "" {
			return fmt.Errorf("tenant id is required")
		}
		if tenants[tenant.TenantID] {
			return fmt.Errorf("tenant %s is duplicated", tenant.TenantID)
		}
		tenants[tenant.TenantID] = true

		for providerName, allowed := range tenant.AllowedProviders {
			if !allowed {
				continue
			}
			if _, ok := providers[providerName]; !ok {
				return fmt.Errorf("tenant %s allows unknown provider %s", tenant.TenantID, providerName)
			}
		}
		for modelName, allowed := range tenant.AllowedModels {
			if !allowed || len(models) == 0 {
				continue
			}
			if !models[modelName] {
				return fmt.Errorf("tenant %s allows unknown model %s", tenant.TenantID, modelName)
			}
		}
	}
	if len(tenants) == 0 {
		return fmt.Errorf("at least one tenant policy is required")
	}
	return nil
}

type ConfigStore struct {
	mu      sync.RWMutex
	current GatewayConfig
	version int
	history map[int]GatewayConfig
	audit   []ConfigAuditEvent
}

type ConfigAuditEvent struct {
	Action          string
	Actor           string
	Version         int
	PreviousVersion int
	TargetVersion   int
	Summary         string
}

func NewConfigStore(initial GatewayConfig) (*ConfigStore, error) {
	if err := initial.Validate(); err != nil {
		return nil, err
	}
	initial = cloneGatewayConfig(initial)
	return &ConfigStore{
		current: initial,
		version: 1,
		history: map[int]GatewayConfig{
			1: cloneGatewayConfig(initial),
		},
	}, nil
}

func (s *ConfigStore) Snapshot() GatewayConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return cloneGatewayConfig(s.current)
}

func (s *ConfigStore) Version() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.version
}

func (s *ConfigStore) AuditEvents() []ConfigAuditEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]ConfigAuditEvent, len(s.audit))
	copy(out, s.audit)
	return out
}

func (s *ConfigStore) Swap(next GatewayConfig) error {
	_, err := s.SwapWithAudit("", next)
	return err
}

func (s *ConfigStore) SwapWithAudit(actor string, next GatewayConfig) (int, error) {
	if err := next.Validate(); err != nil {
		return 0, err
	}
	next = cloneGatewayConfig(next)

	s.mu.Lock()
	defer s.mu.Unlock()

	previousVersion := s.version
	previous := s.current
	s.version++
	s.current = next
	s.history[s.version] = cloneGatewayConfig(next)
	s.audit = append(s.audit, ConfigAuditEvent{
		Action:          "swap",
		Actor:           actor,
		Version:         s.version,
		PreviousVersion: previousVersion,
		Summary:         configSummary(previous, next),
	})
	return s.version, nil
}

func (s *ConfigStore) Rollback(actor string, targetVersion int) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	target, ok := s.history[targetVersion]
	if !ok {
		return 0, fmt.Errorf("config version %d not found", targetVersion)
	}
	previousVersion := s.version
	previous := s.current
	next := cloneGatewayConfig(target)
	s.version++
	s.current = next
	s.history[s.version] = cloneGatewayConfig(next)
	s.audit = append(s.audit, ConfigAuditEvent{
		Action:          "rollback",
		Actor:           actor,
		Version:         s.version,
		PreviousVersion: previousVersion,
		TargetVersion:   targetVersion,
		Summary:         configSummary(previous, next),
	})
	return s.version, nil
}

func cloneGatewayConfig(cfg GatewayConfig) GatewayConfig {
	out := GatewayConfig{
		Providers: make([]ProviderConfig, len(cfg.Providers)),
		Tenants:   make([]core.TenantPolicy, len(cfg.Tenants)),
	}
	for i, provider := range cfg.Providers {
		out.Providers[i] = ProviderConfig{
			Name:        provider.Name,
			Models:      cloneModelMap(provider.Models),
			MaxInFlight: provider.MaxInFlight,
		}
	}
	for i, tenant := range cfg.Tenants {
		out.Tenants[i] = core.TenantPolicy{
			TenantID:         tenant.TenantID,
			AllowedModels:    cloneModelMap(tenant.AllowedModels),
			AllowedProviders: cloneProviderMap(tenant.AllowedProviders),
			AllowFallbacks:   tenant.AllowFallbacks,
			TokenBudget:      tenant.TokenBudget,
		}
	}
	return out
}

func cloneModelMap(in map[core.ModelName]bool) map[core.ModelName]bool {
	if in == nil {
		return nil
	}
	out := make(map[core.ModelName]bool, len(in))
	for key, value := range in {
		out[key] = value
	}
	return out
}

func cloneProviderMap(in map[core.ProviderName]bool) map[core.ProviderName]bool {
	if in == nil {
		return nil
	}
	out := make(map[core.ProviderName]bool, len(in))
	for key, value := range in {
		out[key] = value
	}
	return out
}

func configSummary(previous GatewayConfig, next GatewayConfig) string {
	return fmt.Sprintf(
		"providers %d->%d tenants %d->%d",
		len(previous.Providers),
		len(next.Providers),
		len(previous.Tenants),
		len(next.Tenants),
	)
}
