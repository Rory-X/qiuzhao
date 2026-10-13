package telemetry

import (
	"context"
	"sync"
)

type AsyncExporter struct {
	next Sink

	queue chan Event
	done  chan struct{}

	mu      sync.Mutex
	dropped int
}

func NewAsyncExporter(next Sink, capacity int) *AsyncExporter {
	if capacity < 1 {
		capacity = 1
	}
	exporter := &AsyncExporter{
		next:  next,
		queue: make(chan Event, capacity),
		done:  make(chan struct{}),
	}
	go exporter.run()
	return exporter
}

func (e *AsyncExporter) Record(ctx context.Context, event Event) error {
	select {
	case e.queue <- event:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		e.mu.Lock()
		e.dropped++
		e.mu.Unlock()
		return nil
	}
}

func (e *AsyncExporter) Flush(ctx context.Context) error {
	for {
		if len(e.queue) == 0 {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
	}
}

func (e *AsyncExporter) Dropped() int {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.dropped
}

func (e *AsyncExporter) Close() {
	close(e.done)
}

func (e *AsyncExporter) run() {
	for {
		select {
		case event := <-e.queue:
			_ = e.next.Record(context.Background(), event)
		case <-e.done:
			return
		}
	}
}
