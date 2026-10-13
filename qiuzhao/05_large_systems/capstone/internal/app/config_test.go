package app

import (
	"strings"
	"testing"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

func TestConfigSwapRejectsUnknownProviderInTenantPolicy(t *testing.T) {
	store, err := NewConfigStore(baseGatewayConfig())
	if err != nil {
		t.Fatalf("initial config: %v", err)
	}

	err = store.Swap(GatewayConfig{
		Providers: []ProviderConfig{
			{
				Name: "primary",
				Models: map[core.ModelName]bool{
					"gpt-demo": true,
				},
			},
		},
		Tenants: []core.TenantPolicy{
			{
				TenantID: "demo",
				AllowedModels: map[core.ModelName]bool{
					"gpt-demo": true,
				},
				AllowedProviders: map[core.ProviderName]bool{
					"primary": true,
					"ghost":   true,
				},
			},
		},
	})
	if err == nil {
		t.Fatal("expected invalid config")
	}
	if !strings.Contains(err.Error(), "unknown provider ghost") {
		t.Fatalf("unexpected error: %v", err)
	}

	snapshot := store.Snapshot()
	if got := snapshot.Tenants[0].AllowedProviders["ghost"]; got {
		t.Fatalf("invalid config leaked into snapshot: %+v", snapshot.Tenants[0].AllowedProviders)
	}
	if !snapshot.Tenants[0].AllowedProviders["primary"] {
		t.Fatalf("valid provider was lost: %+v", snapshot.Tenants[0].AllowedProviders)
	}
}

func TestConfigSwapRecordsAuditEvent(t *testing.T) {
	store, err := NewConfigStore(baseGatewayConfig())
	if err != nil {
		t.Fatalf("initial config: %v", err)
	}

	next := baseGatewayConfig()
	next.Providers = append(next.Providers, ProviderConfig{
		Name: "backup",
		Models: map[core.ModelName]bool{
			"gpt-demo": true,
		},
		MaxInFlight: 5,
	})
	next.Tenants[0].AllowedProviders["backup"] = true

	version, err := store.SwapWithAudit("ops@example.com", next)
	if err != nil {
		t.Fatalf("swap: %v", err)
	}
	if version != 2 || store.Version() != 2 {
		t.Fatalf("version: returned=%d current=%d", version, store.Version())
	}

	events := store.AuditEvents()
	if len(events) != 1 {
		t.Fatalf("audit events: %+v", events)
	}
	if events[0].Action != "swap" || events[0].Actor != "ops@example.com" {
		t.Fatalf("audit event: %+v", events[0])
	}
	if events[0].Version != 2 || events[0].PreviousVersion != 1 {
		t.Fatalf("audit versions: %+v", events[0])
	}
	if !strings.Contains(events[0].Summary, "providers 1->2") {
		t.Fatalf("summary: %q", events[0].Summary)
	}
}

func TestConfigRollbackRestoresPriorVersionAsNewVersion(t *testing.T) {
	store, err := NewConfigStore(baseGatewayConfig())
	if err != nil {
		t.Fatalf("initial config: %v", err)
	}

	next := baseGatewayConfig()
	next.Providers = []ProviderConfig{
		{
			Name: "backup",
			Models: map[core.ModelName]bool{
				"gpt-demo": true,
			},
			MaxInFlight: 5,
		},
	}
	next.Tenants[0].AllowedProviders = map[core.ProviderName]bool{"backup": true}

	if _, err := store.SwapWithAudit("ops@example.com", next); err != nil {
		t.Fatalf("swap: %v", err)
	}

	rollbackVersion, err := store.Rollback("incident@example.com", 1)
	if err != nil {
		t.Fatalf("rollback: %v", err)
	}
	if rollbackVersion != 3 || store.Version() != 3 {
		t.Fatalf("version: returned=%d current=%d", rollbackVersion, store.Version())
	}

	snapshot := store.Snapshot()
	if len(snapshot.Providers) != 1 || snapshot.Providers[0].Name != "primary" {
		t.Fatalf("snapshot after rollback: %+v", snapshot.Providers)
	}
	if !snapshot.Tenants[0].AllowedProviders["primary"] || snapshot.Tenants[0].AllowedProviders["backup"] {
		t.Fatalf("tenant policy after rollback: %+v", snapshot.Tenants[0].AllowedProviders)
	}

	events := store.AuditEvents()
	if len(events) != 2 {
		t.Fatalf("audit events: %+v", events)
	}
	last := events[1]
	if last.Action != "rollback" || last.Actor != "incident@example.com" {
		t.Fatalf("rollback audit event: %+v", last)
	}
	if last.Version != 3 || last.PreviousVersion != 2 || last.TargetVersion != 1 {
		t.Fatalf("rollback versions: %+v", last)
	}
}

func baseGatewayConfig() GatewayConfig {
	return GatewayConfig{
		Providers: []ProviderConfig{
			{
				Name: "primary",
				Models: map[core.ModelName]bool{
					"gpt-demo": true,
				},
				MaxInFlight: 10,
			},
		},
		Tenants: []core.TenantPolicy{
			{
				TenantID: "demo",
				AllowedModels: map[core.ModelName]bool{
					"gpt-demo": true,
				},
				AllowedProviders: map[core.ProviderName]bool{
					"primary": true,
				},
			},
		},
	}
}
