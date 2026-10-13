# AI Gateway -> Go Design Template

Source architecture: [awesome-architecture/templates/ai-gateway](https://github.com/study8677/awesome-architecture/blob/609e0cd64d6af89549112379cbdd0f0e6cf63a3a/templates/ai-gateway/README.md)

## Architecture Problem

AI 网关把多个 LLM provider 收束到一个统一入口，集中处理鉴权、限流、路由、fallback、缓存、计费和可观测。

第一阶段 Go 实验只练一个核心：provider 路由和 fallback。原因是这是网关的骨架，后续限流、熔断、观测都会挂在这条链路上。

## Go Package Boundary

```text
gateway/
  provider.go      Provider model and health state
  router.go        Selection and fallback policy
  router_test.go   Behavior tests
```

未来完整项目可以扩展为：

```text
internal/gateway/httpapi
internal/gateway/auth
internal/gateway/ratelimit
internal/gateway/provider
internal/gateway/router
internal/gateway/telemetry
```

## Core Types

```go
type Provider struct {
    Name    string
    Healthy bool
    Weight  int
}

type Router struct {
    providers []Provider
}

func (r Router) Select(preferred string) (Provider, error)
```

## Minimum Lab

输入多个 provider：

- `openai` 健康。
- `anthropic` 不健康。
- `mock` 健康。

当 preferred 是 `anthropic` 时，router 应跳过它并选择下一个健康 provider。

## Production Expansion

- 按模型能力路由，例如 chat、embedding、vision。
- 按价格、延迟、错误率加权。
- 熔断和半开探测。
- SSE 流式透传。
- token usage 计量。
- OpenTelemetry span：`gateway.route`, `provider.call`, `fallback.attempt`。
