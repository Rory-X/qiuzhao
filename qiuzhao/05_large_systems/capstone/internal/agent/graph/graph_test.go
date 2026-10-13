package graph

import (
	"context"
	"errors"
	"testing"

	"example.com/capstone-ai-gateway-agent-runtime/internal/agent/event"
)

func TestGraphRecordsTransitionAndCompletion(t *testing.T) {
	store := event.NewMemoryStore()
	graph := New(store, map[string]Node{
		"plan": NodeFunc(func(ctx context.Context, state event.State) (Result, error) {
			return Result{NextNodeID: "answer"}, nil
		}),
		"answer": NodeFunc(func(ctx context.Context, state event.State) (Result, error) {
			return Result{Complete: true}, nil
		}),
	})

	if err := graph.Execute(context.Background(), "session-1", "plan"); err != nil {
		t.Fatalf("execute: %v", err)
	}

	events, _ := store.List(context.Background(), "session-1")
	if len(events) != 2 {
		t.Fatalf("events: %+v", events)
	}
	if events[0].Type != event.NodeTransitioned || events[0].NodeID != "plan" || events[0].NextNodeID != "answer" {
		t.Fatalf("transition event: %+v", events[0])
	}
	if events[1].Type != event.RunCompleted || events[1].NodeID != "answer" {
		t.Fatalf("completion event: %+v", events[1])
	}
	if state := event.Replay(events); state.Status != event.StatusCompleted {
		t.Fatalf("status: %s", state.Status)
	}
}

func TestGraphStopsAtStepBudget(t *testing.T) {
	store := event.NewMemoryStore()
	graph := New(store, map[string]Node{
		"loop": NodeFunc(func(ctx context.Context, state event.State) (Result, error) {
			return Result{NextNodeID: "loop"}, nil
		}),
	})
	graph.MaxSteps = 2

	err := graph.Execute(context.Background(), "session-1", "loop")
	if !errors.Is(err, ErrStepBudgetExceeded) {
		t.Fatalf("want step budget error, got %v", err)
	}

	events, _ := store.List(context.Background(), "session-1")
	if len(events) != 2 {
		t.Fatalf("events: %+v", events)
	}
}

func TestGraphRecordsHumanInterrupt(t *testing.T) {
	store := event.NewMemoryStore()
	graph := New(store, map[string]Node{
		"approval": NodeFunc(func(ctx context.Context, state event.State) (Result, error) {
			return Result{Interrupt: true, Reason: "needs human approval"}, nil
		}),
	})

	err := graph.Execute(context.Background(), "session-1", "approval")
	if !errors.Is(err, ErrInterrupted) {
		t.Fatalf("want interrupt, got %v", err)
	}

	events, _ := store.List(context.Background(), "session-1")
	if len(events) != 1 || events[0].Type != event.RunInterrupted {
		t.Fatalf("events: %+v", events)
	}
	if state := event.Replay(events); state.Status != event.StatusInterrupted {
		t.Fatalf("status: %s", state.Status)
	}
}
