# Realtime Lab Walkthrough

Local package: [`../../../architecture_labs/realtime`](../../../architecture_labs/realtime)

Architecture source:

- [Realtime Chat template](../../architecture-to-go/templates/realtime-chat.md)
- [NATS segment cards](../source-segments/large-system-segments.md#nats-ionats-server)
- [Concurrency And Backpressure](../concepts/concurrency-backpressure.md)

## What This Lab Practices

The lab practices conversation-local ordering and idempotency:

```text
client message 1 -> seq 1
client message 2 -> seq 2
duplicate client message 1 -> return original seq 1
```

## Test First Reading

```go
func TestConversationAssignsSequenceAndDeduplicatesClientMessages(t *testing.T) {
	conversation := NewConversation("conv-1")

	first := conversation.Accept("client-msg-1", "hello")
	second := conversation.Accept("client-msg-2", "world")
	duplicate := conversation.Accept("client-msg-1", "hello again")

	if first.Seq != 1 || second.Seq != 2 {
		t.Fatalf("expected seq 1 and 2, got %d and %d", first.Seq, second.Seq)
	}
	if duplicate.Seq != first.Seq || duplicate.Body != first.Body {
		t.Fatalf("expected duplicate to return original message, got %+v", duplicate)
	}
}
```

Why this matters:

- Realtime systems rarely need global order.
- They do need order within the smallest meaningful scope, such as conversation/session.
- Client-generated idempotency keys prevent duplicate sends during retry.

## Implementation Reading

```go
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
```

Learning points:

- `seen` is an idempotency map.
- `nextSeq` is scoped to a conversation.
- Duplicate input returns original output, not an error.

`Messages()` copies:

```go
func (c *Conversation) Messages() []Message {
	copied := make([]Message, len(c.messages))
	copy(copied, c.messages)
	return copied
}
```

## What Is Missing For Production

- mutex/concurrent safety.
- persistent inbox.
- ack protocol.
- offline replay.
- user-to-gateway route table.
- fan-out and slow consumer handling.
- presence TTL.

## Next Tests

Ack:

```go
func TestConversationTracksAck(t *testing.T) {
	conversation := NewConversation("c1")
	msg := conversation.Accept("client-1", "hello")

	conversation.Ack("user-1", msg.Seq)

	if conversation.LastAck("user-1") != msg.Seq {
		t.Fatal("expected ack to be recorded")
	}
}
```

Offline replay:

```go
func TestConversationReturnsMessagesAfterSeq(t *testing.T) {
	conversation := NewConversation("c1")
	conversation.Accept("m1", "hello")
	conversation.Accept("m2", "world")

	messages := conversation.After(1)
	if len(messages) != 1 || messages[0].Seq != 2 {
		t.Fatalf("expected only seq 2, got %+v", messages)
	}
}
```

## Production Translation

```go
type Inbox interface {
	Append(ctx context.Context, conversationID string, msg Message) error
	After(ctx context.Context, conversationID string, seq int64) ([]Message, error)
	Ack(ctx context.Context, userID string, conversationID string, seq int64) error
}
```

## Knowledge Backlinks

- [NATS subject and subscription](../source-segments/large-system-segments.md#segment-subject-and-subscription)
- [Pub/Sub With Slow Consumer Policy](../go-code-patterns.md#15-pubsub-with-slow-consumer-policy)
- [Production readiness: Observability](../production-readiness-checklist.md#observability)
