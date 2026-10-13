package event

type EventType string

const (
	UserMessage      EventType = "user_message"
	AssistantMessage EventType = "assistant_message"
	ToolStarted      EventType = "tool_started"
	ToolFinished     EventType = "tool_finished"
	ToolFailed       EventType = "tool_failed"
	NodeTransitioned EventType = "node_transitioned"
	RunInterrupted   EventType = "run_interrupted"
	RunCompleted     EventType = "run_completed"
	Timeout          EventType = "timeout"
)

type Event struct {
	ID         string
	SessionID  string
	Type       EventType
	ToolCallID string
	ToolName   string
	NodeID     string
	NextNodeID string
	Content    string
}

type Message struct {
	Role    string
	Content string
}

type Status string

const (
	StatusRunning     Status = "running"
	StatusCompleted   Status = "completed"
	StatusFailed      Status = "failed"
	StatusInterrupted Status = "interrupted"
)

type ToolCall struct {
	ID   string
	Name string
}

type State struct {
	Status       Status
	Messages     []Message
	RunningTools map[string]ToolCall
}
