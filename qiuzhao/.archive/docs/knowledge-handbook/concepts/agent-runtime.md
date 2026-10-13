# Concept: Agent Runtime

Agent runtime 的核心不是一次模型响应，而是一条可追踪、可恢复、可中断的事件流：user message、model decision、tool call、tool result、assistant message。

## Source Backlinks

- [awesome-architecture AI Agent Platform](../../architecture-to-go/templates/ai-agent-platform.md)：session/event/tool/graph 的 Go 模板。
- [trpc-agent-go](../../github-materials/advanced-systems.md#trpc-grouptrpc-agent-go)：Go agent runtime 参考源。
- [Temporal](../../github-materials/advanced-systems.md#temporaliotemporal)：长流程恢复和 durable execution 思想。
- [Memos](../../github-materials/real-projects.md#usememosmemos)：业务副作用、通知和 SSE broadcast。
- [Evrone clean template](../../github-materials/architecture-patterns.md#evronego-clean-template)：状态机不要散落到 controller。

## Local Go Backlinks

- [`architecture_labs/agent`](../../../architecture_labs/agent/session.go)：最小 session event flow。
- [`architecture_labs/realtime`](../../../architecture_labs/realtime/conversation.go)：会话内序号和幂等去重。

## Current Lab

当前最小代码只保护事件顺序：

```text
user_message -> tool_call_started -> tool_call_finished -> assistant_message
```

这个顺序是未来 agent trace、UI timeline、恢复执行和审计日志的基础。

## Code Patterns

Event store:

```go
type EventStore interface {
	Append(ctx context.Context, sessionID string, event Event) error
	List(ctx context.Context, sessionID string) ([]Event, error)
}
```

Tool execution:

```go
func (r Runner) RunTool(ctx context.Context, sessionID string, call ToolCall) error {
	if err := r.events.Append(ctx, sessionID, Event{Type: EventToolCallStarted, ToolCallID: call.ID}); err != nil {
		return err
	}
	result, err := r.tools.Invoke(ctx, call.Name, call.Args)
	if err != nil {
		_ = r.events.Append(ctx, sessionID, Event{Type: EventToolCallFailed, ToolCallID: call.ID, Content: err.Error()})
		return err
	}
	return r.events.Append(ctx, sessionID, Event{Type: EventToolCallFinished, ToolCallID: call.ID, Content: result})
}
```

More patterns: [`../go-code-patterns.md`](../go-code-patterns.md).

## Production Expansion

- `Runner`：消费 session/event，驱动 LLM 和 tool。
- `ToolExecutor`：权限、超时、sandbox、输入输出记录。
- `Graph`：节点路由、分支、循环、human interrupt。
- `EventStore`：持久化 timeline，支持重放。
- `SSE/WebSocket`：向前端流式输出事件。

## Failure Modes

- tool call 没有稳定 ID，结果无法和调用对应。
- session 状态只存在内存，进程重启后丢失。
- 事件和 UI 消息混为一体，后续很难做恢复、审计和观测。

## Source To Code Deep Dive

这个概念的完整闭环：

```text
trpc-agent-go Agent/Runner/Event
  -> Temporal event history and command validation
  -> Memos realtime/broadcast side effects
  -> architecture_labs/agent
  -> capstone internal/agent/event + runner + graph + stream
```

关键本地代码：

- Event model: [`../../../capstone_ai_gateway_agent_runtime/internal/agent/event/event.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/event/event.go)
- Replay: [`../../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go)
- Runner: [`../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go)
- Graph: [`../../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph.go)
- Stream bus: [`../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go)

Runner 的主循环：每一步都从 event history replay 出 state，再让 model 产生下一条 command。

```go
func (r Runner) Run(ctx context.Context, sessionID string, input string) error {
	if err := r.events.Append(ctx, sessionID, event.Event{Type: event.UserMessage, Content: input}); err != nil {
		return err
	}

	for step := 0; step < r.maxStep; step++ {
		events, err := r.events.List(ctx, sessionID)
		if err != nil {
			return err
		}
		cmd, err := r.model.Next(ctx, event.Replay(events))
		if err != nil {
			return err
		}
		if err := r.applyCommand(ctx, sessionID, cmd); err != nil {
			return err
		}
		if cmd.Type == CommandAnswer {
			return r.events.Append(ctx, sessionID, event.Event{Type: event.RunCompleted})
		}
	}
	return ErrStepBudgetExceeded
}
```

Tool call 必须成为事件，而不是一次隐藏函数调用：

```go
if err := r.events.Append(ctx, sessionID, event.Event{
	Type:       event.ToolStarted,
	ToolCallID: cmd.Tool.ID,
	ToolName:   cmd.Tool.Name,
	Content:    cmd.Tool.Input,
}); err != nil {
	return err
}

result, err := r.tools.Invoke(ctx, *cmd.Tool)
if err != nil {
	_ = r.events.Append(ctx, sessionID, event.Event{
		Type:       event.ToolFailed,
		ToolCallID: cmd.Tool.ID,
		ToolName:   cmd.Tool.Name,
		Content:    err.Error(),
	})
	return err
}
```

测试验收的核心是事件序列：

```go
assertEventTypes(t, events, []event.EventType{
	event.UserMessage,
	event.ToolStarted,
	event.ToolFinished,
	event.AssistantMessage,
	event.RunCompleted,
})
```

继续扩展时优先读：

- [`../production-patterns-cookbook.md#tool-idempotency`](../production-patterns-cookbook.md#tool-idempotency)
- [`../production-patterns-cookbook.md#human-interrupt-and-resume`](../production-patterns-cookbook.md#human-interrupt-and-resume)
- [`../production-patterns-cookbook.md#event-version-and-upcaster`](../production-patterns-cookbook.md#event-version-and-upcaster)
- [`../key-code-index.md#9-agent-runner-and-tool-event-flow`](../key-code-index.md#9-agent-runner-and-tool-event-flow)
