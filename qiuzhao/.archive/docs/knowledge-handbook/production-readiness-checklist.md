# Production Readiness Checklist

这份清单把手册内容转成上线前检查项。每一项都要能用代码、测试或指标证明。

## Gateway Core

### Provider Routing

- [ ] provider selection 可单测。
- [ ] preferred provider unhealthy 时 fallback。
- [ ] preferred provider 不存在时有明确策略。
- [ ] route plan 记录 provider/model/fallback index。

Test shape:

```go
func TestRoutePlanIncludesFallbacks(t *testing.T) {
	plan := router.Plan(ChatRequest{
		Provider: "openai",
		Model:    "gpt-x",
		Fallbacks: []Route{
			{Provider: "anthropic", Model: "claude-x"},
		},
	})
	if len(plan) != 2 {
		t.Fatalf("expected primary + fallback, got %d", len(plan))
	}
}
```

### Error Taxonomy

- [ ] timeout 可重试。
- [ ] provider 5xx 可重试。
- [ ] invalid input 不重试。
- [ ] unauthorized 不重试。
- [ ] quota exhausted 按 tenant policy 判断。
- [ ] retry budget exhausted 不继续 fallback。

Test shape:

```go
func TestCanFallback(t *testing.T) {
	tests := []struct {
		class ErrorClass
		want  bool
	}{
		{ErrorTimeout, true},
		{ErrorProviderError, true},
		{ErrorInvalidInput, false},
		{ErrorUnauthorized, false},
	}
	for _, tt := range tests {
		err := GatewayError{Class: tt.class, Err: errors.New(string(tt.class))}
		if got := CanFallback(err); got != tt.want {
			t.Fatalf("%s: want %v got %v", tt.class, tt.want, got)
		}
	}
}
```

### Rate Limit And Backpressure

- [ ] 每个 tenant 有 request limit。
- [ ] 每个 tenant 有 token budget。
- [ ] 每个 provider queue 有容量。
- [ ] queue full 返回可观测错误。
- [ ] context cancel 可以退出等待。
- [ ] provider breaker 能在连续可重试失败后打开。

Code shape:

```go
func (g Gateway) Admit(ctx context.Context, tenant Tenant, req ChatRequest) error {
	if err := g.requestLimiter.Consume(ctx, tenant.ID, 1); err != nil {
		return err
	}
	if err := g.tokenLimiter.Consume(ctx, tenant.ID, req.EstimatedTokens()); err != nil {
		return err
	}
	return g.providerQueues[req.Provider].TrySubmit(ctx, req)
}
```

Local proof: `capstone_ai_gateway_agent_runtime/internal/gateway/provider` covers queue full and breaker open tests.
Local proof: `capstone_ai_gateway_agent_runtime/internal/gateway/fallback` covers retry budget tests.

## Agent Runtime

### Event Store

- [ ] event append 是主路径。
- [ ] event ID 稳定。
- [ ] tool call ID 稳定。
- [ ] 可从 events replay session state。
- [ ] event schema 有 version。

Test shape:

```go
func TestReplayToolLifecycle(t *testing.T) {
	events := []Event{
		{Type: EventToolCallStarted, ToolCallID: "t1"},
		{Type: EventToolCallFinished, ToolCallID: "t1"},
	}
	state := Replay(events)
	if len(state.RunningTools) != 0 {
		t.Fatalf("expected no running tools, got %+v", state.RunningTools)
	}
}
```

### Tool Execution

- [ ] tool 有 timeout。
- [ ] tool input 有 schema/validation。
- [ ] tool result 进入事件流。
- [ ] tool error 进入事件流。
- [ ] 外部副作用有 idempotency key。

Code shape:

```go
ctx, cancel := context.WithTimeout(ctx, tool.Timeout)
defer cancel()

result, err := tool.Invoke(ctx, input)
if err != nil {
	events.Append(ctx, ToolFailed(call.ID, err))
	return err
}
events.Append(ctx, ToolSucceeded(call.ID, result))
```

### Graph Execution

- [ ] 每个 node 有 ID。
- [ ] 每次 node transition 记录事件。
- [ ] 循环有最大步数或 budget。
- [ ] human interrupt 是显式状态。

Code shape:

```go
for step := 0; step < maxSteps; step++ {
	next, err := graph.nodes[current].Run(ctx, state)
	if err != nil {
		return err
	}
	events.Append(ctx, NodeTransitioned(current, next.NodeID))
	current = next.NodeID
}
return ErrStepBudgetExceeded
```

Local proof: `capstone_ai_gateway_agent_runtime/internal/agent/graph` covers node transition, step budget and human interrupt tests.

## Observability

### Metrics

- [ ] request count by tenant/model/provider/status/error_class。
- [ ] provider latency histogram。
- [ ] fallback attempts count。
- [ ] queue depth and queue full count。
- [ ] tool latency and error count。
- [ ] telemetry dropped count。

Metric shape:

```go
gatewayRequestsTotal.WithLabelValues(
	tenantID,
	model,
	provider,
	status,
	errorClass,
).Inc()
```

Local proof: `capstone_ai_gateway_agent_runtime/internal/platform/telemetry` has an async exporter with bounded queue and dropped count.

### Event Stream

- [ ] event stream 不阻塞主运行路径。
- [ ] slow consumer 有显式丢弃或断开策略。
- [ ] durable event store 是 source of truth。
- [ ] live stream dropped count 可观测。

Code shape:

```go
select {
case subscriber <- event:
default:
	streamDroppedTotal.Inc()
}
```

