# Concept: Concurrency And Backpressure

高并发系统的重点不是“开更多 goroutine”，而是控制进入系统的工作量：deadline、限流、队列容量、丢弃策略、优雅关闭和观测。

## Source Backlinks

- [Go by Example](../../github-materials/language-basics.md#mmcgranagobyexample)：worker pool、rate limiting、context。
- [Uber Go Guide](../../github-materials/project-structure-style.md#uber-goguide)：channel buffer 和 goroutine 生命周期。
- [Hertz](../../github-materials/advanced-systems.md#cloudwegohertz)：高性能 HTTP server 和 middleware。
- [NATS](../../github-materials/advanced-systems.md#nats-ionats-server)：消息 fan-out、连接和背压。
- [Inference Serving template](../../architecture-to-go/templates/inference-serving.md)：bounded batch queue。

## Local Go Backlinks

- [`architecture_labs/inference`](../../../architecture_labs/inference/batch_queue.go)：容量受限队列。
- [`architecture_labs/realtime`](../../../architecture_labs/realtime/conversation.go)：会话内幂等和顺序。
- Future: `gateway_lab` per-key token bucket and provider worker pool.

## Go Design Rule

每条异步链路都要先回答：

- 队列最大容量是多少？
- 队列满了拒绝、降级还是阻塞？
- context 取消后 goroutine 如何退出？
- 错误和指标从哪里出来？

## Code Patterns

Bounded queue:

```go
type Queue[T any] struct {
	items chan T
}

func (q *Queue[T]) TryPut(item T) error {
	select {
	case q.items <- item:
		return nil
	default:
		return ErrQueueFull
	}
}
```

Worker shutdown:

```go
func worker(ctx context.Context, jobs <-chan Job, handle func(context.Context, Job) error) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case job, ok := <-jobs:
			if !ok {
				return nil
			}
			if err := handle(ctx, job); err != nil {
				return err
			}
		}
	}
}
```

Slow consumer policy:

```go
func publish(ch chan<- Message, msg Message) bool {
	select {
	case ch <- msg:
		return true
	default:
		return false // drop, retry, disconnect, or dead-letter by policy
	}
}
```

More patterns: [`../go-code-patterns.md`](../go-code-patterns.md).

## Failure Modes

- 无界 channel 或无界 slice 让内存成为隐藏队列。
- goroutine 没有退出路径，压测时泄漏。
- 重试没有预算，provider 故障时放大流量。

## Source To Code Deep Dive

这个概念的完整闭环：

```text
Go by Example worker pool/rate limit/context
  -> Uber channel size and goroutine lifecycle
  -> NATS slow consumer handling
  -> architecture_labs/inference bounded queue
  -> capstone provider queue + stream bus + async telemetry
```

关键本地代码：

- Provider queue: [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go)
- Slow consumer bus: [`../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go)
- Async telemetry queue: [`../../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go)
- Inference lab: [`../../../architecture_labs/inference/batch_queue.go`](../../../architecture_labs/inference/batch_queue.go)

Provider queue 的规则：满了就显式返回 overload，不把压力藏进内存。

```go
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
```

慢消费者策略：实时流可以 drop，但要计数，并且 durable event store 要能补齐。

```go
func (b *Bus) Publish(sessionID string, evt event.Event) {
	b.mu.RLock()
	subs := append([]chan event.Event(nil), b.subs[sessionID]...)
	b.mu.RUnlock()

	for _, sub := range subs {
		select {
		case sub <- evt:
		default:
			b.mu.Lock()
			b.dropped++
			b.mu.Unlock()
		}
	}
}
```

最重要测试：发布不能被慢消费者卡住。

```go
func TestBusDoesNotBlockOnSlowSubscriber(t *testing.T) {
	bus := NewBus()
	sub := bus.Subscribe("session-1", 1)

	bus.Publish("session-1", event.Event{ID: "event-1", Type: event.UserMessage})
	bus.Publish("session-1", event.Event{ID: "event-2", Type: event.AssistantMessage})

	select {
	case got := <-sub:
		if got.ID != "event-1" {
			t.Fatalf("first event: %+v", got)
		}
	case <-time.After(time.Second):
		t.Fatal("publish blocked behind slow subscriber")
	}
	if bus.Dropped() != 1 {
		t.Fatalf("dropped: want 1 got %d", bus.Dropped())
	}
}
```

继续扩展时优先读：

- [`../production-patterns-cookbook.md#bounded-provider-executor`](../production-patterns-cookbook.md#bounded-provider-executor)
- [`../production-patterns-cookbook.md#stream-replay-cursor`](../production-patterns-cookbook.md#stream-replay-cursor)
- [`../production-patterns-cookbook.md#graceful-drain`](../production-patterns-cookbook.md#graceful-drain)
- [`../key-code-index.md#12-streaming-bus-and-slow-consumer-policy`](../key-code-index.md#12-streaming-bus-and-slow-consumer-policy)
