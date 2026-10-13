package idempotency

import (
	"context"
	"testing"
)

func TestClaimSuppressesDuplicateKey(t *testing.T) {
	store := NewStore()
	first, err := store.Claim(context.Background(), "tool:session-1:call-1")
	if err != nil {
		t.Fatalf("claim first: %v", err)
	}
	second, err := store.Claim(context.Background(), "tool:session-1:call-1")
	if err != nil {
		t.Fatalf("claim second: %v", err)
	}

	if !first {
		t.Fatal("first claim should win")
	}
	if second {
		t.Fatal("duplicate claim should be suppressed")
	}
	if !store.Seen("tool:session-1:call-1") {
		t.Fatal("expected key to be remembered")
	}
}
