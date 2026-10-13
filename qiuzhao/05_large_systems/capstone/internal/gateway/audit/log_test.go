package audit

import (
	"context"
	"testing"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

func TestMemoryLogCopiesLogs(t *testing.T) {
	log := NewMemoryLog()
	err := log.Record(context.Background(), RequestLog{
		RequestID:   "req-1",
		TenantID:    "demo",
		Provider:    "openai",
		Model:       "gpt-demo",
		InputTokens: 10,
		CostMicros:  EstimateCostMicros(10, 5),
	})
	if err != nil {
		t.Fatalf("record: %v", err)
	}

	logs := log.Logs()
	logs[0].Provider = "mutated"

	if got := log.Logs()[0].Provider; got != core.ProviderName("openai") {
		t.Fatalf("internal log mutated: %s", got)
	}
}

func TestEstimateCostMicrosUsesInputAndOutputTokens(t *testing.T) {
	if got := EstimateCostMicros(10, 5); got != 250 {
		t.Fatalf("cost: want 250 got %d", got)
	}
}
