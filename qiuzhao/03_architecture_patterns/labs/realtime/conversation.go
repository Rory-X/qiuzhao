package realtime

type Conversation struct {
	id       string
	nextSeq  int64
	messages []Message
	seen     map[string]Message
}

func NewConversation(id string) *Conversation {
	return &Conversation{
		id:      id,
		nextSeq: 1,
		seen:    make(map[string]Message),
	}
}

func (c *Conversation) Accept(clientID string, body string) Message {
	if message, ok := c.seen[clientID]; ok {
		return message
	}

	message := Message{
		ClientID: clientID,
		Seq:      c.nextSeq,
		Body:     body,
	}
	c.nextSeq++
	c.messages = append(c.messages, message)
	c.seen[clientID] = message
	return message
}

func (c *Conversation) Messages() []Message {
	copied := make([]Message, len(c.messages))
	copy(copied, c.messages)
	return copied
}
