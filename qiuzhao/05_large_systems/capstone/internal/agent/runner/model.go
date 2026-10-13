package runner

import (
	"context"
	"errors"
	"sync"

	"example.com/capstone-ai-gateway-agent-runtime/internal/agent/event"
)

var ErrNoMoreSteps = errors.New("no more model steps")

type Model interface {
	Next(ctx context.Context, state event.State) (Command, error)
}

type Step struct {
	Command Command
}

type ScriptedModel struct {
	mu    sync.Mutex
	steps []Step
	index int
}

func NewScriptedModel(steps []Step) *ScriptedModel {
	copied := make([]Step, len(steps))
	copy(copied, steps)
	return &ScriptedModel{steps: copied}
}

func (m *ScriptedModel) Next(ctx context.Context, state event.State) (Command, error) {
	select {
	case <-ctx.Done():
		return Command{}, ctx.Err()
	default:
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.index >= len(m.steps) {
		return Command{}, ErrNoMoreSteps
	}
	step := m.steps[m.index]
	m.index++
	return step.Command, nil
}
