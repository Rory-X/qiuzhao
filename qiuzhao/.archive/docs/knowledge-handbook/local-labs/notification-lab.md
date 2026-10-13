# Notification Lab Walkthrough

Local package: [`../../../architecture_labs/notification`](../../../architecture_labs/notification)

Architecture source:

- [Notification System template](../../architecture-to-go/templates/notification-system.md)
- [Memos side effects](../source-segments/real-project-segments.md#segment-main-path-and-best-effort-effects)
- [Durable Workflow concept](../concepts/durable-workflow.md)

## What This Lab Practices

The lab practices three notification fundamentals:

```text
dedupe
  -> same notification ID accepted once

per-user limit
  -> user cannot exceed configured count

priority delivery
  -> high priority drains first
```

## Test First Reading

```go
func TestPipelineDeduplicatesLimitsAndDrainsByPriority(t *testing.T) {
	pipeline := NewPipeline(2)

	if accepted := pipeline.Accept(Notification{ID: "n1", UserID: "u1", Priority: 1, Body: "low"}); !accepted {
		t.Fatal("expected n1 to be accepted")
	}
	if accepted := pipeline.Accept(Notification{ID: "n1", UserID: "u1", Priority: 1, Body: "duplicate"}); accepted {
		t.Fatal("expected duplicate n1 to be suppressed")
	}
}
```

Why this matters:

- Notification systems are not just “send message”.
- Duplicate suppression and per-user limits protect user experience.
- Priority matters when queue capacity is constrained.

## Implementation Reading

Deduplication:

```go
if _, ok := p.seen[notification.ID]; ok {
	return false
}
```

Per-user limit:

```go
if p.userCounts[notification.UserID] >= p.perUserLimit {
	return false
}
```

Priority drain:

```go
sort.SliceStable(delivered, func(i, j int) bool {
	return delivered[i].Priority > delivered[j].Priority
})
```

Learning points:

- `seen` is a simple idempotency store.
- `userCounts` is a simple quota counter.
- `sort.SliceStable` keeps deterministic behavior for equal priority.

## What Is Missing For Production

- channel adapters: email, SMS, push, in-app.
- retry with backoff.
- dead letter queue.
- persistent delivery status.
- user preferences and quiet hours.
- per-channel limits.
- idempotency key across external providers.

## Next Tests

Quiet hours:

```go
func TestPipelineSuppressesDuringQuietHours(t *testing.T) {
	pipeline := NewPipelineWithPreferences(Preference{
		QuietHours: true,
	})

	accepted := pipeline.Accept(Notification{ID: "n1", UserID: "u1", Priority: 1})
	if accepted {
		t.Fatal("expected notification suppressed during quiet hours")
	}
}
```

Retry and dead letter:

```go
func TestDeliveryMovesToDeadLetterAfterRetries(t *testing.T) {
	delivery := NewDelivery(alwaysFailChannel{}, MaxRetries(3))
	err := delivery.Send(context.Background(), Notification{ID: "n1"})
	if !errors.Is(err, ErrDeadLettered) {
		t.Fatalf("expected dead letter, got %v", err)
	}
}
```

## Production Translation

```go
type Channel interface {
	Send(ctx context.Context, notification Notification) error
}

type DeliveryStore interface {
	WasSent(ctx context.Context, idempotencyKey string) (bool, error)
	MarkSent(ctx context.Context, idempotencyKey string) error
	MarkFailed(ctx context.Context, id string, err error) error
}
```

## Knowledge Backlinks

- [Main path and best-effort effects](../source-segments/real-project-segments.md#segment-main-path-and-best-effort-effects)
- [No Idempotency For External Side Effects](../architecture-anti-patterns.md#anti-pattern-12-no-idempotency-for-external-side-effects)
- [Production readiness: Security And Cost](../production-readiness-checklist.md#security-and-cost)
