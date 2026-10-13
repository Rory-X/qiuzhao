package stream

import (
	"context"

	"example.com/capstone-ai-gateway-agent-runtime/internal/agent/event"
)

type Cursor struct {
	SessionID string
	Offset    int
}

type EventReader interface {
	List(ctx context.Context, sessionID string) ([]event.Event, error)
}

func ReplayFrom(ctx context.Context, reader EventReader, cursor Cursor, send func(event.Event) error) error {
	events, err := reader.List(ctx, cursor.SessionID)
	if err != nil {
		return err
	}
	if cursor.Offset < 0 {
		cursor.Offset = 0
	}
	if cursor.Offset > len(events) {
		return nil
	}
	for _, evt := range events[cursor.Offset:] {
		if err := send(evt); err != nil {
			return err
		}
	}
	return nil
}
