package agent

type Session struct {
	id     string
	events []Event
}

func NewSession(id string) *Session {
	return &Session{id: id}
}

func (s *Session) AddUserMessage(content string) {
	s.events = append(s.events, Event{
		Type:    EventUserMessage,
		Content: content,
	})
}

func (s *Session) StartToolCall(id string, name string) {
	s.events = append(s.events, Event{
		Type:       EventToolCallStarted,
		ToolCallID: id,
		ToolName:   name,
	})
}

func (s *Session) FinishToolCall(id string, result string) {
	s.events = append(s.events, Event{
		Type:       EventToolCallFinished,
		ToolCallID: id,
		Content:    result,
	})
}

func (s *Session) AddAssistantMessage(content string) {
	s.events = append(s.events, Event{
		Type:    EventAssistantMessage,
		Content: content,
	})
}

func (s *Session) Events() []Event {
	copied := make([]Event, len(s.events))
	copy(copied, s.events)
	return copied
}
