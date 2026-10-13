# Inference Lab Walkthrough

Local package: [`../../../architecture_labs/inference`](../../../architecture_labs/inference)

Architecture source:

- [Inference Serving template](../../architecture-to-go/templates/inference-serving.md)
- [Go by Example worker pool](../source-segments/language-segments.md#segment-worker-pool)
- [Bifrost provider queue](../source-segments/large-system-segments.md#segment-provider-queue)
- [Concurrency And Backpressure](../concepts/concurrency-backpressure.md)

## What This Lab Practices

The lab practices bounded admission:

```text
capacity = 2
first request -> accepted
second request -> accepted
third request -> ErrQueueFull
drain -> returns batch and empties queue
```

## Test First Reading

```go
func TestBatchQueueRejectsOverflowAndDrains(t *testing.T) {
	queue := NewBatchQueue(2)

	_ = queue.Enqueue(Request{ID: "req-1", Tokens: 10})
	_ = queue.Enqueue(Request{ID: "req-2", Tokens: 20})
	if err := queue.Enqueue(Request{ID: "req-3", Tokens: 30}); err != ErrQueueFull {
		t.Fatalf("expected ErrQueueFull, got %v", err)
	}
}
```

Why this matters:

- Overload is a behavior, not an accident.
- Queue full has a stable error.
- This pattern maps directly to provider queue admission.

## Implementation Reading

```go
func (q *BatchQueue) Enqueue(request Request) error {
	if len(q.items) >= q.capacity {
		return ErrQueueFull
	}
	q.items = append(q.items, request)
	return nil
}
```

This is not concurrent yet. It deliberately shows the policy before adding locks or channels.

Drain copies:

```go
func (q *BatchQueue) Drain() Batch {
	requests := make([]Request, len(q.items))
	copy(requests, q.items)
	q.items = q.items[:0]
	return Batch{Requests: requests}
}
```

Why it matters:

- The caller receives a stable batch.
- Internal queue can be reused.
- This follows container-copy boundary guidance.

## What Is Missing For Production

- Mutex or channel-based concurrency safety.
- Deadline-aware scheduling.
- Token-based capacity instead of request count.
- Priority queue.
- Metrics: queue depth, queue full count, drain size.
- Context cancellation.

## Next Tests

Token budget:

```go
func TestBatchQueueRejectsWhenTokenBudgetExceeded(t *testing.T) {
	queue := NewTokenQueue(100)
	require.NoError(t, queue.Enqueue(Request{ID: "r1", Tokens: 80}))
	require.ErrorIs(t, queue.Enqueue(Request{ID: "r2", Tokens: 30}), ErrQueueFull)
}
```

Metrics:

```go
func TestQueueReportsDepth(t *testing.T) {
	queue := NewBatchQueue(2)
	_ = queue.Enqueue(Request{ID: "r1"})
	if queue.Len() != 1 {
		t.Fatalf("expected depth 1")
	}
}
```

## Production Translation

```go
type AdmissionQueue struct {
	capacity int
	ch       chan Request
}

func (q AdmissionQueue) TryEnqueue(ctx context.Context, req Request) error {
	select {
	case q.ch <- req:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return ErrQueueFull
	}
}
```

## Knowledge Backlinks

- [Bounded queue pattern](../go-code-patterns.md#4-bounded-queue)
- [Worker pool pattern](../go-code-patterns.md#5-worker-pool)
- [Production readiness: Rate Limit And Backpressure](../production-readiness-checklist.md#rate-limit-and-backpressure)
