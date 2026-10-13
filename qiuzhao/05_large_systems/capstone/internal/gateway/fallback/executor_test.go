package fallback

import (
	"context"
	"testing"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/audit"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/provider"
	"example.com/capstone-ai-gateway-agent-runtime/internal/platform/telemetry"
)

func TestExecutorRecordsAuditLogs(t *testing.T) {
	registry := provider.NewRegistry()
	registry.Replace("primary", provider.NewRuntime("primary", provider.FakeTimeout{}))
	registry.Replace("backup", provider.NewRuntime("backup", provider.FakeSuccess{Content: "ok"}))
	auditLog := audit.NewMemoryLog()

	executor := NewExecutor(registry, telemetry.NewMemoryExporter()).WithAudit(auditLog)
	_, err := executor.Execute(context.Background(), request(), core.RoutePlan{Attempts: []core.Route{
		{Provider: "primary", Model: "gpt-demo"},
		{Provider: "backup", Model: "gpt-demo"},
	}})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	logs := auditLog.Logs()
	if len(logs) != 2 {
		t.Fatalf("logs: want 2 got %d %+v", len(logs), logs)
	}
	if logs[0].ErrorClass != core.ErrorTimeout {
		t.Fatalf("first error class: %s", logs[0].ErrorClass)
	}
	if logs[1].Provider != "backup" || logs[1].CostMicros == 0 {
		t.Fatalf("backup audit log: %+v", logs[1])
	}
}

func TestExecutorRespectsRetryBudget(t *testing.T) {
	registry := provider.NewRegistry()
	registry.Replace("primary", provider.NewRuntime("primary", provider.FakeTimeout{}))
	registry.Replace("backup", provider.NewRuntime("backup", provider.FakeSuccess{Content: "ok"}))
	events := telemetry.NewMemoryExporter()

	executor := NewExecutor(registry, events).WithRetryBudget(1)
	_, err := executor.Execute(context.Background(), request(), core.RoutePlan{Attempts: []core.Route{
		{Provider: "primary", Model: "gpt-demo"},
		{Provider: "backup", Model: "gpt-demo"},
	}})
	if core.ErrorClassOf(err) != core.ErrorTimeout {
		t.Fatalf("error class: %s err=%v", core.ErrorClassOf(err), err)
	}
	if events.Contains("gateway.provider_attempt", map[string]string{"provider": "backup"}) {
		t.Fatal("backup should not be attempted after retry budget is exhausted")
	}
}

func request() core.ChatRequest {
	return core.ChatRequest{
		RequestID: "req-1",
		TenantID:  "demo",
		Model:     "gpt-demo",
		Messages:  []core.Message{{Role: "user", Content: "hello"}},
	}
}
