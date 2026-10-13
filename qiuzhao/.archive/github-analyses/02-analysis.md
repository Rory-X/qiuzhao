# 02 GitHub Project Analysis: Project Structure And Style

Verified: 2026-07-06.

本阶段关注“代码放在哪里、接口归谁、入口做什么、生产能力如何组装”。这些问题会直接决定后续 AI gateway 和 agent runtime 是否能长期演进。

## Source Snapshot

| Project | HEAD | Read anchors |
|---|---:|---|
| [golang-standards/project-layout](https://github.com/golang-standards/project-layout/tree/a9d6fae7015527b10550ebb6d6b71a71b1ef5ea7) | `a9d6fae` | `README.md`, `cmd/README.md`, `internal/README.md`, `pkg/README.md`, `api/README.md` |
| [uber-go/guide](https://github.com/uber-go/guide/tree/1d60a91aa5e87d443002e23c21903c49489dbde5) | `1d60a91` | `style.md`, `src/error-wrap.md`, `src/channel-size.md`, `src/container-copy.md` |
| [google/styleguide](https://github.com/google/styleguide/tree/1809c769de31ba388c755ad15dd057a9ba8531fd/go) | `1809c76` | `go/guide.md`, `go/best-practices.md`, `go/decisions.md` |
| [sagikazarmark/modern-go-application](https://github.com/sagikazarmark/modern-go-application/tree/468a20bc42f96ffebae693a51b006b263b4a497e) | `468a20b` | `cmd/modern-go-application/main.go`, `internal/app/mga/app.go`, `internal/platform/*` |

## Key Code Blocks

这些代码块把目录结构和风格指南翻译成可落地的 Go 代码约束。

### Project Layout Shape

```text
cmd/gateway/main.go
internal/gateway/httpapi
internal/gateway/router
internal/gateway/provider
internal/agent/session
internal/agent/runner
internal/platform/observability
```

```go
func main() {
	cfg := loadConfig()
	logger := newLogger(cfg)

	router := gateway.NewRouter(cfg.Providers)
	handler := httpapi.NewHandler(router, logger)

	server := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: handler.Routes(),
	}
	runWithShutdown(server, logger)
}
```

### Error Wrapping Shape

Uber guide 的错误包装适合 provider 调用链。

```go
func (c *Client) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	resp, err := c.callProvider(ctx, req)
	if err != nil {
		return ChatResponse{}, fmt.Errorf("provider %s chat: %w", c.name, err)
	}
	return resp, nil
}
```

### Slice Copy Boundary

不要把内部状态直接暴露出去。

```go
func (s *Session) Events() []Event {
	events := make([]Event, len(s.events))
	copy(events, s.events)
	return events
}
```

### Channel Size With Backpressure

channel 缓冲就是容量决策，不是随手写个数字。

```go
type Queue struct {
	jobs chan Job
}

func NewQueue(capacity int) *Queue {
	if capacity < 1 {
		capacity = 1
	}
	return &Queue{jobs: make(chan Job, capacity)}
}

func (q *Queue) TryEnqueue(job Job) error {
	select {
	case q.jobs <- job:
		return nil
	default:
		return ErrQueueFull
	}
}
```

### Small Consumer-Side Interface

Google styleguide 对网关的最大启发：调用方定义小接口。

```go
type ChatCaller interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type Handler struct {
	chat ChatCaller
}
```

### Production App Composition

modern-go-application 的学习重点是启动面：配置、平台能力、业务 app 分开。

```go
type App struct {
	HTTPServer *http.Server
	Metrics    MetricsServer
	Workers    []Worker
}

func (a *App) Run(ctx context.Context) error {
	group, ctx := errgroup.WithContext(ctx)
	group.Go(func() error { return a.HTTPServer.ListenAndServe() })
	for _, worker := range a.Workers {
		w := worker
		group.Go(func() error { return w.Run(ctx) })
	}
	return group.Wait()
}
```

## golang-standards/project-layout

**它解决什么问题**：给常见 Go 目录名一个词典，但它不是官方标准。最重要的学习点是“目录名表达承诺”。

**关键段落/代码剖析**：

- `cmd/README.md`：每个可执行程序一个目录，`main.go` 只做组装和启动。迁移到最终项目就是 `cmd/gateway`、`cmd/worker`。
- `internal/README.md`：这是 Go 编译器强制的私有边界。业务核心、provider router、agent runner 默认应放 `internal`。
- `pkg/README.md`：只有真的要给外部项目复用时才放 `pkg`。过早建 `pkg` 会让内部业务 API 变成“看起来公开”的承诺。
- `api/README.md`：OpenAPI、proto、JSON schema 这类接口契约应该和实现分开。

**迁移到本工作区**：

```text
api_service/cmd/api -> executable entry
api_service/internal/httpapi -> transport boundary
api_service/internal/resource -> domain/application
future internal/gateway/provider -> provider abstraction
future internal/agent/runner -> agent runtime
```

**本地练习**：画出 `api_service` 当前目录树，给每个目录写一句“它承诺什么、不承诺什么”。

Backlinks: [Architecture Boundaries](../docs/knowledge-handbook/concepts/architecture-boundaries.md)

## uber-go/guide

**它解决什么问题**：团队级 Go 风格，重点不是格式化，而是错误、并发、API 边界和可维护性。

**关键段落/代码剖析**：

- `src/error-wrap.md`：跨层错误要保留上下文。AI gateway 应该能产生类似 `provider openai chat: deadline exceeded` 的错误链。
- `src/channel-size.md`：channel 缓冲需要设计理由。无理由的大 buffer 就是隐藏队列，会把背压问题推迟到内存爆掉。
- `src/container-copy.md`：slice/map 跨边界返回时要注意拷贝，避免外部调用方改内部状态。当前 `architecture_labs/agent.Events()` 已经使用 copy。
- `style.md`：强调小而清晰的 API，尤其是 goroutine 生命周期、defer、mutex、接口命名等长期细节。

**迁移到本工作区**：

- 所有 `Events()`、`Messages()`、`Drain()` 这类返回内部集合的方法都应考虑拷贝。
- 每个 goroutine 要能通过 context 或 close path 退出。
- provider 错误要分层包装，但不要把底层实现泄露给 HTTP response。

**本地练习**：检查 `architecture_labs/*` 中所有返回 slice 的方法，确认是否 copy。

Backlinks: [Concurrency And Backpressure](../docs/knowledge-handbook/concepts/concurrency-backpressure.md)

## google/styleguide Go

**它解决什么问题**：建立清晰、简单、可维护的一致代码标准。它尤其适合约束“不要为了架构感过度抽象”。

**关键段落/代码剖析**：

- `go/guide.md` 的核心是清晰、简单、简洁、可维护、一致。对学习者来说，先能读懂和测试，比模板层数更重要。
- `go/best-practices.md` 里关于接口的思想很关键：接口通常由使用方定义，且越小越好。
- `go/decisions.md` 适合处理具体团队取舍，例如命名、注释、错误、测试组织。

**迁移到本工作区**：

- 不要一上来写巨大的 `Provider` 接口，把 chat、embedding、image、audio、health、pricing 全塞进去。
- `gateway` 初期可以只有 `Select(preferred string)`；后面再演进成 `Route(ctx, request)`。
- 注释解释 why，不重复 what。并发和可靠性取舍值得注释。

**本地练习**：给未来 `ProviderClient` 先设计最小 chat-only interface，再写一个 fake provider 测试。

Backlinks: [Architecture Boundaries](../docs/knowledge-handbook/concepts/architecture-boundaries.md), [AI Gateway](../docs/knowledge-handbook/concepts/ai-gateway.md)

## sagikazarmark/modern-go-application

**它解决什么问题**：展示一个生产 Go 应用如何把配置、日志、数据库、健康检查、遥测、HTTP/gRPC/GraphQL/消息等能力组装起来。

**关键段落/代码剖析**：

- `cmd/modern-go-application/main.go` 很长，正说明生产启动面会自然膨胀：配置、日志、健康检查、metrics、tracing、数据库、消息、server lifecycle 都在入口组装。
- `internal/app/mga/app.go` 展示应用层如何装配多个 transport 和 middleware，而不是把所有东西塞进 handler。
- `internal/platform/*` 把数据库、日志、health、platform 依赖和业务应用分离。

**迁移到本工作区**：

```text
cmd/gateway
  load config
  init logger/tracer/metrics
  init store/queue/provider clients
  build HTTP server and background workers
  handle graceful shutdown
```

**本地练习**：为未来 `gateway_lab` 写启动职责清单，明确哪些属于 `cmd/gateway`，哪些属于 `internal/gateway`。

Backlinks: [Observability](../docs/knowledge-handbook/concepts/observability.md), [Architecture Boundaries](../docs/knowledge-handbook/concepts/architecture-boundaries.md)

## 本阶段知识网

```text
project-layout -> directory vocabulary
Uber guide -> correctness in errors/concurrency/API boundaries
Google styleguide -> small interfaces and clarity
modern-go-application -> production startup and platform composition
```
