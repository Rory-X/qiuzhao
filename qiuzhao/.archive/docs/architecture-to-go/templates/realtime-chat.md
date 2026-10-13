# Realtime Chat -> Go Design Template

Source architecture: [awesome-architecture/templates/realtime-chat](https://github.com/study8677/awesome-architecture/blob/609e0cd64d6af89549112379cbdd0f0e6cf63a3a/templates/realtime-chat/README.md)

## Architecture Problem

实时通讯系统的核心是长连接、消息时序、ack、重试、去重、离线补齐和群扩散。

第一阶段 Go 实验只练会话内序号和幂等去重。因为实时系统不需要全局有序，只需要在最小必要范围内保序。

## Go Package Boundary

```text
realtime/
  message.go       Message model
  conversation.go  Sequence and dedupe
  conversation_test.go
```

未来完整项目可以扩展为：

```text
internal/realtime/gateway
internal/realtime/route
internal/realtime/conversation
internal/realtime/inbox
internal/realtime/presence
```

## Core Types

```go
type Message struct {
    ClientID string
    Seq      int64
    Body     string
}

type Conversation struct {
    ID string
}
```

## Minimum Lab

同一个 conversation：

- 第一个 client message 得到 seq 1。
- 第二个 client message 得到 seq 2。
- 重复 client ID 不新增消息，返回原消息。

## Production Expansion

- WebSocket gateway。
- ack/retry protocol。
- offline inbox。
- user -> gateway route table。
- group fan-out strategy。
- presence TTL。
