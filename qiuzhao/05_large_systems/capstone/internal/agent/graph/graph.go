package graph

import (
	"context"
	"errors"
	"fmt"

	"example.com/capstone-ai-gateway-agent-runtime/internal/agent/event"
)

var (
	ErrNodeNotFound       = errors.New("graph node not found")
	ErrStepBudgetExceeded = errors.New("graph step budget exceeded")
	ErrInterrupted        = errors.New("graph interrupted")
)

type Result struct {
	NextNodeID string
	Complete   bool
	Interrupt  bool
	Reason     string
}

type Node interface {
	Run(ctx context.Context, state event.State) (Result, error)
}

type NodeFunc func(ctx context.Context, state event.State) (Result, error)

func (fn NodeFunc) Run(ctx context.Context, state event.State) (Result, error) {
	return fn(ctx, state)
}

type Graph struct {
	events   event.Store
	nodes    map[string]Node
	MaxSteps int
}

func New(events event.Store, nodes map[string]Node) Graph {
	copied := make(map[string]Node, len(nodes))
	for id, node := range nodes {
		copied[id] = node
	}
	return Graph{events: events, nodes: copied, MaxSteps: 16}
}

func (g Graph) Execute(ctx context.Context, sessionID string, startNodeID string) error {
	maxSteps := g.MaxSteps
	if maxSteps < 1 {
		maxSteps = 1
	}

	current := startNodeID
	for step := 0; step < maxSteps; step++ {
		node, ok := g.nodes[current]
		if !ok {
			return fmt.Errorf("%s: %w", current, ErrNodeNotFound)
		}

		events, err := g.events.List(ctx, sessionID)
		if err != nil {
			return err
		}
		result, err := node.Run(ctx, event.Replay(events))
		if err != nil {
			return err
		}

		if result.Interrupt {
			if err := g.events.Append(ctx, sessionID, event.Event{
				Type:    event.RunInterrupted,
				NodeID:  current,
				Content: result.Reason,
			}); err != nil {
				return err
			}
			return ErrInterrupted
		}
		if result.Complete {
			return g.events.Append(ctx, sessionID, event.Event{
				Type:   event.RunCompleted,
				NodeID: current,
			})
		}
		if result.NextNodeID == "" {
			return fmt.Errorf("%s empty next node: %w", current, ErrNodeNotFound)
		}
		if err := g.events.Append(ctx, sessionID, event.Event{
			Type:       event.NodeTransitioned,
			NodeID:     current,
			NextNodeID: result.NextNodeID,
		}); err != nil {
			return err
		}
		current = result.NextNodeID
	}
	return ErrStepBudgetExceeded
}
