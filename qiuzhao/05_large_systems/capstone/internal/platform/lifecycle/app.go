package lifecycle

import (
	"context"
	"errors"
	"fmt"
	"time"
)

type Component interface {
	Name() string
	Start(ctx context.Context) error
	Shutdown(ctx context.Context) error
}

type App struct {
	Components      []Component
	ShutdownTimeout time.Duration
}

func (a App) Run(ctx context.Context) error {
	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	errs := make(chan error, len(a.Components))
	for _, component := range a.Components {
		c := component
		go func() {
			if err := c.Start(runCtx); err != nil && !errors.Is(err, context.Canceled) {
				errs <- fmt.Errorf("%s start: %w", c.Name(), err)
			}
		}()
	}

	select {
	case <-ctx.Done():
	case err := <-errs:
		cancel()
		return err
	}

	timeout := a.ShutdownTimeout
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), timeout)
	defer shutdownCancel()

	var shutdownErrs []error
	for i := len(a.Components) - 1; i >= 0; i-- {
		if err := a.Components[i].Shutdown(shutdownCtx); err != nil {
			shutdownErrs = append(shutdownErrs, fmt.Errorf("%s shutdown: %w", a.Components[i].Name(), err))
		}
	}
	return errors.Join(shutdownErrs...)
}
