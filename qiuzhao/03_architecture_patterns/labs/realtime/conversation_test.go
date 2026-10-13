package realtime

import "testing"

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
	if len(conversation.Messages()) != 2 {
		t.Fatalf("expected 2 stored messages, got %d", len(conversation.Messages()))
	}
}
