package app

import (
	"net/http"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/audit"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/fallback"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/httpapi"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/policy"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/provider"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/router"
	"example.com/capstone-ai-gateway-agent-runtime/internal/platform/telemetry"
)

type Demo struct {
	Handler   http.Handler
	Service   core.Service
	Telemetry *telemetry.MemoryExporter
	Audit     *audit.MemoryLog
}

func BuildDemo() Demo {
	registry := provider.NewRegistry()
	registry.Replace("primary", provider.NewRuntime("primary", provider.NewBreaker(provider.FakeTimeout{}, 2)))
	registry.Replace("backup", provider.NewRuntime("backup", provider.FakeSuccess{
		Name:    "backup",
		Content: "ok from backup",
	}))

	telemetrySink := telemetry.NewMemoryExporter()
	auditLog := audit.NewMemoryLog()

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
		Limiter: policy.NewTokenLimiter(1000),
		Router:  router.NewPlanner(registry),
		Executor: fallback.NewExecutor(registry, telemetrySink).
			WithAudit(auditLog).
			WithRetryBudget(3),
	}

	mux := http.NewServeMux()
	httpapi.RegisterRoutes(mux, httpapi.NewHandler(service))

	return Demo{
		Handler:   mux,
		Service:   service,
		Telemetry: telemetrySink,
		Audit:     auditLog,
	}
}
