package lifecycle

import (
	"context"
	"sync"
	"testing"
	"time"
)

type blockingComponent struct {
	started chan struct{}

	mu       sync.Mutex
	shutdown bool
}

type recordingComponent struct {
	name     string
	recorder *eventRecorder
	started  chan string
}

type eventRecorder struct {
	mu     sync.Mutex
	events []string
}

func (r *eventRecorder) append(event string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, event)
}

func (r *eventRecorder) snapshot() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]string, len(r.events))
	copy(out, r.events)
	return out
}

func (c recordingComponent) Name() string {
	return c.name
}

func (c recordingComponent) Start(ctx context.Context) error {
	c.recorder.append("start:" + c.name)
	c.started <- c.name
	<-ctx.Done()
	return ctx.Err()
}

func (c recordingComponent) Shutdown(ctx context.Context) error {
	c.recorder.append("shutdown:" + c.name)
	return nil
}

func newBlockingComponent() *blockingComponent {
	return &blockingComponent{started: make(chan struct{})}
}

func (c *blockingComponent) Name() string {
	return "blocking"
}

func (c *blockingComponent) Start(ctx context.Context) error {
	close(c.started)
	<-ctx.Done()
	return ctx.Err()
}

func (c *blockingComponent) Shutdown(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.shutdown = true
	return nil
}

func (c *blockingComponent) ShutdownCalled() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.shutdown
}

func TestAppShutdownsComponentsAfterContextCancel(t *testing.T) {
	component := newBlockingComponent()
	app := App{
		Components:      []Component{component},
		ShutdownTimeout: time.Second,
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)

	go func() {
		done <- app.Run(ctx)
	}()

	<-component.started
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("run: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("shutdown timed out")
	}
	if !component.ShutdownCalled() {
		t.Fatal("expected shutdown")
	}
}

func TestGracefulDrainStopsIngressBeforeWorkers(t *testing.T) {
	recorder := &eventRecorder{}
	started := make(chan string, 2)
	app := App{
		Components: []Component{
			recordingComponent{name: "worker", recorder: recorder, started: started},
			recordingComponent{name: "ingress", recorder: recorder, started: started},
		},
		ShutdownTimeout: time.Second,
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)

	go func() {
		done <- app.Run(ctx)
	}()

	for i := 0; i < 2; i++ {
		select {
		case <-started:
		case <-time.After(time.Second):
			t.Fatal("component did not start")
		}
	}
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("run: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("shutdown timed out")
	}

	events := recorder.snapshot()
	ingressShutdown := indexOf(events, "shutdown:ingress")
	workerShutdown := indexOf(events, "shutdown:worker")
	if ingressShutdown == -1 || workerShutdown == -1 {
		t.Fatalf("missing shutdown events: %v", events)
	}
	if ingressShutdown > workerShutdown {
		t.Fatalf("ingress must stop before workers drain: %v", events)
	}
}

func indexOf(events []string, want string) int {
	for i, event := range events {
		if event == want {
			return i
		}
	}
	return -1
}
