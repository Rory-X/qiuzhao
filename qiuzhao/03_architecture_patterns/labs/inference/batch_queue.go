package inference

import "errors"

var ErrQueueFull = errors.New("batch queue full")

type BatchQueue struct {
	capacity int
	items    []Request
}

func NewBatchQueue(capacity int) *BatchQueue {
	if capacity < 1 {
		capacity = 1
	}
	return &BatchQueue{capacity: capacity}
}

func (q *BatchQueue) Enqueue(request Request) error {
	if len(q.items) >= q.capacity {
		return ErrQueueFull
	}
	q.items = append(q.items, request)
	return nil
}

func (q *BatchQueue) Drain() Batch {
	requests := make([]Request, len(q.items))
	copy(requests, q.items)
	q.items = q.items[:0]
	return Batch{Requests: requests}
}

func (q *BatchQueue) Len() int {
	return len(q.items)
}
