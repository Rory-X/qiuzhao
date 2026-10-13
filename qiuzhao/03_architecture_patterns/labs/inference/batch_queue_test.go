package inference

import "testing"

func TestBatchQueueRejectsOverflowAndDrains(t *testing.T) {
	queue := NewBatchQueue(2)

	if err := queue.Enqueue(Request{ID: "req-1", Tokens: 10}); err != nil {
		t.Fatalf("enqueue req-1: %v", err)
	}
	if err := queue.Enqueue(Request{ID: "req-2", Tokens: 20}); err != nil {
		t.Fatalf("enqueue req-2: %v", err)
	}
	if err := queue.Enqueue(Request{ID: "req-3", Tokens: 30}); err != ErrQueueFull {
		t.Fatalf("expected ErrQueueFull, got %v", err)
	}

	batch := queue.Drain()
	if len(batch.Requests) != 2 {
		t.Fatalf("expected 2 requests, got %d", len(batch.Requests))
	}
	if queue.Len() != 0 {
		t.Fatalf("expected queue to be empty, got %d", queue.Len())
	}
}
