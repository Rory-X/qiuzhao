package tool

import (
	"context"
	"errors"
)

var ErrNotFound = errors.New("tool not found")

type Call struct {
	ID    string
	Name  string
	Input string
}

type Result struct {
	Content string
}

type Executor interface {
	Invoke(ctx context.Context, call Call) (Result, error)
}

type Registry map[string]Executor

func (r Registry) Invoke(ctx context.Context, call Call) (Result, error) {
	executor, ok := r[call.Name]
	if !ok {
		return Result{}, ErrNotFound
	}
	return executor.Invoke(ctx, call)
}

type FakeResult string

func (f FakeResult) Invoke(ctx context.Context, call Call) (Result, error) {
	select {
	case <-ctx.Done():
		return Result{}, ctx.Err()
	default:
	}
	return Result{Content: string(f)}, nil
}

type FakeError struct {
	Err error
}

func (f FakeError) Invoke(ctx context.Context, call Call) (Result, error) {
	if f.Err != nil {
		return Result{}, f.Err
	}
	return Result{}, errors.New("tool failed")
}
