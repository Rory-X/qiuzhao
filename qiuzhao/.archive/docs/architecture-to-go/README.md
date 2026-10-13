# Architecture To Go

这个目录把 [awesome-architecture](https://github.com/study8677/awesome-architecture) 的架构模板落到 Go 学习中。

原仓库只讲架构，不讲语言。本工作区做下一步：把架构地图转成 Go 设计模板、package 边界、核心接口和可运行代码实验。

## 第一批模板

先做 6 个与你目标最贴近的系统：

1. [`AI Gateway`](templates/ai-gateway.md)：统一模型入口、provider 路由、fallback、限流、观测。
2. [`AI Agent / Workflow`](templates/ai-agent-platform.md)：session、event、tool call、graph、human-in-the-loop。
3. [`RAG Knowledge Base`](templates/rag-knowledge-base.md)：文档入库、chunk、retrieve、rerank、citation。
4. [`Inference Serving`](templates/inference-serving.md)：batch、queue、容量、调度、尾延迟。
5. [`Realtime Chat`](templates/realtime-chat.md)：长连接、会话内序号、ack、重试、去重。
6. [`Notification System`](templates/notification-system.md)：事件转通知、队列、去重、限频、优先级。

## Code Labs

对应代码在 [`../../architecture_labs`](../../architecture_labs/README.md)。

6 个模板到本地真实源码和测试的逐段代码锚点见 [`lab-code-anchors.md`](lab-code-anchors.md)。

把模板继续推进到大业务系统实现时，优先读这三份代码化手册：

- [`../knowledge-handbook/reference-implementations.md`](../knowledge-handbook/reference-implementations.md)：AI Gateway、Agent Runtime、Telemetry、Lifecycle 的 Go 参考实现代码块。
- [`../knowledge-handbook/system-blueprints.md`](../knowledge-handbook/system-blueprints.md)：chat、fallback、streaming、agent、tool、RAG、observability、HA 的关键链路蓝图。
- [`../knowledge-handbook/mental-models-glossary.md`](../knowledge-handbook/mental-models-glossary.md)：provider、route plan、event store、replay、DLQ 等术语反查。
- [`../knowledge-handbook/source-code-anchors-advanced.md`](../knowledge-handbook/source-code-anchors-advanced.md)：Bifrost、Temporal、NATS、OTel 等真实源码锚点如何反哺这些模板。

每个 package 只实现一个核心机制：

- `gateway`：provider fallback selection。
- `agent`：session event flow。
- `rag`：chunk/retrieve/rerank/citation。
- `inference`：bounded batch queue。
- `realtime`：sequence + dedupe。
- `notification`：dedupe + rate limit + priority.

## Reading Method

不要背架构图。每个模板都问五个问题：

1. 这类系统的业务本质是什么？
2. 哪些质量属性是硬约束？
3. 数据流里哪一步最容易成为瓶颈？
4. 在 Go 里应该拆成哪些 package 和 interface？
5. 最小代码实验能练到哪个核心机制？

## Source

来源快照见 [`source-awesome-architecture.md`](source-awesome-architecture.md)。

第一批映射矩阵见 [`phase-1-matrix.md`](phase-1-matrix.md)。
