# Target System: AI Gateway + Agent Runtime Lab

这个工作区的最终目标是实现一个可演进的小型大业务系统。它不追求复刻某个生产产品，而是把 AI 网关、agent 对话流、高并发、高可用、可观测这些核心能力拆开练。

## Product Shape

系统名字暂定为 `ai_gateway_agent_lab`。

它对外暴露一套 OpenAI-compatible 风格的 HTTP API，并支持：

- 多 provider 路由：OpenAI、Anthropic、本地 mock provider。
- fallback：主 provider 失败后切备用 provider。
- 负载均衡：同类 provider 多 key 或多 endpoint 分摊请求。
- 限流和额度：按 API key、用户、模型维度控制流量。
- Agent runtime：支持 session、message、tool call、event stream。
- 可观测：每次请求记录 latency、tokens、provider、error、trace id。
- 管理 API：查看 provider 状态、请求统计、错误分布。

## Architecture

```text
client
  -> gateway/httpapi
  -> auth + rate limit + request shaping
  -> router/provider selector
  -> provider client pool
  -> response normalizer
  -> telemetry sink

agent request
  -> session manager
  -> runner
  -> graph or chain
  -> tool executor
  -> event stream
  -> memory/session store
```

## Go Packages To Build Eventually

```text
cmd/gateway
internal/gateway/httpapi
internal/gateway/auth
internal/gateway/ratelimit
internal/gateway/provider
internal/gateway/router
internal/gateway/telemetry
internal/agent/session
internal/agent/event
internal/agent/runner
internal/agent/tool
internal/agent/graph
internal/platform/store
internal/platform/queue
internal/platform/observability
```

## Learning Milestones

### Milestone 1: API foundation

Build the current `api_service`. Learn request parsing, response shaping, validation, error handling, tests, and package boundaries.

### Milestone 2: Gateway core

Add provider abstraction and a router:

- `ProviderClient` interface.
- `Route(request) Provider`.
- Timeout per provider call.
- Fallback chain.
- Structured error types.

### Milestone 3: Traffic control

Add high-traffic mechanics:

- Token bucket rate limit.
- Bounded work queue.
- Context cancellation.
- Graceful shutdown.
- Load test script.

### Milestone 4: Agent runtime

Add a minimal agent conversation system:

- Session state.
- Event stream.
- Tool call request/result.
- Human interrupt.
- Graph node routing.

### Milestone 5: Observability and HA

Add production signals and reliability:

- Prometheus metrics.
- OpenTelemetry traces.
- JSON logs.
- Retry and idempotency key.
- Persistent store for sessions and requests.

## Source Inspirations

- Bifrost: provider routing, queue lifecycle, plugin pipeline.
- tRPC-Agent-Go: event model, runner, graph workflows, tool integration.
- Tyk: API gateway policy, auth, analytics, rate limit.
- Hertz: high-performance HTTP server and middleware style.
- OpenTelemetry Collector: receiver/processor/exporter pipeline model.
- Temporal: durable execution and workflow recovery.
- NATS: message fan-out, async communication, backpressure.
