# AI Agent / Workflow -> Go Design Template

Source architecture: [awesome-architecture/templates/ai-agent-platform](https://github.com/study8677/awesome-architecture/blob/609e0cd64d6af89549112379cbdd0f0e6cf63a3a/templates/ai-agent-platform/README.md)

## Architecture Problem

Agent 平台让模型从“回答”变成“行动”：规划、调用工具、观察结果、继续决策。它的核心不是一次 response，而是一条可追踪、可中断、可恢复的事件流。

第一阶段 Go 实验只练 session event flow：用户消息、tool call、tool result、assistant message 必须按顺序记录。

## Go Package Boundary

```text
agent/
  event.go        Event and tool call state
  session.go      Session append methods
  session_test.go Behavior tests
```

未来完整项目可以扩展为：

```text
internal/agent/session
internal/agent/event
internal/agent/runner
internal/agent/tool
internal/agent/graph
internal/agent/memory
```

## Core Types

```go
type EventType string

const (
    EventUserMessage      EventType = "user_message"
    EventToolCallStarted  EventType = "tool_call_started"
    EventToolCallFinished EventType = "tool_call_finished"
    EventAssistantMessage EventType = "assistant_message"
)

type Session struct {
    ID     string
    Events []Event
}
```

## Minimum Lab

创建一个 session，依次追加：

1. 用户消息。
2. tool call started。
3. tool call finished。
4. assistant message。

测试事件顺序、事件类型和 tool call ID。

## Production Expansion

- Runner 接 LLM streaming。
- Graph node routing。
- Tool sandbox 和权限审批。
- Human-in-the-loop。
- session persistence。
- OpenTelemetry trace 按 invocation、tool call、sub-agent 分层。
