package provider

import (
	"context"
	"testing"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

func TestQueueRejectsWhenFull(t *testing.T) {
	queue := NewQueue(1)
	if err := queue.TrySubmit(context.Background(), Job{ID: "job-1"}); err != nil {
		t.Fatalf("submit first: %v", err)
	}

	err := queue.TrySubmit(context.Background(), Job{ID: "job-2"})
	if core.ErrorClassOf(err) != core.ErrorOverloaded {
		t.Fatalf("error class: want overloaded got %s err=%v", core.ErrorClassOf(err), err)
	}
}

func TestQueueHonorsCanceledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := NewQueue(1).TrySubmit(ctx, Job{ID: "job-1"})
	if err != context.Canceled {
		t.Fatalf("want context canceled, got %v", err)
	}
}
