package runner

import (
	"context"
	"errors"

	"example.com/capstone-ai-gateway-agent-runtime/internal/agent/event"
	"example.com/capstone-ai-gateway-agent-runtime/internal/agent/tool"
)

var (
	ErrStepBudgetExceeded = errors.New("step budget exceeded")
	ErrInvalidCommand     = errors.New("invalid command")
)

type Runner struct {
	events  event.Store
	model   Model
	tools   tool.Registry
	maxStep int
}

func New(events event.Store, model Model, tools tool.Registry) Runner {
	return Runner{events: events, model: model, tools: tools, maxStep: 8}
}

func (r Runner) Run(ctx context.Context, sessionID string, input string) error {
	if err := r.events.Append(ctx, sessionID, event.Event{Type: event.UserMessage, Content: input}); err != nil {
		return err
	}

	for step := 0; step < r.maxStep; step++ {
		events, err := r.events.List(ctx, sessionID)
		if err != nil {
			return err
		}
		cmd, err := r.model.Next(ctx, event.Replay(events))
		if err != nil {
			return err
		}
		if err := r.applyCommand(ctx, sessionID, cmd); err != nil {
			return err
		}
		if cmd.Type == CommandAnswer {
			return r.events.Append(ctx, sessionID, event.Event{Type: event.RunCompleted})
		}
	}
	return ErrStepBudgetExceeded
}

func (r Runner) applyCommand(ctx context.Context, sessionID string, cmd Command) error {
	switch cmd.Type {
	case CommandCallTool:
		if cmd.Tool == nil || cmd.Tool.ID == "" || cmd.Tool.Name == "" {
			return ErrInvalidCommand
		}
		if err := r.events.Append(ctx, sessionID, event.Event{
			Type:       event.ToolStarted,
			ToolCallID: cmd.Tool.ID,
			ToolName:   cmd.Tool.Name,
			Content:    cmd.Tool.Input,
		}); err != nil {
			return err
		}
		result, err := r.tools.Invoke(ctx, *cmd.Tool)
		if err != nil {
			_ = r.events.Append(ctx, sessionID, event.Event{
				Type:       event.ToolFailed,
				ToolCallID: cmd.Tool.ID,
				ToolName:   cmd.Tool.Name,
				Content:    err.Error(),
			})
			return err
		}
		return r.events.Append(ctx, sessionID, event.Event{
			Type:       event.ToolFinished,
			ToolCallID: cmd.Tool.ID,
			ToolName:   cmd.Tool.Name,
			Content:    result.Content,
		})
	case CommandAnswer:
		return r.events.Append(ctx, sessionID, event.Event{Type: event.AssistantMessage, Content: cmd.Text})
	default:
		return ErrInvalidCommand
	}
}