Local proof: `capstone_ai_gateway_agent_runtime/internal/agent/stream`.

### Tracing

- [ ] `gateway.request` span。
- [ ] `gateway.route` span/event。
- [ ] `provider.call` span。
- [ ] `fallback.attempt` span/event。
- [ ] `agent.run` span。
- [ ] `tool.call` span。
- [ ] `event.persist` span。

Trace shape:

```go
ctx, span := tracer.Start(ctx, "provider.call",
	trace.WithAttributes(
		attribute.String("provider", route.Provider),
		attribute.String("model", route.Model),
		attribute.Int("fallback.index", attempt),
	),
)
defer span.End()
```

### Logs

- [ ] JSON structured logs。
- [ ] request ID / trace ID 全链路传递。
- [ ] provider error 不泄露敏感 key。
- [ ] prompt 和 tool payload 有脱敏策略。

Log shape:

```go
log.Info("provider attempt",
	"trace_id", traceID,
	"provider", provider,
	"model", model,
	"attempt", attempt,
	"latency_ms", latency.Milliseconds(),
)
```

## Storage

### Session/Event Store

- [ ] append-only event table/stream。
- [ ] 按 session ID 查询。
- [ ] event ID 唯一。
- [ ] created_at 可排序。
- [ ] payload version 可演进。

Schema shape:

```sql
CREATE TABLE agent_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
```

### Request Log

- [ ] request ID。
- [ ] tenant ID。
- [ ] provider/model。
- [ ] latency。
- [ ] tokens/cost。
- [ ] error class。
- [ ] fallback index。

Go shape:

```go
type RequestLog struct {
	ID          string
	TenantID    string
	Provider    string
	Model       string
	Latency     time.Duration
	InputTokens int
	OutputTokens int
	ErrorClass  string
	FallbackIndex int
}
```

Local proof: `capstone_ai_gateway_agent_runtime/internal/gateway/audit`.

## Control Plane

### Config Hot Swap

- [ ] next config 先整体验证，验证通过后才替换 current config。
- [ ] tenant policy 引用的 provider 必须存在。
- [ ] tenant policy 引用的 model 必须存在于 provider model catalog。
- [ ] config snapshot 返回 copy，不能暴露内部 map/slice。
- [ ] 每次 config swap 记录 actor、版本、diff summary 和结果。
- [ ] rollback 恢复旧 snapshot 时生成新的当前版本，而不是覆盖历史版本。

Code shape:

```go
func (s *ConfigStore) SwapWithAudit(actor string, next GatewayConfig) (int, error) {
	if err := next.Validate(); err != nil {
		return 0, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.version++
	s.current = cloneGatewayConfig(next)
	s.audit = append(s.audit, ConfigAuditEvent{Actor: actor, Version: s.version})
	return s.version, nil
}
```

Local proof: `capstone_ai_gateway_agent_runtime/internal/app/config_test.go`.

## Shutdown

- [ ] HTTP server 停止接新请求。
- [ ] provider queues drain 或快速取消。
- [ ] telemetry queue flush 有 timeout。
- [ ] background runners 收到 context cancel。
- [ ] 长 tool call 有取消策略。
- [ ] shutdown 顺序能保证 ingress 先停、worker 后 drain。

Code shape:

```go
shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

_ = httpServer.Shutdown(shutdownCtx)
_ = providerManager.Stop(shutdownCtx)
_ = telemetry.Flush(shutdownCtx)
```

Local proof: `capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app_test.go`.

## Security And Cost

- [ ] API key 不进日志。
- [ ] tenant policy 限制 allowed models。
- [ ] token budget 不能绕过。
- [ ] tool 权限按 agent/session/user 检查。
- [ ] RAG 文档有权限过滤。
- [ ] admin API 有鉴权和审计。
- [ ] 外部副作用使用 idempotency key。

Policy shape:

```go
type TenantPolicy struct {
	AllowedModels       map[string]bool
	RequestsPerMinute  int
	TokensPerDay       int
	AllowFallbacks     bool
	AllowedToolNames   map[string]bool
}
```

Local proof: `capstone_ai_gateway_agent_runtime/internal/platform/idempotency`.

## Final Gate

Capstone implementation manual: [`capstone-implementation-manual.md`](capstone-implementation-manual.md).

上线前最小测试集：

```bash
go test ./...
go test -race ./...
```

最小压测问题：

```text
1. provider 慢 5 秒，请求池是否被拖垮？
2. provider 50% 失败，fallback 是否放大流量？
3. telemetry 后端不可用，请求是否仍能返回？
4. agent tool 卡住，session 是否可取消？
5. 进程重启，agent event 是否能 replay？
6. 推送错误配置，当前运行配置是否保持不变？
```

Capstone 最小验收测试：

```go
func TestProductionGateCoversCriticalFailures(t *testing.T) {
	tests := []struct {
		name string
		run  func(t *testing.T, app *Harness)
	}{
		{"gateway fallback", assertGatewayFallback},
		{"provider queue full", assertProviderQueueFull},
		{"agent tool failure event", assertAgentToolFailureEvent},
		{"telemetry exporter degraded", assertTelemetryDegradeDoesNotBlockChat},
		{"shutdown drains", assertShutdownDrains},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := newProductionLikeHarness(t)
			tt.run(t, app)
		})
	}
}
```

这些测试必须对应真实包边界，而不是只测一个孤立函数：HTTP handler、gateway core、provider queue、agent event store、telemetry exporter 和 lifecycle 至少各穿过一次。
