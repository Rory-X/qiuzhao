package event

func Replay(events []Event) State {
	state := State{
		Status:       StatusRunning,
		RunningTools: map[string]ToolCall{},
	}

	for _, event := range events {
		switch event.Type {
		case UserMessage:
			state.Messages = append(state.Messages, Message{Role: "user", Content: event.Content})
		case AssistantMessage:
			state.Messages = append(state.Messages, Message{Role: "assistant", Content: event.Content})
		case ToolStarted:
			state.RunningTools[event.ToolCallID] = ToolCall{ID: event.ToolCallID, Name: event.ToolName}
		case ToolFinished:
			delete(state.RunningTools, event.ToolCallID)
		case ToolFailed:
			delete(state.RunningTools, event.ToolCallID)
			state.Status = StatusFailed
		case RunInterrupted:
			state.Status = StatusInterrupted
		case RunCompleted:
			state.Status = StatusCompleted
		}
	}
	return state
}
