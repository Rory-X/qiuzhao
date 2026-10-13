# Concept: Observability

可观测不是最后加日志，而是系统设计的一部分。AI gateway 和 agent runtime 必须能回答：谁调用了哪个模型、经过哪个 provider、耗时多少、fallback 几次、token/cost 多少、tool 在哪一步失败。

## Source Backlinks

- [OpenTelemetry Collector](../../github-materials/advanced-systems.md#open-telemetryopentelemetry-collector)：receiver、processor、exporter pipeline。
- [Modern Go Application](../../github-materials/project-structure-style.md#sagikazarmarkmodern-go-application)：生产启动面里的 metrics/tracing/health。
- [go-kit examples](../../github-materials/architecture-patterns.md#go-kitexamples)：endpoint middleware 是埋点好位置。
- [Bifrost](../../github-materials/advanced-systems.md#maximhqbifrost)：AI gateway 观测参考源。

## Local Go Backlinks

- [`docs/target-ai-gateway-agent-platform.md`](../../target-ai-gateway-agent-platform.md)：最终系统要求记录 latency、tokens、provider、error、trace id。
- Future: `observability_lab`.

## Signal Model

Gateway span 建议分层：

```text
gateway.request
  gateway.route
  provider.call
  fallback.attempt
```

Agent span 建议分层：

```text
agent.run
  model.step
  tool.call
  event.persist
```

## Code Patterns

Telemetry event:

```go
type TelemetryEvent struct {
	TraceID    string
	Name       string
	Provider   string
	Model      string
	LatencyMS  int64
	ErrorClass string
}
```

Processor/exporter:

```go
type Processor interface {
	Process(context.Context, TelemetryEvent) (TelemetryEvent, error)
}

type Exporter interface {
	Export(context.Context, TelemetryEvent) error
}
```

More patterns: [`../go-code-patterns.md`](../go-code-patterns.md).

## Failure Modes

- 只有日志，没有 metrics，无法看趋势。
- 只有 metrics，没有 trace，无法定位单个慢请求。
- provider error 没有分类，告警只能看到“失败了”，不知道能不能重试。

## Source To Code Deep Dive

这个概念的完整闭环：

```text
OpenTelemetry Collector receiver/processor/exporter
  -> Tyk analytics dimensions
  -> Bifrost provider attempts
  -> capstone telemetry.MemoryExporter + AsyncExporter + audit log
```

关键本地代码：

- Telemetry event: [`../../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/event.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/event.go)
- Async exporter: [`../../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go`](../../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go)
- Gateway fallback recording: [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go)
- Audit log: [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/audit/log.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/audit/log.go)

Provider attempt 是 AI gateway 最重要的观测事件：

```go
_ = e.telemetry.Record(ctx, telemetry.Event{
	Name:          "gateway.provider_attempt",
	RequestID:     string(req.RequestID),
	TenantID:      string(req.TenantID),
	Model:         string(route.Model),
	Provider:      string(route.Provider),
	ErrorClass:    string(errorClass),
	FallbackIndex: index,
})
```

异步 exporter 不能阻塞主请求路径：

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
```

Audit 与 telemetry 分开：audit 记录业务账本，telemetry 负责趋势和诊断。

```go
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
```

继续扩展时优先读：

- [`../production-patterns-cookbook.md#async-telemetry-with-dimensions`](../production-patterns-cookbook.md#async-telemetry-with-dimensions)
- [`../production-patterns-cookbook.md#audit-log-and-cost-ledger`](../production-patterns-cookbook.md#audit-log-and-cost-ledger)
- [`../key-code-index.md#13-async-telemetry-exporter`](../key-code-index.md#13-async-telemetry-exporter)
- [`../production-readiness-checklist.md`](../production-readiness-checklist.md)
