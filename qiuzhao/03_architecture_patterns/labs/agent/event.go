package agent

type EventType string

const (
	EventUserMessage      EventType = "user_message"
	EventToolCallStarted  EventType = "tool_call_started"
	EventToolCallFinished EventType = "tool_call_finished"
	EventAssistantMessage EventType = "assistant_message"
)

type Event struct {
	Type       EventType
	Content    string
	ToolCallID string
	ToolName   string
}
