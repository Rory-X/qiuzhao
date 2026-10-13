# Closed Learning Loop

这个文件把学习路线闭环化：不是“读 GitHub -> 做笔记”就结束，而是每个材料都要落到概念、代码模板、测试和最终系统能力。

## The Loop

```text
1. Source
   读 GitHub README / 入口 / 核心接口 / 一条链路

2. Segment
   拆出一段关键材料：一个接口、一个函数、一个状态机、一个启动流程

3. Concept
   归入知识节点：AI Gateway、Agent Runtime、Backpressure、Observability

4. Code Pattern
   翻译成可复用 Go 模板：interface、middleware、queue、event store

5. Local Lab
   落到 architecture_labs 或 capstone_ai_gateway_agent_runtime

6. Verification
   用 go test、表格测试、链路图、压测或指标证明理解

7. Expansion
   从内存实现扩展到 Redis/NATS/Postgres/OpenTelemetry/Temporal 思想
```

本地 lab 逐段讲解见 [`local-labs/README.md`](local-labs/README.md)。
Capstone 真实代码 walkthrough 见 [`local-labs/capstone-lab.md`](local-labs/capstone-lab.md)。
Go 参考实现代码块见 [`reference-implementations.md`](reference-implementations.md)。
大系统关键链路蓝图见 [`system-blueprints.md`](system-blueprints.md)。
来源到 Capstone 的知识网络见 [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)。
术语/心智模型反查见 [`mental-models-glossary.md`](mental-models-glossary.md)。
01-04 仓库源码锚点见 [`source-code-anchors-foundations.md`](source-code-anchors-foundations.md)。
高级仓库源码锚点见 [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)。
下一阶段实现路线见 [`implementation-roadmap.md`](implementation-roadmap.md)。
动手练习见 [`practice-workbook.md`](practice-workbook.md)。
覆盖矩阵见 [`traceability-matrix.md`](traceability-matrix.md)。
最终包级实施手册见 [`capstone-implementation-manual.md`](capstone-implementation-manual.md)。

## Phase Closure Criteria

每个阶段必须有“能证明学到了”的输出，而不是只读完。

| Phase | Source | Concept | Required proof |
|---|---|---|---|
| 01 Language Basics | Go by Example, Learn Go with Tests, Go 101 | interface, context, goroutine, test | 写出带 context 的 fake provider、worker pool、表格测试 |
| 02 Project Structure | project-layout, Uber, Google, modern-go-application | package boundary, error, startup, lifecycle | 解释 `cmd/internal/pkg` 取舍，写出 `cmd/gateway` 启动草图 |
| 03 Architecture Patterns | Wild Workouts, Clean Architecture, Evrone, go-kit | domain, usecase, endpoint, transport | 把 HTTP -> usecase -> repository 链路画出来，写 endpoint middleware |
| 04 Real Projects | PocketBase, Memos, Caddy, Syncthing | product lifecycle, hook, plugin, protocol | 设计 provider/plugin lifecycle 和 agent event protocol |
| 05 Large Systems | Bifrost, trpc-agent-go, Tyk, Hertz, OTel, Temporal, NATS | gateway, agent, observability, durable workflow | 实现 provider fallback、event history、telemetry pipeline、bounded queue |

## Reading To Code Translation

每个项目都必须回答下面 6 个问题：

```text
What problem?
  这个仓库解决什么系统问题？

Entry?
  程序入口、README 入口、配置入口在哪里？

Core abstraction?
  关键 interface / struct / state machine / middleware 是什么？

Critical path?
  一条请求、消息、任务、事件如何穿过系统？

Go pattern?
  它应该翻译成 Go 的什么形状？

Local proof?
  本地哪个 lab 或测试能证明我真的理解了？
```

## Closed Loop Example: AI Gateway

```text
Bifrost README/core fallback
  -> provider queue + fallback decision
  -> AI Gateway concept
  -> ProviderQueue + FallbackLoop code pattern
  -> architecture_labs/gateway
  -> tests: preferred unhealthy, queue full, non-retryable error
  -> production expansion: rate limit, circuit breaker, telemetry
```

Learning translation:

