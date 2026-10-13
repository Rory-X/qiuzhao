package core_test

import (
	"context"
	"testing"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/fallback"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/policy"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/provider"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/router"
	"example.com/capstone-ai-gateway-agent-runtime/internal/platform/telemetry"
)

func TestGatewayFallbackRecordsTelemetry(t *testing.T) {
	registry := provider.NewRegistry()
	registry.Replace("primary", provider.NewRuntime("primary", provider.FakeTimeout{}))
	registry.Replace("backup", provider.NewRuntime("backup", provider.FakeSuccess{
		Name:    "backup",
		Content: "ok",
	}))

	events := telemetry.NewMemoryExporter()
	service := core.Service{
		Policy: policy.NewEngine(policy.NewMemoryStore([]core.TenantPolicy{
			{
				TenantID: "demo",
				AllowedModels: map[core.ModelName]bool{
					"gpt-demo": true,
				},
				AllowedProviders: map[core.ProviderName]bool{
					"primary": true,
					"backup":  true,
				},
				AllowFallbacks: true,
			},
		})),
		Limiter:  policy.NewTokenLimiter(1000),
		Router:   router.NewPlanner(registry),
		Executor: fallback.NewExecutor(registry, events),
	}

	resp, err := service.Chat(context.Background(), core.ChatRequest{
		RequestID: "req-1",
		TenantID:  "demo",
		Model:     "gpt-demo",
		Provider:  "primary",
		Messages:  []core.Message{{Role: "user", Content: "hi"}},
		Fallbacks: []core.Route{{Provider: "backup", Model: "gpt-demo"}},
	})
	if err != nil {
		t.Fatalf("chat: %v", err)
	}
	if resp.Provider != "backup" || resp.Content != "ok" {
		t.Fatalf("unexpected response: %+v", resp)
	}

	assertTelemetry(t, events, "gateway.provider_attempt", map[string]string{
		"provider":       "primary",
		"error_class":    "timeout",
		"fallback_index": "0",
	})
	assertTelemetry(t, events, "gateway.provider_attempt", map[string]string{
		"provider":       "backup",
		"error_class":    "",
		"fallback_index": "1",
	})
}

func TestGatewayRejectsDisallowedModel(t *testing.T) {
	registry := provider.NewRegistry()
	events := telemetry.NewMemoryExporter()
	service := core.Service{
		Policy: policy.NewEngine(policy.NewMemoryStore([]core.TenantPolicy{
			{
				TenantID:      "demo",
				AllowedModels: map[core.ModelName]bool{"gpt-demo": true},
			},
		})),
		Limiter:  policy.NewTokenLimiter(1000),
		Router:   router.NewPlanner(registry),
		Executor: fallback.NewExecutor(registry, events),
	}

	_, err := service.Chat(context.Background(), core.ChatRequest{
		RequestID: "req-2",
		TenantID:  "demo",
		Model:     "not-allowed",
		Messages:  []core.Message{{Role: "user", Content: "hi"}},
	})
	if core.ErrorClassOf(err) != core.ErrorInvalidInput {
		t.Fatalf("error class: want invalid_input got %s err=%v", core.ErrorClassOf(err), err)
	}
}

func assertTelemetry(t *testing.T, exporter *telemetry.MemoryExporter, name string, attrs map[string]string) {
	t.Helper()
	if !exporter.Contains(name, attrs) {
		t.Fatalf("missing telemetry %s %+v in %+v", name, attrs, exporter.Events())
	}
}
