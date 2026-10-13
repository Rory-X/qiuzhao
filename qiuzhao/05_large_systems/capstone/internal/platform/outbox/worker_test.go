package outbox

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestOutboxRetriesWithBackoff(t *testing.T) {
	now := time.Date(2026, 7, 6, 12, 0, 0, 0, time.UTC)
	store := NewMemoryStore()
	if err := store.Append(context.Background(), Event{ID: "event-1", Topic: "agent.event"}); err != nil {
		t.Fatalf("append: %v", err)
	}
	worker := Worker{
		Store:       store,
		MaxAttempts: 3,
		Now:         func() time.Time { return now },
		Backoff:     func(attempts int) time.Duration { return time.Duration(attempts) * time.Minute },
		Publish: func(ctx context.Context, event Event) error {
			return errors.New("temporary publish error")
		},
	}

	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("run once: %v", err)
	}

	events := store.Events()
	if len(events) != 1 {
		t.Fatalf("events: %+v", events)
	}
	if events[0].Attempts != 1 {
		t.Fatalf("attempts: want 1 got %d", events[0].Attempts)
	}
	if !events[0].AvailableAt.Equal(now.Add(time.Minute)) {
		t.Fatalf("available at: %s", events[0].AvailableAt)
	}
	if events[0].DeadLetter {
		t.Fatal("event should not be dead-lettered yet")
	}
}

func TestOutboxMovesToDeadLetterAfterBudget(t *testing.T) {
	now := time.Date(2026, 7, 6, 12, 0, 0, 0, time.UTC)
	store := NewMemoryStore()
	if err := store.Append(context.Background(), Event{ID: "event-1", Attempts: 1}); err != nil {
		t.Fatalf("append: %v", err)
	}
	worker := Worker{
		Store:       store,
		MaxAttempts: 2,
		Now:         func() time.Time { return now },
		Publish: func(ctx context.Context, event Event) error {
			return errors.New("permanent publish error")
		},
	}

	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("run once: %v", err)
	}

	events := store.Events()
	if !events[0].DeadLetter {
		t.Fatalf("expected dead letter: %+v", events[0])
	}
	if events[0].Attempts != 2 {
		t.Fatalf("attempts: want 2 got %d", events[0].Attempts)
	}
}