```go
type Route struct {
	Provider string
	Model    string
}

type Gateway struct {
	router    Router
	providers map[string]ProviderClient
	telemetry TelemetrySink
}

func (g *Gateway) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	routes := g.router.Plan(req)
	var lastErr error

	for attempt, route := range routes {
		resp, err := g.providers[route.Provider].Chat(ctx, req.WithRoute(route))
		if err == nil {
			g.telemetry.ProviderSuccess(ctx, route, attempt)
			return resp, nil
		}
		lastErr = err
		g.telemetry.ProviderFailure(ctx, route, attempt, err)
		if !IsRetryableProviderError(err) {
			break
		}
	}

	return ChatResponse{}, lastErr
}
```

## Closed Loop Example: Agent Runtime

```text
trpc-agent-go event/tool/graph
  -> event model + tool adapter + graph execution
  -> Agent Runtime concept
  -> EventStore + Runner + ToolExecutor code pattern
  -> architecture_labs/agent
  -> tests: event order, tool call id, replay state
  -> production expansion: durable store, human interrupt, streaming UI
```

Learning translation:

```go
type Runner struct {
	events EventStore
	tools  ToolExecutor
	model  ModelClient
}

func (r *Runner) Run(ctx context.Context, sessionID string, input string) error {
	if err := r.events.Append(ctx, sessionID, Event{Type: EventUserMessage, Content: input}); err != nil {
		return err
	}

	decision, err := r.model.Next(ctx, sessionID)
	if err != nil {
		return err
	}

	for _, call := range decision.ToolCalls {
		if err := r.runTool(ctx, sessionID, call); err != nil {
			return err
		}
	}

	return r.events.Append(ctx, sessionID, Event{
		Type:    EventAssistantMessage,
		Content: decision.FinalText,
	})
}
```

## Closed Loop Example: Observability

```text
OpenTelemetry Collector receiver/processor/exporter
  -> telemetry pipeline
  -> Observability concept
  -> Receiver + Processor + Exporter code pattern
  -> future observability_lab
  -> tests: exporter receives provider latency and error class
```

Learning translation:

```go
type TelemetryEvent struct {
	Name       string
	TraceID    string
	Provider   string
	Model      string
	LatencyMS  int64
	ErrorClass string
}

type TelemetryProcessor interface {
	Process(ctx context.Context, event TelemetryEvent) (TelemetryEvent, error)
}

type TelemetryExporter interface {
	Export(ctx context.Context, event TelemetryEvent) error
}
```

## Local Proof Checklist

每新增一份知识内容，必须至少连到一个本地证明：

- `go test ./...` 能跑。
- 有一个表格测试覆盖关键规则。
- 有一个本地 Go code pattern 能被复制到未来 lab。
- 有反链：source -> concept -> local lab。
- 有跨来源落点：能在 [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md) 找到对应 Capstone package 和学习版 Go 翻译。
- 有扩展方向：内存实现如何升级成生产级组件。
- 有代码落点：能在 [`reference-implementations.md`](reference-implementations.md) 或 [`system-blueprints.md`](system-blueprints.md) 找到对应骨架。
- 有最终落点：能在 [`capstone-implementation-manual.md`](capstone-implementation-manual.md) 找到包名、接口、fake、E2E 测试和验收标准。
- 01-04 基础仓库要有真实源码锚点：文件、符号、行号、设计解释和学习版 Go 翻译。
- 高级仓库还要有真实源码锚点：文件、符号、行号、设计解释和学习版 Go 翻译。

## Current Best Next Labs

这些是从当前手册自然推出的下一个代码任务：

1. `capstone_ai_gateway_agent_runtime/internal/gateway/router`：provider route plan + fallback loop + retryable error taxonomy。
2. `capstone_ai_gateway_agent_runtime/internal/gateway/policy`：per-key token budget + admission behavior。
3. `capstone_ai_gateway_agent_runtime/internal/agent/event`：append/list/replay event history。
4. `capstone_ai_gateway_agent_runtime/internal/agent/runner`：model decision -> tool call -> tool result -> assistant message。
5. `capstone_ai_gateway_agent_runtime/internal/platform/telemetry`：gateway telemetry event -> memory exporter。
6. [`capstone_ai_gateway_agent_runtime`](../../capstone_ai_gateway_agent_runtime/README.md)：把 gateway、agent、stream、telemetry、lifecycle 组合成一个可验收系统。
