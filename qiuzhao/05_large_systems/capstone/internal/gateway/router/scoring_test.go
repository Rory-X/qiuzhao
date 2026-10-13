package router

import (
	"testing"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

func TestRouteScoringPrefersHealthyLowLatencyProvider(t *testing.T) {
	req := core.ChatRequest{Model: "gpt-demo"}
	plan := BuildScoredPlan(req, []Candidate{
		{
			Route:      core.Route{Provider: "slow", Model: "gpt-demo"},
			Healthy:    true,
			LatencyMS:  400,
			CostMicros: 100,
			Supports:   map[core.ModelName]bool{"gpt-demo": true},
		},
		{
			Route:      core.Route{Provider: "fast", Model: "gpt-demo"},
			Healthy:    true,
			LatencyMS:  20,
			CostMicros: 100,
			Supports:   map[core.ModelName]bool{"gpt-demo": true},
		},
	}, 1)

	if len(plan.Attempts) != 1 {
		t.Fatalf("attempts: %+v", plan.Attempts)
	}
	if plan.Attempts[0].Provider != "fast" {
		t.Fatalf("provider: want fast got %s", plan.Attempts[0].Provider)
	}
}

func TestRouteScoringExcludesUnsupportedModel(t *testing.T) {
	req := core.ChatRequest{Model: "gpt-demo"}
	plan := BuildScoredPlan(req, []Candidate{
		{
			Route:    core.Route{Provider: "vision-only", Model: "vision-demo"},
			Healthy:  true,
			Supports: map[core.ModelName]bool{"vision-demo": true},
		},
		{
			Route:    core.Route{Provider: "chat", Model: "gpt-demo"},
			Healthy:  true,
			Supports: map[core.ModelName]bool{"gpt-demo": true},
		},
	}, 0)

	if len(plan.Attempts) != 1 {
		t.Fatalf("attempts: %+v", plan.Attempts)
	}
	if plan.Attempts[0].Provider != "chat" {
		t.Fatalf("provider: want chat got %s", plan.Attempts[0].Provider)
	}
}
