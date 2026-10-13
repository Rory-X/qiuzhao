# Source: awesome-architecture

Source repository: [study8677/awesome-architecture](https://github.com/study8677/awesome-architecture)

Snapshot used: `609e0cd64d6af89549112379cbdd0f0e6cf63a3a`

## Why This Source Matters

`awesome-architecture` 的价值是把系统按统一 14 段结构讲清楚：

- 一句话定位。
- 业务本质。
- 需求和约束。
- 架构全景图。
- 组件职责。
- 关键数据流。
- 数据模型和存储。
- 决策和权衡。
- 规模化和瓶颈。
- 安全与合规。
- 反模式。
- 演进路线。
- 可复用要点。
- 参考项目。

这套结构适合直接变成 Go 学习模板。Go 代码只负责落其中一条核心机制，不负责一次性复刻完整系统。

## Selected Phase 1 Templates

- [`templates/ai-gateway/README.md`](https://github.com/study8677/awesome-architecture/blob/609e0cd64d6af89549112379cbdd0f0e6cf63a3a/templates/ai-gateway/README.md)
- [`templates/ai-agent-platform/README.md`](https://github.com/study8677/awesome-architecture/blob/609e0cd64d6af89549112379cbdd0f0e6cf63a3a/templates/ai-agent-platform/README.md)
- [`templates/rag-knowledge-base/README.md`](https://github.com/study8677/awesome-architecture/blob/609e0cd64d6af89549112379cbdd0f0e6cf63a3a/templates/rag-knowledge-base/README.md)
- [`templates/inference-serving/README.md`](https://github.com/study8677/awesome-architecture/blob/609e0cd64d6af89549112379cbdd0f0e6cf63a3a/templates/inference-serving/README.md)
- [`templates/realtime-chat/README.md`](https://github.com/study8677/awesome-architecture/blob/609e0cd64d6af89549112379cbdd0f0e6cf63a3a/templates/realtime-chat/README.md)
- [`templates/notification-system/README.md`](https://github.com/study8677/awesome-architecture/blob/609e0cd64d6af89549112379cbdd0f0e6cf63a3a/templates/notification-system/README.md)

## Translation Rule

架构模板里的“组件职责”和“关键数据流”转成 Go package。

架构模板里的“关键决策与权衡”转成 interface、错误处理和测试场景。

架构模板里的“规模化与瓶颈”转成扩展任务，例如把内存实现替换为 Redis、NATS、Postgres 或 OpenTelemetry。
