# Notification System -> Go Design Template

Source architecture: [awesome-architecture/templates/notification-system](https://github.com/study8677/awesome-architecture/blob/609e0cd64d6af89549112379cbdd0f0e6cf63a3a/templates/notification-system/README.md)

## Architecture Problem

通知系统把事件变成用户触达。它的重点不是“能发”，而是异步、可靠、去重、限频、分优先级和尊重用户偏好。

第一阶段 Go 实验只练 dedupe + per-user limit + priority delivery。

## Go Package Boundary

```text
notification/
  notification.go  Notification model
  pipeline.go      Dedupe, limit, priority
  pipeline_test.go
```

未来完整项目可以扩展为：

```text
internal/notification/event
internal/notification/preference
internal/notification/template
internal/notification/queue
internal/notification/channel
internal/notification/delivery
```

## Core Types

```go
type Notification struct {
    ID       string
    UserID   string
    Priority int
    Body     string
}
```

## Minimum Lab

- 同一个 notification ID 只接收一次。
- 同一用户超过 limit 后拒绝。
- drain 时高优先级先出队。

## Production Expansion

- 多渠道 adapter：push、email、SMS、IM。
- user preference 和免打扰。
- retry with backoff。
- dead letter queue。
- delivery status tracking。
- priority queue per channel。
