package provider

import (
	"context"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type Job struct {
	ID      string
	Request core.ChatRequest
}

type Queue struct {
	jobs chan Job
}

func NewQueue(capacity int) *Queue {
	if capacity < 1 {
		capacity = 1
	}
	return &Queue{jobs: make(chan Job, capacity)}
}

func (q *Queue) TrySubmit(ctx context.Context, job Job) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	select {
	case q.jobs <- job:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return core.GatewayError{Class: core.ErrorOverloaded, Err: core.ErrProviderQueueFull}
	}
}

func (q *Queue) DrainOne() (Job, bool) {
	select {
	case job := <-q.jobs:
		return job, true
	default:
		return Job{}, false
	}
}
