# Concept: Durable Workflow

可靠工作流解决的是“长时间、多步骤、有副作用的任务如何在失败后继续”。Agent runtime 里，长对话、工具调用、人工介入和异步任务都会遇到这个问题。

## Source Backlinks

- [Temporal](../../github-materials/advanced-systems.md#temporaliotemporal)：workflow history、matching、worker model。
- [NATS](../../github-materials/advanced-systems.md#nats-ionats-server)：异步消息和持久流。
- [Syncthing](../../github-materials/real-projects.md#syncthingsyncthing)：安全目标、协议边界和长期运行状态。
- [Notification System template](../../architecture-to-go/templates/notification-system.md)：重试、死信、投递状态。

## Local Go Backlinks

- [`architecture_labs/agent`](../../../architecture_labs/agent/session.go)：事件流是 durable workflow 的最小前置。
- [`architecture_labs/notification`](../../../architecture_labs/notification/pipeline.go)：去重、限频和优先级。

## Go Design Rule

一条 durable workflow 至少需要：

- stable ID：workflow/run/tool call/step。
- event history：可重放的事实记录。
- idempotency key：重复执行不会造成双写副作用。
- retry budget：重试次数、间隔和截止时间。
- compensation：失败后的人工或自动修复路径。

## Code Patterns

Append-only event history:

```go
type WorkflowEvent struct {
	ID         string
	WorkflowID string
	Type       string
	Payload    []byte
	CreatedAt  time.Time
}

type HistoryStore interface {
	Append(ctx context.Context, event WorkflowEvent) error
	List(ctx context.Context, workflowID string) ([]WorkflowEvent, error)
}
```

Replay:

```go
func Replay(events []WorkflowEvent) WorkflowState {
	var state WorkflowState
	for _, event := range events {
		state.Apply(event)
	}
	return state
}
```

Idempotent activity:

```go
func (w Worker) Execute(ctx context.Context, task Task) error {
	done, err := w.store.WasCompleted(ctx, task.IdempotencyKey)
	if err != nil || done {
		return err
	}

	if err := w.activity.Run(ctx, task.Payload); err != nil {
		return err
	}
	return w.store.MarkCompleted(ctx, task.IdempotencyKey)
}
```

More patterns: [`../go-code-patterns.md`](../go-code-patterns.md).

## Failure Modes

- 只保存最终状态，不保存事件历史，无法解释为什么失败。
- tool call 不幂等，重试造成重复扣费或重复发通知。
- worker 崩溃后内存任务丢失。

## Source To Code Deep Dive

这个概念的完整闭环：

```text
Temporal history/replay/worker
  -> NATS durable stream and delivery pressure
  -> Syncthing protocol and long-running state
  -> architecture_labs/notification idempotency
  -> capstone event store + graph interrupt + idempotency store
```

关键本地代码：

- Event replay: [`../../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go)
- Memory event store: [`../../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go)
- Graph interrupt: [`../../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph.go)
- Idempotency: [`../../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store.go)

Replay 的关键：状态来自事件折叠，不是散落的 mutable fields。

```go
func Replay(events []Event) State {
	state := State{
		Status:       StatusRunning,
		RunningTools: map[string]ToolCall{},
	}

	for _, event := range events {
		switch event.Type {
		case UserMessage:
			state.Messages = append(state.Messages, Message{Role: "user", Content: event.Content})
		case ToolStarted:
			state.RunningTools[event.ToolCallID] = ToolCall{ID: event.ToolCallID, Name: event.ToolName}
		case ToolFinished:
			delete(state.RunningTools, event.ToolCallID)
		case ToolFailed:
			delete(state.RunningTools, event.ToolCallID)
			state.Status = StatusFailed
		case RunInterrupted:
			state.Status = StatusInterrupted
		case RunCompleted:
			state.Status = StatusCompleted
		}
	}
	return state
}
```

Graph interrupt 是 durable workflow 的一个学习版信号：

```go
if result.Interrupt {
	if err := g.events.Append(ctx, sessionID, event.Event{
		Type:    event.RunInterrupted,
		NodeID:  current,
		Content: result.Reason,
	}); err != nil {
		return err
	}
	return ErrInterrupted
}
```

幂等存储防止副作用重复执行：

```go
claimed, err := store.Claim(ctx, idempotencyKey)
if err != nil {
	return err
}
if !claimed {
	return nil
}
return runSideEffect(ctx)
```

继续扩展时优先读：

- [`../production-patterns-cookbook.md#tool-idempotency`](../production-patterns-cookbook.md#tool-idempotency)
- [`../production-patterns-cookbook.md#event-outbox`](../production-patterns-cookbook.md#event-outbox)
- [`../production-patterns-cookbook.md#event-version-and-upcaster`](../production-patterns-cookbook.md#event-version-and-upcaster)
- [`../key-code-index.md#10-event-replay`](../key-code-index.md#10-event-replay)
