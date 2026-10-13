# Key Code Index

这个文件把当前工作区里最值得反复读的 Go 代码集中起来。它的定位是“代码入口地图”：每个片段都能反查到 GitHub 材料、概念页、本地源码和测试。

使用方式：

```text
先读本页代码片段
  -> 跳到真实源码文件
  -> 跳到对应测试
  -> 回读 GitHub source anchor
  -> 再扩展 Capstone
```

Important backlinks:

- Source network: [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)
- Advanced source anchors: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)
- Capstone manual: [`capstone-implementation-manual.md`](capstone-implementation-manual.md)
- Capstone walkthrough: [`local-labs/capstone-lab.md`](local-labs/capstone-lab.md)
- Real module: [`../../capstone_ai_gateway_agent_runtime`](../../capstone_ai_gateway_agent_runtime/README.md)

## Source To Code Map

| Source | Learning target | Local code |
|---|---|---|
| Bifrost | provider registry, route, fallback, queue | [`gateway/router`](../../capstone_ai_gateway_agent_runtime/internal/gateway/router/planner.go), [`gateway/fallback`](../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go), [`gateway/provider`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go) |
| Tyk | gateway policy pipeline, quota, status mapping | [`gateway/policy`](../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/engine.go), [`gateway/httpapi`](../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go) |
| go-kit examples | service boundary, endpoint middleware and transport adapter | [`gateway/core/service.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go), [`gateway/core/endpoint.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint.go), [`gateway/httpapi/handler.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go) |
| trpc-agent-go | runner, tool command, event stream | [`agent/runner`](../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go), [`agent/event`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/event.go) |
| Temporal | replay, durable event history, step budget | [`agent/event/replay.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go), [`agent/graph/graph.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph.go) |
| NATS | slow consumer as first-class failure mode | [`agent/stream/bus.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go) |
| OpenTelemetry Collector | async exporter, non-blocking telemetry | [`platform/telemetry/exporter_async.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go) |
| Caddy/Hertz | lifecycle, HTTP boundary, graceful shutdown, hot config validation | [`internal/app/config.go`](../../capstone_ai_gateway_agent_runtime/internal/app/config.go), [`platform/lifecycle`](../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app.go), [`cmd/gateway/main.go`](../../capstone_ai_gateway_agent_runtime/cmd/gateway/main.go) |

## 1. Gateway Service Boundary

Source backlinks:

- go-kit endpoint/transport boundary: [`03_architecture_patterns/github-project-analysis.md`](../../03_architecture_patterns/github-project-analysis.md#go-kitexamples)
- Tyk gateway pipeline: [`05_large_systems/github-project-analysis.md`](../../05_large_systems/github-project-analysis.md#tyktechnologiestyk)
- Local source: [`internal/gateway/core/service.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go)
- Tests: [`internal/gateway/core/service_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service_test.go)

核心思想：业务主流程只编排接口，不直接知道 HTTP、provider client、telemetry sink 的细节。

```go
type Authorizer interface {
	Authorize(ctx context.Context, req ChatRequest) (TenantPolicy, error)
}

type Limiter interface {
	Admit(ctx context.Context, tenantID TenantID, tokens int) error
}

type Router interface {
	Plan(ctx context.Context, req ChatRequest, policy TenantPolicy) (RoutePlan, error)
}

type Executor interface {
	Execute(ctx context.Context, req ChatRequest, plan RoutePlan) (ChatResponse, error)
}

type Service struct {
	Policy   Authorizer
	Limiter  Limiter
	Router   Router
	Executor Executor
}

func (s Service) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	policy, err := s.Policy.Authorize(ctx, req)
	if err != nil {
		return ChatResponse{}, err
	}

	if err := s.Limiter.Admit(ctx, req.TenantID, req.EstimatedTokens()); err != nil {
		return ChatResponse{}, err
	}

	plan, err := s.Router.Plan(ctx, req, policy)
	if err != nil {
		return ChatResponse{}, err
	}

	return s.Executor.Execute(ctx, req, plan)
}
```

学习笔记：

- `Service.Chat` 是 AI Gateway 的业务入口。
- `Policy -> Limiter -> Router -> Executor` 是网关请求链路的稳定骨架。
- 以后接 Redis、数据库、真实 LLM provider、OpenTelemetry 时，不应该改这个方法的主流程。

### Gateway Endpoint Middleware Add-On

Source backlinks:

- go-kit endpoint set: [`03_architecture_patterns/github-project-analysis.md#go-kitexamples`](../../03_architecture_patterns/github-project-analysis.md#go-kitexamples)
- Deep dive: [`source-deep-dives.md#go-kitexamples---service--endpoint--transport`](source-deep-dives.md#go-kitexamples---service--endpoint--transport)
- Local source: [`internal/gateway/core/endpoint.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint.go)
- Tests: [`internal/gateway/core/endpoint_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint_test.go)

```go
type Endpoint func(ctx context.Context, req ChatRequest) (ChatResponse, error)

type EndpointMiddleware func(Endpoint) Endpoint

func MakeEndpoint(service Service) Endpoint {
	return service.Chat
}

func ChainEndpoint(endpoint Endpoint, middleware ...EndpointMiddleware) Endpoint {
	for i := len(middleware) - 1; i >= 0; i-- {
		endpoint = middleware[i](endpoint)
	}
	return endpoint
}
```

```go
deny := func(next Endpoint) Endpoint {
	return func(ctx context.Context, req ChatRequest) (ChatResponse, error) {
		return ChatResponse{}, GatewayError{
			Class: ErrorUnauthorized,
			Err:   errors.New("missing api key"),
		}
	}
}
```

学习笔记：

- `Service` 保持业务编排，`Endpoint` 是 trace、rate limit、breaker、auth middleware 的组合点。
- middleware 可以在 provider 调用前短路，适合鉴权、配额、请求大小限制。
- go-kit 的重点不是必须引入框架，而是把 service/endpoint/transport 三层边界学会。

## 2. Tenant Policy And Token Budget

Source backlinks:

- Tyk auth/quota/middleware: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#3-tyk-rate-limit-and-quota-are-gateway-middleware)
- Local policy: [`internal/gateway/policy/engine.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/engine.go)
- Local limiter: [`internal/gateway/policy/limiter.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/limiter.go)

```go
func (e Engine) Authorize(ctx context.Context, req core.ChatRequest) (core.TenantPolicy, error) {
	select {
	case <-ctx.Done():
		return core.TenantPolicy{}, ctx.Err()
	default:
	}

	policy, ok := e.store.policies[req.TenantID]
	if !ok {
		return core.TenantPolicy{}, core.GatewayError{Class: core.ErrorUnauthorized, Err: core.ErrTenantNotAllowed}
	}
	if len(policy.AllowedModels) > 0 && !policy.AllowedModels[req.Model] {
		return core.TenantPolicy{}, core.GatewayError{Class: core.ErrorInvalidInput, Err: core.ErrModelNotAllowed}
	}
	if req.Provider != "" && len(policy.AllowedProviders) > 0 && !policy.AllowedProviders[req.Provider] {
		return core.TenantPolicy{}, core.GatewayError{Class: core.ErrorUnauthorized, Err: core.ErrProviderNotAllowed}
	}
	return policy, nil
}
```

```go
func (l TokenLimiter) Admit(ctx context.Context, tenantID core.TenantID, tokens int) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	if l.maxTokens > 0 && tokens > l.maxTokens {
		return core.GatewayError{Class: core.ErrorQuotaExceeded, Err: core.ErrTokenBudgetExceeded}
	}
	return nil
}
```

学习笔记：

- 大业务系统里，tenant policy 是产品规则和基础设施规则的交界点。
- token budget 不能只写在 prompt 层，它要进入 gateway 层，才能做统一计费、限流和拒绝。
- 真实生产版可以把 `MemoryStore` 换成 Redis/Postgres，但 `Authorize` 的返回语义保持不变。

## 3. Route Planner

Source backlinks:

- Bifrost provider routing: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#1-bifrost-provider-queue-fallback-and-plugin-pipeline)
- awesome-architecture AI Gateway: [`../architecture-to-go/templates/ai-gateway.md`](../architecture-to-go/templates/ai-gateway.md)
- Local source: [`internal/gateway/router/planner.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/router/planner.go)

```go
func (p Planner) Plan(ctx context.Context, req core.ChatRequest, policy core.TenantPolicy) (core.RoutePlan, error) {
	select {
	case <-ctx.Done():
		return core.RoutePlan{}, ctx.Err()
	default:
	}

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
		for _, existing := range attempts {
			if existing.Provider == route.Provider && existing.Model == route.Model {
				return
			}
		}
		attempts = append(attempts, route)
	}

	add(core.Route{Provider: req.Provider, Model: req.Model})
	if policy.AllowFallbacks {
		for _, fallback := range req.Fallbacks {
			add(fallback)
		}
		if len(req.Fallbacks) == 0 {
			for _, provider := range sortedProviders(policy.AllowedProviders) {
				add(core.Route{Provider: provider, Model: req.Model})
			}
		}
	}

	if len(attempts) == 0 {
		return core.RoutePlan{}, core.GatewayError{Class: core.ErrorProviderUnavailable, Err: core.ErrNoProvider}
	}
	return core.RoutePlan{Attempts: attempts}, nil
}
```

学习笔记：

- `RoutePlan` 是 fallback 的前置产物，先规划，再执行。
- `health` 是高可用入口：不健康 provider 不应该进入尝试列表。
- 去重规则保证一次请求不会重复打同一个 provider/model 组合。

## 4. Provider Queue And Circuit Breaker

Source backlinks:

- Bifrost queue/fallback: [`05_large_systems/github-project-analysis.md`](../../05_large_systems/github-project-analysis.md#maximhqbifrost)
- NATS slow consumer/backpressure: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#7-nats-server-slow-consumer-is-a-first-class-failure-mode)
- Local queue: [`internal/gateway/provider/queue.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go)
- Local breaker: [`internal/gateway/provider/breaker.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/breaker.go)
- Tests: [`internal/gateway/provider/queue_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue_test.go), [`internal/gateway/provider/breaker_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/breaker_test.go)

```go
func (q *Queue) TrySubmit(ctx context.Context, job Job) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	select {
	case q.jobs <- job:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return core.GatewayError{Class: core.ErrorOverloaded, Err: core.ErrProviderQueueFull}
	}
}
```

```go
func (b *Breaker) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	b.mu.Lock()
	if b.open {
		b.mu.Unlock()
		return core.ChatResponse{}, core.GatewayError{
			Class: core.ErrorProviderUnavailable,
			Route: core.Route{Provider: req.Provider, Model: req.Model},
			Err:   core.ErrNoProvider,
		}
	}
	b.mu.Unlock()

	resp, err := b.next.Chat(ctx, req)
	b.mu.Lock()
	defer b.mu.Unlock()
	if err != nil && core.CanFallback(err) {
		b.failures++
		if b.failures >= b.limit {
			b.open = true
		}
		return core.ChatResponse{}, err
	}
	if err == nil {
		b.failures = 0
	}
	return resp, err
}
```

测试证明：

```go
func TestQueueRejectsWhenFull(t *testing.T) {
	queue := NewQueue(1)
	if err := queue.TrySubmit(context.Background(), Job{ID: "job-1"}); err != nil {
		t.Fatalf("submit first: %v", err)
	}

	err := queue.TrySubmit(context.Background(), Job{ID: "job-2"})
	if core.ErrorClassOf(err) != core.ErrorOverloaded {
		t.Fatalf("error class: want overloaded got %s err=%v", core.ErrorClassOf(err), err)
	}
}
```

学习笔记：

- 高流量系统不能把所有请求都堆进 goroutine。
- queue full 是业务可观测的错误，不是日志里一闪而过的内部异常。
- breaker 只对可 fallback 的错误累计失败，避免把用户输入错误误判成 provider 故障。

## 5. Fallback Executor With Telemetry And Audit

Source backlinks:

- Bifrost fallback: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#1-bifrost-provider-queue-fallback-and-plugin-pipeline)
- OpenTelemetry Collector pipeline thinking: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#5-opentelemetry-collector-graph-component-lifecycle-and-export-queue)
- Local source: [`internal/gateway/fallback/executor.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go)
- Tests: [`internal/gateway/fallback/executor_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor_test.go)

```go
func (e Executor) Execute(ctx context.Context, req core.ChatRequest, plan core.RoutePlan) (core.ChatResponse, error) {
	var lastErr error
	for i, route := range plan.Attempts {
		if e.maxAttempts > 0 && i >= e.maxAttempts {
			if lastErr == nil {
				lastErr = core.GatewayError{Class: core.ErrorRetryBudget, Err: core.ErrRetryBudgetExceeded}
			}
			break
		}

		client, ok := e.registry.Client(route.Provider)
		if !ok {
			lastErr = core.GatewayError{Class: core.ErrorProviderUnavailable, Route: route, Err: core.ErrNoProvider}
			e.record(ctx, req, route, i, core.ChatResponse{}, lastErr)
			if !core.CanFallback(lastErr) {
				break
			}
			continue
		}

		resp, err := client.Chat(ctx, req.WithRoute(route))
		e.record(ctx, req, route, i, resp, err)
		if err == nil {
			return resp, nil
		}

		lastErr = err
		if !core.CanFallback(err) {
			break
		}
	}
	if lastErr == nil {
		lastErr = core.GatewayError{Class: core.ErrorProviderUnavailable, Err: core.ErrNoProvider}
	}
	return core.ChatResponse{}, lastErr
}
```

```go
func (e Executor) record(ctx context.Context, req core.ChatRequest, route core.Route, index int, resp core.ChatResponse, err error) {
	errorClass := core.ErrorClassOf(err)
	if e.telemetry != nil {
		_ = e.telemetry.Record(ctx, telemetry.Event{
			Name:          "gateway.provider_attempt",
			RequestID:     string(req.RequestID),
			TenantID:      string(req.TenantID),
			Model:         string(route.Model),
			Provider:      string(route.Provider),
			ErrorClass:    string(errorClass),
			FallbackIndex: index,
		})
	}
	if e.audit != nil {
		inputTokens := resp.InputTokens
		if inputTokens == 0 {
			inputTokens = req.EstimatedTokens()
		}
		_ = e.audit.Record(ctx, audit.RequestLog{
			RequestID:     req.RequestID,
			TenantID:      req.TenantID,
			Model:         route.Model,
			Provider:      route.Provider,
			FallbackIndex: index,
			InputTokens:   inputTokens,
			OutputTokens:  resp.OutputTokens,
			ErrorClass:    errorClass,
			CostMicros:    audit.EstimateCostMicros(inputTokens, resp.OutputTokens),
		})
	}
}
```

学习笔记：

- fallback 不是 for-loop 重试，而是有预算、有错误分类、有审计记录的执行策略。
- 每次 provider attempt 都记录 telemetry/audit，后面才能回答“为什么慢、为什么贵、为什么 fallback”。
- retry budget 是保护下游 provider 和自身线程池的关键。

## 6. HTTP Adapter

Source backlinks:

- Hertz HTTP boundary: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#4-hertz-engine-lifecycle-and-transport-boundary)
- go-kit transport split: [`03_architecture_patterns/github-project-analysis.md`](../../03_architecture_patterns/github-project-analysis.md#go-kitexamples)
- Local source: [`internal/gateway/httpapi/handler.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go)
- Tests: [`internal/gateway/httpapi/handler_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler_test.go)

```go
func RegisterRoutes(mux *http.ServeMux, handler Handler) {
	mux.HandleFunc("POST /v1/chat/completions", handler.Chat)
	mux.HandleFunc("GET /healthz", handler.Health)
}

func (h Handler) Chat(w http.ResponseWriter, r *http.Request) {
	var req core.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	resp, err := h.service.Chat(r.Context(), req)
	if err != nil {
		writeError(w, statusFor(err), err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}
```

```go
func statusFor(err error) int {
	switch core.ErrorClassOf(err) {
	case core.ErrorUnauthorized:
		return http.StatusUnauthorized
	case core.ErrorInvalidInput:
		return http.StatusBadRequest
	case core.ErrorRateLimited, core.ErrorQuotaExceeded:
		return http.StatusTooManyRequests
	case core.ErrorOverloaded, core.ErrorProviderUnavailable, core.ErrorTimeout:
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}
```

学习笔记：

- HTTP 层只做 decode、调用 service、encode/error mapping。
- 大系统要让错误分类从 core 层贯穿到 HTTP 状态码、telemetry label 和 audit log。

## 7. Demo Composition Root

Source backlinks:

- project-layout `cmd` as entrypoint: [`02_project_structure/github-project-analysis.md`](../../02_project_structure/github-project-analysis.md#golang-standardsproject-layout)
- Caddy lifecycle: [`04_real_projects/github-project-analysis.md`](../../04_real_projects/github-project-analysis.md#caddyservercaddy)
- Local composition: [`internal/app/demo.go`](../../capstone_ai_gateway_agent_runtime/internal/app/demo.go)
- Runnable main: [`cmd/gateway/main.go`](../../capstone_ai_gateway_agent_runtime/cmd/gateway/main.go)
- E2E tests: [`internal/app/demo_test.go`](../../capstone_ai_gateway_agent_runtime/internal/app/demo_test.go)

```go
func BuildDemo() Demo {
	registry := provider.NewRegistry()
	registry.Replace("primary", provider.NewRuntime("primary", provider.NewBreaker(provider.FakeTimeout{}, 2)))
	registry.Replace("backup", provider.NewRuntime("backup", provider.FakeSuccess{
		Name:    "backup",
		Content: "ok from backup",
	}))

	telemetrySink := telemetry.NewMemoryExporter()
	auditLog := audit.NewMemoryLog()

	service := core.Service{
		Policy: policy.NewEngine(policy.NewMemoryStore([]core.TenantPolicy{
			{
				TenantID: "demo",
				AllowedModels: map[core.ModelName]bool{
					"gpt-demo": true,
				},
				AllowedProviders: map[core.ProviderName]bool{
					"primary": true,
					"backup":  true,
				},
				AllowFallbacks: true,
			},
		})),
		Limiter: policy.NewTokenLimiter(1000),
		Router:  router.NewPlanner(registry),
		Executor: fallback.NewExecutor(registry, telemetrySink).
			WithAudit(auditLog).
			WithRetryBudget(3),
	}

	mux := http.NewServeMux()
	httpapi.RegisterRoutes(mux, httpapi.NewHandler(service))

	return Demo{
		Handler:   mux,
		Service:   service,
		Telemetry: telemetrySink,
		Audit:     auditLog,
	}
}
```

学习笔记：

- `BuildDemo` 是最小 composition root：所有接口都在这里被接上具体实现。
- primary 故意超时，backup 成功，用来证明 fallback、telemetry、audit 全链路。
- 生产版可以把 Fake provider 换成 OpenAI/Claude/Gemini client，把 memory sink 换成 OTel exporter。

## 8. E2E Gateway Proof

Source backlinks:

- Learn Go with Tests: [`01_language_basics/github-project-analysis.md`](../../01_language_basics/github-project-analysis.md#quiilearn-go-with-tests)
- Local E2E: [`internal/app/demo_test.go`](../../capstone_ai_gateway_agent_runtime/internal/app/demo_test.go)

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
	var body struct {
		Provider string `json:"provider"`
		Content  string `json:"content"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Provider != "backup" || body.Content != "ok from backup" {
		t.Fatalf("body: %+v", body)
	}

	if !demo.Telemetry.Contains("gateway.provider_attempt", map[string]string{
		"provider":       "primary",
		"error_class":    "timeout",
		"fallback_index": "0",
	}) {
		t.Fatalf("missing primary telemetry: %+v", demo.Telemetry.Events())
	}
	if !demo.Telemetry.Contains("gateway.provider_attempt", map[string]string{
		"provider":       "backup",
		"error_class":    "",
		"fallback_index": "1",
	}) {
		t.Fatalf("missing backup telemetry: %+v", demo.Telemetry.Events())
	}

	logs := demo.Audit.Logs()
	if len(logs) != 2 {
		t.Fatalf("audit logs: %+v", logs)
	}
	if logs[0].Provider != "primary" || logs[0].ErrorClass == "" {
		t.Fatalf("primary audit log: %+v", logs[0])
	}
	if logs[1].Provider != "backup" || logs[1].CostMicros == 0 {
		t.Fatalf("backup audit log: %+v", logs[1])
	}
}
```

学习笔记：

- 这个测试是 Capstone 的“纵切证明”：HTTP -> Service -> Policy -> Router -> Fallback -> Provider -> Telemetry -> Audit。
- 大系统学习最怕只写组件测试；最终必须用 E2E 证明组件接起来后的行为。

## 9. Agent Runner And Tool Event Flow

Source backlinks:

- trpc-agent-go runner/event/tool: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#2-trpc-agent-go-event-as-agent-runtime-fact)
- Temporal event history: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#6-temporal-mutable-state-command-validation-and-matching)
- Local runner: [`internal/agent/runner/runner.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go)
- Tests: [`internal/agent/runner/runner_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner_test.go)

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

```go
func (r Runner) applyCommand(ctx context.Context, sessionID string, cmd Command) error {
	switch cmd.Type {
	case CommandCallTool:
		if cmd.Tool == nil || cmd.Tool.ID == "" || cmd.Tool.Name == "" {
			return ErrInvalidCommand
		}
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
		return r.events.Append(ctx, sessionID, event.Event{
			Type:       event.ToolFinished,
			ToolCallID: cmd.Tool.ID,
			ToolName:   cmd.Tool.Name,
			Content:    result.Content,
		})
	case CommandAnswer:
		return r.events.Append(ctx, sessionID, event.Event{Type: event.AssistantMessage, Content: cmd.Text})
	default:
		return ErrInvalidCommand
	}
}
```

测试证明：

```go
func TestRunnerRecordsToolFlowAndReplayCompletes(t *testing.T) {
	store := event.NewMemoryStore()
	runner := New(
		store,
		NewScriptedModel([]Step{
			{Command: CallTool("tool-1", "search", `{"q":"docs"}`)},
			{Command: Answer("found it")},
		}),
		tool.Registry{"search": tool.FakeResult(`{"title":"doc"}`)},
	)

	if err := runner.Run(context.Background(), "session-1", "search docs"); err != nil {
		t.Fatalf("run: %v", err)
	}

	events, err := store.List(context.Background(), "session-1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	assertEventTypes(t, events, []event.EventType{
		event.UserMessage,
		event.ToolStarted,
		event.ToolFinished,
		event.AssistantMessage,
		event.RunCompleted,
	})

	state := event.Replay(events)
	if state.Status != event.StatusCompleted {
		t.Fatalf("status: %s", state.Status)
	}
}
```

学习笔记：

- Agent 不是一次函数调用；它是事件流驱动的循环。
- tool started、tool finished、tool failed 都是可恢复事实。
- step budget 是防止 agent 死循环的第一道保险。

## 10. Event Replay

Source backlinks:

- Temporal history/replay: [`05_large_systems/github-project-analysis.md`](../../05_large_systems/github-project-analysis.md#temporaliotemporal)
- Local source: [`internal/agent/event/replay.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go)

```go
func Replay(events []Event) State {
	state := State{
		Status:       StatusRunning,
		RunningTools: map[string]ToolCall{},
	}

	for _, event := range events {
		switch event.Type {
		case UserMessage:
			state.Messages = append(state.Messages, Message{Role: "user", Content: event.Content})
		case AssistantMessage:
			state.Messages = append(state.Messages, Message{Role: "assistant", Content: event.Content})
		case ToolStarted:
			state.RunningTools[event.ToolCallID] = ToolCall{ID: event.ToolCallID, Name: event.ToolName}
		case ToolFinished:
			delete(state.RunningTools, event.ToolCallID)
		case ToolFailed:
			delete(state.RunningTools, event.ToolCallID)
			state.Status = StatusFailed
		case RunInterrupted:
			state.Status = StatusInterrupted
		case RunCompleted:
			state.Status = StatusCompleted
		}
	}
	return state
}
```

学习笔记：

- Replay 是 agent runtime 的恢复核心。
- 状态是事件折叠出来的，而不是散落在多个 mutable field 里。
- 后续接数据库时，应优先持久化 event history，再用 replay 恢复 session state。

## 11. Graph Agent

Source backlinks:

- trpc-agent-go graph agent: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#2-trpc-agent-go-event-as-agent-runtime-fact)
- Local source: [`internal/agent/graph/graph.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph.go)
- Tests: [`internal/agent/graph/graph_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph_test.go)

```go
func (g Graph) Execute(ctx context.Context, sessionID string, startNodeID string) error {
	maxSteps := g.MaxSteps
	if maxSteps < 1 {
		maxSteps = 1
	}

	current := startNodeID
	for step := 0; step < maxSteps; step++ {
		node, ok := g.nodes[current]
		if !ok {
			return fmt.Errorf("%s: %w", current, ErrNodeNotFound)
		}

		events, err := g.events.List(ctx, sessionID)
		if err != nil {
			return err
		}
		result, err := node.Run(ctx, event.Replay(events))
		if err != nil {
			return err
		}

		if result.Interrupt {
			if err := g.events.Append(ctx, sessionID, event.Event{
				Type:    event.RunInterrupted,
				NodeID:  current,
				Content: result.Reason,
			}); err != nil {
				return err
			}
			return ErrInterrupted
		}
		if result.Complete {
			return g.events.Append(ctx, sessionID, event.Event{
				Type:   event.RunCompleted,
				NodeID: current,
			})
		}
		if result.NextNodeID == "" {
			return fmt.Errorf("%s empty next node: %w", current, ErrNodeNotFound)
		}
		if err := g.events.Append(ctx, sessionID, event.Event{
			Type:       event.NodeTransitioned,
			NodeID:     current,
			NextNodeID: result.NextNodeID,
		}); err != nil {
			return err
		}
		current = result.NextNodeID
	}
	return ErrStepBudgetExceeded
}
```

学习笔记：

- 复杂 agent 对话流不要靠一长串 if/else 维持。
- `NodeTransitioned` 是可观测和可恢复的节点切换事实。
- `Interrupt` 是人工介入、权限确认、长任务等待的入口。

## 12. Streaming Bus And Slow Consumer Policy

Source backlinks:

- NATS slow consumer: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#7-nats-server-slow-consumer-is-a-first-class-failure-mode)
- Memos realtime/SSE thinking: [`04_real_projects/github-project-analysis.md`](../../04_real_projects/github-project-analysis.md#usememosmemos)
- Local source: [`internal/agent/stream/bus.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go)
- Tests: [`internal/agent/stream/bus_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus_test.go)

```go
func (b *Bus) Subscribe(sessionID string, capacity int) <-chan event.Event {
	if capacity < 1 {
		capacity = 1
	}
	ch := make(chan event.Event, capacity)

	b.mu.Lock()
	defer b.mu.Unlock()
	b.subs[sessionID] = append(b.subs[sessionID], ch)
	return ch
}

func (b *Bus) Publish(sessionID string, evt event.Event) {
	b.mu.RLock()
	subs := append([]chan event.Event(nil), b.subs[sessionID]...)
	b.mu.RUnlock()

	for _, sub := range subs {
		select {
		case sub <- evt:
		default:
			b.mu.Lock()
			b.dropped++
			b.mu.Unlock()
		}
	}
}
```

测试证明：

```go
func TestBusDoesNotBlockOnSlowSubscriber(t *testing.T) {
	bus := NewBus()
	sub := bus.Subscribe("session-1", 1)

	bus.Publish("session-1", event.Event{ID: "event-1", Type: event.UserMessage})
	bus.Publish("session-1", event.Event{ID: "event-2", Type: event.AssistantMessage})

	select {
	case got := <-sub:
		if got.ID != "event-1" {
			t.Fatalf("first event: %+v", got)
		}
	case <-time.After(time.Second):
		t.Fatal("publish blocked behind slow subscriber")
	}

	if bus.Dropped() != 1 {
		t.Fatalf("dropped: want 1 got %d", bus.Dropped())
	}
}
```

学习笔记：

- 实时流不能让慢消费者拖死生产者。
- 当前策略是 drop live event，并用 durable event store 作为最终真相。
- 生产版可以把 `dropped` 暴露成 metrics，并给客户端提供 replay API。

## 13. Async Telemetry Exporter

Source backlinks:

- OpenTelemetry Collector exporter queue: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#5-opentelemetry-collector-graph-component-lifecycle-and-export-queue)
- Local source: [`internal/platform/telemetry/exporter_async.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go)
- Tests: [`internal/platform/telemetry/exporter_async_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async_test.go)

```go
func (e *AsyncExporter) Record(ctx context.Context, event Event) error {
	select {
	case e.queue <- event:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		e.mu.Lock()
		e.dropped++
		e.mu.Unlock()
		return nil
	}
}

func (e *AsyncExporter) run() {
	for {
		select {
		case event := <-e.queue:
			_ = e.next.Record(context.Background(), event)
		case <-e.done:
			return
		}
	}
}
```

学习笔记：

- 可观测不能反向拖慢主请求路径。
- 队列满时这里选择 drop telemetry，而不是阻塞业务请求。
- 生产版要补 flush timeout、batch、retry、export error metrics。

## 14. Lifecycle And Graceful Shutdown

Source backlinks:

- Caddy module lifecycle: [`04_real_projects/github-project-analysis.md`](../../04_real_projects/github-project-analysis.md#caddyservercaddy)
- Hertz engine shutdown: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#4-hertz-engine-lifecycle-and-transport-boundary)
- Local lifecycle: [`internal/platform/lifecycle/app.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app.go)
- HTTP component: [`internal/platform/lifecycle/http.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/http.go)
- Tests: [`internal/platform/lifecycle/app_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go)

```go
type Component interface {
	Name() string
	Start(ctx context.Context) error
	Shutdown(ctx context.Context) error
}

func (a App) Run(ctx context.Context) error {
	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	errs := make(chan error, len(a.Components))
	for _, component := range a.Components {
		c := component
		go func() {
			if err := c.Start(runCtx); err != nil && !errors.Is(err, context.Canceled) {
				errs <- fmt.Errorf("%s start: %w", c.Name(), err)
			}
		}()
	}

	select {
	case <-ctx.Done():
	case err := <-errs:
		cancel()
		return err
	}

	timeout := a.ShutdownTimeout
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), timeout)
	defer shutdownCancel()

	var shutdownErrs []error
	for i := len(a.Components) - 1; i >= 0; i-- {
		if err := a.Components[i].Shutdown(shutdownCtx); err != nil {
			shutdownErrs = append(shutdownErrs, fmt.Errorf("%s shutdown: %w", a.Components[i].Name(), err))
		}
	}
	return errors.Join(shutdownErrs...)
}
```

```go
type HTTPServer struct {
	name   string
	server *http.Server
}

func (s HTTPServer) Start(ctx context.Context) error {
	err := s.server.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s HTTPServer) Shutdown(ctx context.Context) error {
	return s.server.Shutdown(ctx)
}
```

学习笔记：

- 生命周期应该是平台层能力，不要散落在每个 handler 或 service 里。
- shutdown 顺序反向执行，通常能让入口先停，再停底层依赖。
- 对 AI gateway 来说，优雅关闭要配合 provider queue drain、agent event flush 和 telemetry flush。
- 本地 proof `TestGracefulDrainStopsIngressBeforeWorkers` 把“入口先停、worker 后停”写成行为测试。

## 15. Newly Implemented Production Proofs

这些代码块来自最近补齐的测试缺口：route scoring、event upcaster、stream replay cursor、RAG permission filter。它们把 [`source-to-test-proof.md`](source-to-test-proof.md) 里的 backlog 从“计划”推进到真实 Go proof。

### Route Scoring

Source backlinks:

- Bifrost provider routing: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#1-bifrost-provider-queue-fallback-and-plugin-pipeline)
- Tyk policy: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#3-tyk-rate-limit-and-quota-are-gateway-middleware)
- Local source: [`internal/gateway/router/scoring.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/router/scoring.go)
- Tests: [`internal/gateway/router/scoring_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/router/scoring_test.go)

```go
func ScoreCandidate(req core.ChatRequest, candidate Candidate) Score {
	if !candidate.Healthy {
		return Score{Value: -1, Why: []string{"unhealthy"}}
	}
	if len(candidate.Supports) > 0 && !candidate.Supports[req.Model] {
		return Score{Value: -1, Why: []string{"model_not_supported"}}
	}

	score := int64(1000)
	score -= candidate.CostMicros / 100
	score -= candidate.LatencyMS
	score -= candidate.ErrorRatePPM / 1000
	return Score{Value: score, Why: []string{"base", "cost", "latency", "error_rate"}}
}
```

Learning:

- Router 可以先保持 deterministic plan，再演进出 scoring。
- `Why` 字段让路由选择具备可解释性，后续可写入 telemetry/audit。
- 不支持模型或不健康 provider 应该在评分阶段被排除。

### Event Version Upcaster

Source backlinks:

- Temporal history compatibility: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md#6-temporal-mutable-state-command-validation-and-matching)
- Syncthing protocol boundary: [`source-code-anchors-foundations.md#04-real-projects`](source-code-anchors-foundations.md#04-real-projects)
- Local source: [`internal/agent/event/versioned.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/versioned.go)
- Tests: [`internal/agent/event/versioned_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/versioned_test.go)

```go
func ReplayStored(events []StoredEvent, upcasters ...Upcaster) (State, error) {
	decoded := make([]Event, 0, len(events))
	for _, stored := range events {
		var err error
		for _, upcast := range upcasters {
			stored, err = upcast(stored)
			if err != nil {
				return State{}, err
			}
		}
		event, err := DecodeStored(stored)
		if err != nil {
			return State{}, err
		}
		decoded = append(decoded, event)
	}
	return Replay(decoded), nil
}
```

Learning:

- Durable event history 一旦落库，就要考虑旧 payload 如何 replay。
- Upcaster 是演进协议的学习版入口。
- 测试必须保留旧格式样例，而不是只测当前 struct。

### Stream Replay Cursor

Source backlinks:

- NATS slow consumer: [`source-code-anchors-advanced.md#7-nats-server-slow-consumer-is-a-first-class-failure-mode`](source-code-anchors-advanced.md#7-nats-server-slow-consumer-is-a-first-class-failure-mode)
- Memos realtime broadcast: [`source-code-anchors-foundations.md#04-real-projects`](source-code-anchors-foundations.md#04-real-projects)
- Local source: [`internal/agent/stream/replay.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/replay.go)
- Tests: [`internal/agent/stream/replay_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/replay_test.go)

```go
func ReplayFrom(ctx context.Context, reader EventReader, cursor Cursor, send func(event.Event) error) error {
	events, err := reader.List(ctx, cursor.SessionID)
	if err != nil {
		return err
	}
	if cursor.Offset < 0 {
		cursor.Offset = 0
	}
	if cursor.Offset > len(events) {
		return nil
	}
	for _, evt := range events[cursor.Offset:] {
		if err := send(evt); err != nil {
			return err
		}
	}
	return nil
}
```

Learning:

- live stream 可以丢，durable event store 负责补。
- cursor 是 session 内 offset，不要为了局部有序追求全局有序。
- slow consumer policy 必须和 replay 能力成对出现。

### RAG Permission Filter

Source backlinks:

- RAG template: [`../architecture-to-go/templates/rag-knowledge-base.md`](../architecture-to-go/templates/rag-knowledge-base.md)
- Product authorization lessons: [`source-code-anchors-foundations.md#04-real-projects`](source-code-anchors-foundations.md#04-real-projects)
- Local source: [`internal/agent/tool/rag.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/tool/rag.go)
- Tests: [`internal/agent/tool/rag_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/tool/rag_test.go)

```go
func CanRead(principal Principal, doc Document) bool {
	if doc.TenantID != "" && principal.TenantID != doc.TenantID {
		return false
	}
	if len(doc.ACL) == 0 {
		return true
	}
	if doc.ACL[principal.UserID] {
		return true
	}
	for _, role := range principal.Roles {
		if doc.ACL["role:"+role] {
			return true
		}
	}
	return false
}
```

Learning:

- RAG 权限过滤是检索层能力，不应只依赖 HTTP middleware。
- citation 不能泄漏用户无权读取的文档 ID。
- 多租户 RAG 测试必须包含 cross-tenant fixture。

### Bounded Provider Client

Source backlinks:

- Go by Example worker pools: [`../github-materials/language-basics.md`](../github-materials/language-basics.md)
- NATS slow consumer and pressure: [`source-code-anchors-advanced.md#7-nats-server-slow-consumer-is-a-first-class-failure-mode`](source-code-anchors-advanced.md#7-nats-server-slow-consumer-is-a-first-class-failure-mode)
- Local source: [`internal/gateway/provider/bounded.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/bounded.go)
- Tests: [`internal/gateway/provider/bounded_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/bounded_test.go)

```go
func (c *BoundedClient) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	select {
	case c.semaphore <- struct{}{}:
		defer func() { <-c.semaphore }()
	case <-ctx.Done():
		return core.ChatResponse{}, ctx.Err()
	default:
		return core.ChatResponse{}, core.GatewayError{
			Class: core.ErrorOverloaded,
			Route: core.Route{Provider: req.Provider, Model: req.Model},
			Err:   core.ErrProviderQueueFull,
		}
	}

	return c.next.Chat(ctx, req)
}
```

Learning:

- in-flight limit 和 queue capacity 是两个不同保护层。
- provider 下游容量满时应该返回 typed overload，让 fallback 或 admission control 可以决策。

### Timed Breaker With Half-Open Probe

Source backlinks:

- Bifrost provider availability: [`source-code-anchors-advanced.md#1-bifrost-provider-queue-fallback-and-plugin-pipeline`](source-code-anchors-advanced.md#1-bifrost-provider-queue-fallback-and-plugin-pipeline)
- go-kit endpoint middleware: [`03_architecture_patterns/github-project-analysis.md#go-kitexamples`](../../03_architecture_patterns/github-project-analysis.md#go-kitexamples)
- Local source: [`internal/gateway/provider/timed_breaker.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/timed_breaker.go)
- Tests: [`internal/gateway/provider/timed_breaker_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/timed_breaker_test.go)

```go
func (b *TimedBreaker) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	b.mu.Lock()
	if b.state == BreakerOpen && b.now().Before(b.openedUntil) {
		b.mu.Unlock()
		return core.ChatResponse{}, core.GatewayError{
			Class: core.ErrorProviderUnavailable,
			Route: core.Route{Provider: req.Provider, Model: req.Model},
			Err:   core.ErrNoProvider,
		}
	}
	if b.state == BreakerOpen {
		b.state = BreakerHalfOpen
	}
	b.mu.Unlock()

	resp, err := b.next.Chat(ctx, req)
	b.afterCall(err)
	return resp, err
}
```

Learning:

- half-open 是恢复探测，不是立即恢复全量流量。
- breaker state 后续应进入 metrics 和 route scoring。

### Event Outbox Retry And DLQ

Source backlinks:

- Temporal durable work: [`source-code-anchors-advanced.md#6-temporal-mutable-state-command-validation-and-matching`](source-code-anchors-advanced.md#6-temporal-mutable-state-command-validation-and-matching)
- Memos side effects: [`source-code-anchors-foundations.md#04-real-projects`](source-code-anchors-foundations.md#04-real-projects)
- Local source: [`internal/platform/outbox`](../../capstone_ai_gateway_agent_runtime/internal/platform/outbox/outbox.go)
- Tests: [`internal/platform/outbox/worker_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/outbox/worker_test.go)

```go
func (w Worker) RunOnce(ctx context.Context) error {
	now := w.now()
	events, err := w.Store.ClaimDue(ctx, now, w.Limit)
	if err != nil {
		return err
	}
	for _, event := range events {
		if err := w.Publish(ctx, event); err != nil {
			nextAttempt := event.Attempts + 1
			if w.MaxAttempts > 0 && nextAttempt >= w.MaxAttempts {
				if markErr := w.Store.MarkDeadLetter(ctx, event.ID); markErr != nil {
					return markErr
				}
				continue
			}
			if markErr := w.Store.MarkRetry(ctx, event.ID, now.Add(w.backoff(nextAttempt))); markErr != nil {
				return markErr
			}
			continue
		}
		if err := w.Store.MarkDone(ctx, event.ID); err != nil {
			return err
		}
	}
	return nil
}
```

Learning:

- outbox 把主状态写入和异步副作用解耦。
- retry budget 和 DLQ 是可靠异步系统的基本验收点。

### Config Hot Swap Validation

Source backlinks:

- Caddy dynamic config: [`04_real_projects/github-project-analysis.md#caddyservercaddy`](../../04_real_projects/github-project-analysis.md#caddyservercaddy)
- Tyk policy definition: [`05_large_systems/github-project-analysis.md#tyktechnologiestyk`](../../05_large_systems/github-project-analysis.md#tyktechnologiestyk)
- Local source: [`internal/app/config.go`](../../capstone_ai_gateway_agent_runtime/internal/app/config.go)
- Tests: [`internal/app/config_test.go`](../../capstone_ai_gateway_agent_runtime/internal/app/config_test.go)

```go
func (c GatewayConfig) Validate() error {
	providers := make(map[core.ProviderName]ProviderConfig, len(c.Providers))
	models := map[core.ModelName]bool{}
	for _, provider := range c.Providers {
		if provider.Name == "" {
			return fmt.Errorf("provider name is required")
		}
		if _, exists := providers[provider.Name]; exists {
			return fmt.Errorf("provider %s is duplicated", provider.Name)
		}
		providers[provider.Name] = provider
		for model, enabled := range provider.Models {
			if enabled {
				models[model] = true
			}
		}
	}
	if len(providers) == 0 {
		return fmt.Errorf("at least one provider is required")
	}

	for _, tenant := range c.Tenants {
		for providerName, allowed := range tenant.AllowedProviders {
			if !allowed {
				continue
			}
			if _, ok := providers[providerName]; !ok {
				return fmt.Errorf("tenant %s allows unknown provider %s", tenant.TenantID, providerName)
			}
		}
		for modelName, allowed := range tenant.AllowedModels {
			if allowed && len(models) > 0 && !models[modelName] {
				return fmt.Errorf("tenant %s allows unknown model %s", tenant.TenantID, modelName)
			}
		}
	}
	return nil
}
```

```go
func (s *ConfigStore) SwapWithAudit(actor string, next GatewayConfig) (int, error) {
	if err := next.Validate(); err != nil {
		return 0, err
	}
	next = cloneGatewayConfig(next)

	s.mu.Lock()
	defer s.mu.Unlock()

	previousVersion := s.version
	previous := s.current
	s.version++
	s.current = next
	s.history[s.version] = cloneGatewayConfig(next)
	s.audit = append(s.audit, ConfigAuditEvent{
		Action:          "swap",
		Actor:           actor,
		Version:         s.version,
		PreviousVersion: previousVersion,
		Summary:         configSummary(previous, next),
	})
	return s.version, nil
}
```

```go
func (s *ConfigStore) Rollback(actor string, targetVersion int) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	target, ok := s.history[targetVersion]
	if !ok {
		return 0, fmt.Errorf("config version %d not found", targetVersion)
	}
	previousVersion := s.version
	previous := s.current
	next := cloneGatewayConfig(target)
	s.version++
	s.current = next
	s.history[s.version] = cloneGatewayConfig(next)
	s.audit = append(s.audit, ConfigAuditEvent{
		Action:          "rollback",
		Actor:           actor,
		Version:         s.version,
		PreviousVersion: previousVersion,
		TargetVersion:   targetVersion,
		Summary:         configSummary(previous, next),
	})
	return s.version, nil
}
```

Learning:

- hot swap 必须先验证整份 next config，再替换当前运行态。
- tenant policy 里的 provider/model 引用要跨配置校验，避免运行时路由到不存在的 provider。
- `Snapshot` 和 `Swap` 都 clone map/slice，避免外部调用方拿到内部可变状态。
- accepted swap 要记录 actor、previous version、new version 和 summary，方便事后审计。
- rollback 不会“倒退版本号”，而是把旧 snapshot 恢复成一个新的当前版本。

### Graceful Drain Shutdown Order

Source backlinks:

- modern-go-application composition: [`02_project_structure/github-project-analysis.md#sagikazarmarkmodern-go-application`](../../02_project_structure/github-project-analysis.md#sagikazarmarkmodern-go-application)
- Caddy lifecycle: [`04_real_projects/github-project-analysis.md#caddyservercaddy`](../../04_real_projects/github-project-analysis.md#caddyservercaddy)
- Local test: [`internal/platform/lifecycle/app_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go)

```go
app := App{
	Components: []Component{
		recordingComponent{name: "worker", recorder: recorder, started: started},
		recordingComponent{name: "ingress", recorder: recorder, started: started},
	},
	ShutdownTimeout: time.Second,
}
```

```go
events := recorder.snapshot()
ingressShutdown := indexOf(events, "shutdown:ingress")
workerShutdown := indexOf(events, "shutdown:worker")
if ingressShutdown == -1 || workerShutdown == -1 {
	t.Fatalf("missing shutdown events: %v", events)
}
if ingressShutdown > workerShutdown {
	t.Fatalf("ingress must stop before workers drain: %v", events)
}
```

Learning:

- 组件按依赖顺序注册：worker 在前、ingress 在后；shutdown 反向执行。
- 大流量网关关闭时先停入口，再 drain provider queue、agent event writer、outbox、telemetry。
- 这类顺序不要只靠约定，要放进测试。

## 16. Run The Proof

```bash
export GOROOT="$HOME/.local/go/current"
export GOPATH="$HOME/go"
export PATH="$GOROOT/bin:$GOPATH/bin:$PATH"

cd /Users/jiahaoqian/proj/go_learning/capstone_ai_gateway_agent_runtime
go test ./...
```

```bash
cd /Users/jiahaoqian/proj/go_learning/architecture_labs
go test ./...
```

```bash
cd /Users/jiahaoqian/proj/go_learning/api_service
go test ./...
```

验收重点：

| Proof | Test |
|---|---|
| gateway fallback + telemetry + audit | [`internal/app/demo_test.go`](../../capstone_ai_gateway_agent_runtime/internal/app/demo_test.go) |
| endpoint middleware order and short-circuit | [`internal/gateway/core/endpoint_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint_test.go) |
| policy deny model/tenant | [`internal/gateway/core/service_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service_test.go), [`internal/app/demo_test.go`](../../capstone_ai_gateway_agent_runtime/internal/app/demo_test.go) |
| provider queue overload | [`internal/gateway/provider/queue_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue_test.go) |
| breaker opens after fallback errors | [`internal/gateway/provider/breaker_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/breaker_test.go) |
| half-open breaker | [`internal/gateway/provider/timed_breaker_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/timed_breaker_test.go) |
| bounded provider in-flight limit | [`internal/gateway/provider/bounded_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/bounded_test.go) |
| agent tool event flow | [`internal/agent/runner/runner_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner_test.go) |
| agent graph interrupt/step budget | [`internal/agent/graph/graph_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph_test.go) |
| slow consumer non-blocking stream | [`internal/agent/stream/bus_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus_test.go) |
| stream replay cursor | [`internal/agent/stream/replay_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/replay_test.go) |
| async telemetry queue | [`internal/platform/telemetry/exporter_async_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async_test.go) |
| lifecycle shutdown | [`internal/platform/lifecycle/app_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go) |
| graceful drain shutdown order | [`internal/platform/lifecycle/app_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go) |
| config hot swap validation/audit/rollback | [`internal/app/config_test.go`](../../capstone_ai_gateway_agent_runtime/internal/app/config_test.go) |
| route scoring | [`internal/gateway/router/scoring_test.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/router/scoring_test.go) |
| event version upcaster | [`internal/agent/event/versioned_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/versioned_test.go) |
| RAG permission filter | [`internal/agent/tool/rag_test.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/tool/rag_test.go) |
| outbox retry and dead letter | [`internal/platform/outbox/worker_test.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/outbox/worker_test.go) |
