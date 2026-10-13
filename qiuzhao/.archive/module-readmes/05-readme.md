# 05 Large Business Systems

目标：把 Go 后端学习从“小 API 服务”推进到大业务系统能力，最终能设计和实现一个 AI Gateway + Agent Runtime Lab。

你最后要掌握的不是某个框架，而是一组长期可迁移的系统能力：

- 高并发入口：连接管理、请求池化、队列、限流、超时、背压。
- 网关分发：模型/provider 路由、fallback、负载均衡、熔断、缓存、鉴权、额度。
- Agent 对话流：session、event stream、tool call、handoff、多 agent 编排、可中断执行。
- 高可用：优雅关闭、健康检查、重试策略、幂等、持久化任务状态。
- 控制面安全：配置热替换、跨引用校验、版本回滚、审计。
- 可观测：metrics、tracing、structured logging、审计日志、成本和延迟画像。
- 可靠工作流：长任务、异步任务、恢复、补偿、人工介入。

## GitHub 材料手册

本阶段是知识手册的终局应用层：

- 本目录详细分析：[`github-project-analysis.md`](github-project-analysis.md)
- 高级系统分段剖析：[`../docs/github-materials/advanced-systems.md`](../docs/github-materials/advanced-systems.md)
- 高级仓库源码锚点：[`../docs/knowledge-handbook/source-code-anchors-advanced.md`](../docs/knowledge-handbook/source-code-anchors-advanced.md)
- 来源到 Capstone 知识网络：[`../docs/knowledge-handbook/source-to-capstone-crosswalk.md#phase-05-large-system-sources-to-production-mechanisms`](../docs/knowledge-handbook/source-to-capstone-crosswalk.md#phase-05-large-system-sources-to-production-mechanisms)
- `awesome-architecture` 到 Go：[`../docs/architecture-to-go/README.md`](../docs/architecture-to-go/README.md)
- `awesome-architecture` 本地 Go 代码锚点：[`../docs/architecture-to-go/lab-code-anchors.md`](../docs/architecture-to-go/lab-code-anchors.md)
- 最终系统 Playbook：[`../docs/knowledge-handbook/ai-gateway-agent-runtime-playbook.md`](../docs/knowledge-handbook/ai-gateway-agent-runtime-playbook.md)
- Capstone 包级代码模板：[`../docs/knowledge-handbook/capstone-implementation-manual.md`](../docs/knowledge-handbook/capstone-implementation-manual.md)
- Capstone 可运行 Go module：[`../capstone_ai_gateway_agent_runtime/README.md`](../capstone_ai_gateway_agent_runtime/README.md)
- Capstone 关键代码块索引：[`../docs/knowledge-handbook/key-code-index.md`](../docs/knowledge-handbook/key-code-index.md)
- Go 代码模式库：[`../docs/knowledge-handbook/go-code-patterns.md`](../docs/knowledge-handbook/go-code-patterns.md)
- Go 参考实现代码块：[`../docs/knowledge-handbook/reference-implementations.md`](../docs/knowledge-handbook/reference-implementations.md)
- 生产模式 Go cookbook：[`../docs/knowledge-handbook/production-patterns-cookbook.md`](../docs/knowledge-handbook/production-patterns-cookbook.md)
- 大系统关键链路蓝图：[`../docs/knowledge-handbook/system-blueprints.md`](../docs/knowledge-handbook/system-blueprints.md)
- 术语/心智模型反查：[`../docs/knowledge-handbook/mental-models-glossary.md`](../docs/knowledge-handbook/mental-models-glossary.md)
- 闭环学习路线：[`../docs/knowledge-handbook/closed-learning-loop.md`](../docs/knowledge-handbook/closed-learning-loop.md)
- 全局来源地图：[`../docs/knowledge-handbook/source-map.md`](../docs/knowledge-handbook/source-map.md)
- 反向索引：[`../docs/knowledge-handbook/backlink-index.md`](../docs/knowledge-handbook/backlink-index.md)
- 阅读协议：[`../docs/knowledge-handbook/reading-protocol.md`](../docs/knowledge-handbook/reading-protocol.md)

本阶段重点反链概念：

- [`AI Gateway`](../docs/knowledge-handbook/concepts/ai-gateway.md)：provider routing、fallback、quota、policy、telemetry。
- [`Agent Runtime`](../docs/knowledge-handbook/concepts/agent-runtime.md)：session、event、tool call、runner、graph。
- [`Concurrency And Backpressure`](../docs/knowledge-handbook/concepts/concurrency-backpressure.md)：bounded queue、worker pool、rate limit、slow consumer。
- [`Observability`](../docs/knowledge-handbook/concepts/observability.md)：metrics、tracing、structured logs、AI business dimensions。
- [`Durable Workflow`](../docs/knowledge-handbook/concepts/durable-workflow.md)：event history、worker、retry、idempotency、replay。

## 高级 GitHub 材料

这些仓库是终局参考，不建议一开始硬啃：

- [maximhq/bifrost](https://github.com/maximhq/bifrost)：AI gateway，重点看 provider routing、fallback、queue、plugin、observability。
- [trpc-group/trpc-agent-go](https://github.com/trpc-group/trpc-agent-go)：Go agent runtime，重点看 `Agent`、`Runner`、`Event`、`Graph`。
- [TykTechnologies/tyk](https://github.com/TykTechnologies/tyk)：API gateway，重点看 auth、rate limit、analytics、proxy pipeline。
- [cloudwego/hertz](https://github.com/cloudwego/hertz)：高性能 HTTP 框架，重点看 server、router、middleware、network stack。
- [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector)：可观测 pipeline，重点看 receiver、processor、exporter、service graph。
- [temporalio/temporal](https://github.com/temporalio/temporal)：可靠工作流系统，重点看 workflow durability、history、matching、worker model。
- [nats-io/nats-server](https://github.com/nats-io/nats-server)：高吞吐消息系统，重点看 client、routing、gateway、JetStream。

## Awesome Architecture -> Go

[study8677/awesome-architecture](https://github.com/study8677/awesome-architecture) 提供的是架构地图。本工作区把其中第一批模板落成 Go 学习材料：

- [`docs/architecture-to-go`](../docs/architecture-to-go/README.md)：架构模板到 Go 的转译说明。
- [`architecture_labs`](../architecture_labs/README.md)：6 个最小 Go 代码实验。

第一批对应：

- AI Gateway -> `architecture_labs/gateway`
- AI Agent / Workflow -> `architecture_labs/agent`
- RAG Knowledge Base -> `architecture_labs/rag`
- Inference Serving -> `architecture_labs/inference`
- Realtime Chat -> `architecture_labs/realtime`
- Notification System -> `architecture_labs/notification`

## 最终项目路线

最终项目不再只是 CRUD API，而是分阶段演进：

1. `api_service`：学习资源 API，练 handler/service/repository。
2. `architecture_labs`：把 awesome-architecture 的系统模板拆成 Go 核心机制。
3. `gateway_lab`：HTTP 网关，练路由、限流、超时、熔断、provider fallback。
4. `agent_runtime_lab`：agent 会话流，练 event、tool call、graph、session persistence。
5. `observability_lab`：接入 OpenTelemetry，输出 metrics/traces/logs。
6. `ha_lab`：加入队列、异步任务、优雅关闭、重试、幂等和压测。
7. `capstone_ai_gateway_agent_runtime`：当前已落地的综合骨架，验证 gateway fallback、agent replay、provider queue、telemetry、config hot swap 和 lifecycle drain。

## 学习方法

每个高级仓库只读三层：

1. README 和架构文档：知道系统承诺了什么。
2. 入口和核心接口：知道系统边界在哪里。
3. 一条关键链路：从请求进入到执行、分发、返回或记录。

不要从最大文件开始读。大系统要沿着链路切开。

每读一个高级仓库，都补齐至少一条 `Source -> Segment -> Concept -> Go Lab` 链路。例子：`Bifrost provider routing -> AI Gateway -> architecture_labs/gateway -> capstone_ai_gateway_agent_runtime/internal/gateway/router`。

最终必须落到 Capstone 的 E2E 验收：success、fallback、overload、agent tool、streaming、shutdown 都要有测试代码，而不是只停在架构图。
