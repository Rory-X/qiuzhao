package telemetry

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestAsyncExporterExportsQueuedEvents(t *testing.T) {
	memory := NewMemoryExporter()
	exporter := NewAsyncExporter(memory, 4)
	defer exporter.Close()

	if err := exporter.Record(context.Background(), Event{Name: "gateway.provider_attempt", Provider: "openai"}); err != nil {
		t.Fatalf("record: %v", err)
	}
	waitFor(t, time.Second, func() bool {
		return memory.Contains("gateway.provider_attempt", map[string]string{"provider": "openai"})
	})
}

func TestAsyncExporterDropsWhenQueueFull(t *testing.T) {
	blocking := &blockingSink{started: make(chan struct{}), release: make(chan struct{})}
	exporter := NewAsyncExporter(blocking, 1)
	defer exporter.Close()

	_ = exporter.Record(context.Background(), Event{Name: "first"})
	<-blocking.started
	_ = exporter.Record(context.Background(), Event{Name: "second"})
	_ = exporter.Record(context.Background(), Event{Name: "third"})

	if exporter.Dropped() != 1 {
		t.Fatalf("dropped: want 1 got %d", exporter.Dropped())
	}
	close(blocking.release)
}

type blockingSink struct {
	started chan struct{}
	release chan struct{}
	once    sync.Once
}

func (s *blockingSink) Record(ctx context.Context, event Event) error {
	s.once.Do(func() { close(s.started) })
	select {
	case <-s.release:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func waitFor(t *testing.T, timeout time.Duration, ok func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if ok() {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("condition not met before timeout")
}
