package outbox

import (
	"context"
	"time"
)

type Publisher func(ctx context.Context, event Event) error

type Backoff func(attempts int) time.Duration

type Worker struct {
	Store       Store
	Publish     Publisher
	Now         func() time.Time
	Backoff     Backoff
	Limit       int
	MaxAttempts int
}

func (w Worker) RunOnce(ctx context.Context) error {
	now := w.now()
	events, err := w.Store.ClaimDue(ctx, now, w.Limit)
	if err != nil {
		return err
	}
	for _, event := range events {
		if err := w.Publish(ctx, event); err != nil {
			nextAttempt := event.Attempts + 1
			if w.MaxAttempts > 0 && nextAttempt >= w.MaxAttempts {
				if markErr := w.Store.MarkDeadLetter(ctx, event.ID); markErr != nil {
					return markErr
				}
				continue
			}
			if markErr := w.Store.MarkRetry(ctx, event.ID, now.Add(w.backoff(nextAttempt))); markErr != nil {
				return markErr
			}
			continue
		}
		if err := w.Store.MarkDone(ctx, event.ID); err != nil {
			return err
		}
	}
	return nil
}

func (w Worker) now() time.Time {
	if w.Now != nil {
		return w.Now()
	}
	return time.Now()
}

func (w Worker) backoff(attempts int) time.Duration {
	if w.Backoff != nil {
		return w.Backoff(attempts)
	}
	return time.Duration(attempts) * time.Second
}
