# Concept: AI Gateway

AI gateway 的核心是统一模型入口：鉴权、限流、provider 路由、fallback、成本计量、观测和策略更新都集中在这一层。

## Source Backlinks

- [awesome-architecture AI Gateway](../../architecture-to-go/templates/ai-gateway.md)：系统模板到 Go package 的第一版翻译。
- [Bifrost](../../github-materials/advanced-systems.md#maximhqbifrost)：AI gateway 参考源。
- [Tyk](../../github-materials/advanced-systems.md#tyktechnologiestyk)：传统 API gateway 的策略、鉴权和分析能力。
- [go-kit examples](../../github-materials/architecture-patterns.md#go-kitexamples)：endpoint middleware 适合承载限流、熔断、trace。
- [Caddy](../../github-materials/real-projects.md#caddyservercaddy)：provider/plugin 生命周期可以借鉴模块化 server。

## Local Go Backlinks

- [`architecture_labs/gateway`](../../../architecture_labs/gateway/router.go)：最小 provider fallback。
- [`docs/target-ai-gateway-agent-platform.md`](../../target-ai-gateway-agent-platform.md)：最终系统蓝图。

## Current Lab

当前最小代码只练一件事：

```go
func (r Router) Select(preferred string) (Provider, error)
```

它表达三条规则：

- preferred provider 健康时优先使用。
- preferred 不健康时选择下一个健康 provider。
- 没有健康 provider 时返回稳定错误。

## Code Patterns

Provider fallback loop:

```go
func (g Gateway) TryRoutes(ctx context.Context, routes []Route, req ChatRequest) (ChatResponse, error) {
	var lastErr error
	for i, route := range routes {
		resp, err := g.providers[route.Provider].Chat(ctx, req.WithRoute(route))
		if err == nil {
			g.telemetry.ProviderSuccess(ctx, route, i)
			return resp, nil
		}
		lastErr = err
		g.telemetry.ProviderFailure(ctx, route, i, err)
		if !CanFallback(err) {
			break
		}
	}
	return ChatResponse{}, lastErr
}
```

Provider queue:

```go
type ProviderQueue struct {
	jobs chan ProviderJob
}

func (q ProviderQueue) Submit(job ProviderJob) error {
	select {
	case q.jobs <- job:
		return nil
	default:
		return ErrProviderQueueFull
	}
}
```

More patterns: [`../go-code-patterns.md`](../go-code-patterns.md).

## Production Expansion

- `ProviderClient`：最小聊天接口，不急着合并 embedding/image/audio。
- `RoutePolicy`：模型能力、成本、延迟、错误率、租户策略。
- `Endpoint middleware`：rate limit、circuit breaker、retry、trace。
- `Telemetry sink`：latency、tokens、provider、fallback attempt、error class。

## Failure Modes

- fallback 没有 deadline，慢 provider 拖住请求池。
- 错误类型不稳定，无法区分鉴权失败、超时、限流和 provider 5xx。
- 路由策略硬编码在 handler，后续无法做动态配置。

## Source To Code Deep Dive

这个概念的完整闭环：

```text
Bifrost provider routing
  -> Tyk policy pipeline
  -> go-kit endpoint/transport split
  -> architecture_labs/gateway
  -> capstone_ai_gateway_agent_runtime/internal/gateway
```

关键本地代码：

- Route planning: [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/router/planner.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/router/planner.go)
- Fallback execution: [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go)
- Policy: [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/engine.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/engine.go)
- HTTP adapter: [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go)
- E2E proof: [`../../../capstone_ai_gateway_agent_runtime/internal/app/demo_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/app/demo_test.go)

Route planner 的学习版核心：

```go
func (p Planner) Plan(ctx context.Context, req core.ChatRequest, policy core.TenantPolicy) (core.RoutePlan, error) {
	var attempts []core.Route
	add := func(route core.Route) {
		if route.Provider == "" {
			return
		}
		if route.Model == "" {
			route.Model = req.Model
		}
		if len(policy.AllowedProviders) > 0 && !policy.AllowedProviders[route.Provider] {
			return
		}
		if p.health != nil && !p.health.Healthy(route.Provider) {
			return
		}
		attempts = append(attempts, route)
	}

	add(core.Route{Provider: req.Provider, Model: req.Model})
	if policy.AllowFallbacks {
		for _, fallback := range req.Fallbacks {
			add(fallback)
		}
	}
	if len(attempts) == 0 {
		return core.RoutePlan{}, core.GatewayError{Class: core.ErrorProviderUnavailable, Err: core.ErrNoProvider}
	}
	return core.RoutePlan{Attempts: attempts}, nil
}
```

Fallback executor 的关键不是“循环”，而是每一次尝试都进入 telemetry 和 audit：

```go
resp, err := client.Chat(ctx, req.WithRoute(route))
e.record(ctx, req, route, i, resp, err)
if err == nil {
	return resp, nil
}
if !core.CanFallback(err) {
	break
}
```

最重要的 E2E 验收：

```go
func TestDemoChatCompletionFallsBackAndRecordsProof(t *testing.T) {
	demo := BuildDemo()
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{
		"request_id":"req-1",
		"tenant_id":"demo",
		"model":"gpt-demo",
		"provider":"primary",
		"fallbacks":[{"provider":"backup","model":"gpt-demo"}],
		"messages":[{"role":"user","content":"hello"}]
	}`))

	rec := httptest.NewRecorder()
	demo.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if !demo.Telemetry.Contains("gateway.provider_attempt", map[string]string{
		"provider":       "primary",
		"error_class":    "timeout",
		"fallback_index": "0",
	}) {
		t.Fatalf("missing primary telemetry")
	}
}
```

继续扩展时优先读：

- [`../production-patterns-cookbook.md#admission-control`](../production-patterns-cookbook.md#admission-control)
- [`../production-patterns-cookbook.md#route-scoring`](../production-patterns-cookbook.md#route-scoring)
- [`../production-patterns-cookbook.md#retry-budget`](../production-patterns-cookbook.md#retry-budget)
- [`../key-code-index.md#5-fallback-executor-with-telemetry-and-audit`](../key-code-index.md#5-fallback-executor-with-telemetry-and-audit)
