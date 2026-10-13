# 01 GitHub Project Analysis: Language Basics

Verified: 2026-07-06.

本阶段目标不是背语法，而是把 Go 的基本表达方式和后续架构能力连起来：接口、测试、context、goroutine、channel、错误处理、标准库 HTTP。

## Source Snapshot

| Project | HEAD | Read anchors |
|---|---:|---|
| [go101/go101](https://github.com/go101/go101/tree/c13b00435002a00f574430b61eb65ec5a268acfe) | `c13b004` | `README.md`, `pages/fundamentals`, `pages/generics`, `main.go`, `go101.go` |
| [quii/learn-go-with-tests](https://github.com/quii/learn-go-with-tests/tree/dc00c650f66695f7b8cc2e8c8234be177d7b28c6) | `dc00c65` | `README.md`, `arrays/*`, `concurrency/*`, `context.md`, `http-server.md` |
| [mmcgrana/gobyexample](https://github.com/mmcgrana/gobyexample/tree/c437a3d5f6814b1141b822ab19a685c3672cec94) | `c437a3d` | `examples/worker-pools`, `examples/rate-limiting`, `examples/context`, `examples/channel-directions` |
| [golang/example](https://github.com/golang/example/tree/7f05d217867b2af52b0a28c6d1c91df97e1b5b39) | `7f05d21` | `hello`, `helloserver/server.go`, `outyet/main.go` |
| [inancgumus/learngo](https://github.com/inancgumus/learngo/tree/3c475a78e54336c6255e925ff66b8ef4da6a2ae7) | `3c475a7` | `02-write-your-first-program`, `09-go-type-system`, `interfaces`, `concurrency` |

## Key Code Blocks

下面的代码块是“学习版翻译”：保留上游项目的关键代码形状，但按本工作区的 AI gateway/agent 学习目标重新写小。

### Interface And Method Set

Go 101 对后续接口设计的启发：接口只描述调用方真正需要的行为。

```go
type ChatProvider interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type OpenAIProvider struct {
	client *http.Client
}

func (p *OpenAIProvider) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	// Pointer receiver means only *OpenAIProvider implements ChatProvider.
	return ChatResponse{}, nil
}
```

### Test First API Shape

Learn Go with Tests 的核心不是测试框架，而是先用测试逼出边界。

```go
func TestRouterFallsBack(t *testing.T) {
	router := NewRouter([]Provider{
		{Name: "primary", Healthy: false},
		{Name: "backup", Healthy: true},
	})

	got, err := router.Select("primary")
	if err != nil {
		t.Fatalf("select provider: %v", err)
	}
	if got.Name != "backup" {
		t.Fatalf("expected backup, got %q", got.Name)
	}
}
```

### Worker Pool Shape

Go by Example 的 worker pool 可以翻译成 provider request queue。

```go
type Job struct {
	ID      string
	Request ChatRequest
}

func worker(ctx context.Context, jobs <-chan Job, results chan<- Result, provider ChatProvider) {
	for {
		select {
		case <-ctx.Done():
			return
		case job, ok := <-jobs:
			if !ok {
				return
			}
			resp, err := provider.Chat(ctx, job.Request)
			results <- Result{JobID: job.ID, Response: resp, Err: err}
		}
	}
}
```

### Rate Limiter Shape

限流不是业务 handler 的 if，而应成为可组合组件。

```go
type Limiter struct {
	tokens chan struct{}
}

func NewLimiter(n int) *Limiter {
	l := &Limiter{tokens: make(chan struct{}, n)}
	for i := 0; i < n; i++ {
		l.tokens <- struct{}{}
	}
	return l
}

func (l *Limiter) Allow() bool {
	select {
	case <-l.tokens:
		return true
	default:
		return false
	}
}
```

### Standard Library HTTP Shape

`golang/example` 的 `helloserver` 思路可直接落到学习 API。

```go
func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}
```

### Defined Type Shape

learngo 的类型练习可以迁移到 agent event。

```go
type EventType string

const (
	EventUserMessage EventType = "user_message"
	EventToolStarted EventType = "tool_started"
)

func (t EventType) IsToolEvent() bool {
	return t == EventToolStarted
}
```

## go101/go101

**它解决什么问题**：Go 101 是语言语义百科，不是项目模板。它适合在你写网关、agent、并发队列时反查类型系统、接口方法集、泛型、内存和并发语义。

**关键段落/代码剖析**：

- `README.md` 把内容分成 fundamentals、generics、optimizations、details/tips。这个结构本身就是查漏补缺地图：遇到接口实现、nil interface、slice 共享底层数组、map 并发访问、泛型约束时回查。
- `pages/fundamentals` 是后续所有系统代码的语义底座，尤其是 method set、interface value、pointer/value receiver、slice/map/channel。
- `pages/generics` 对后续 typed event、typed repository、graph node state 有用，但不应为了“高级”过早泛型化。
- `main.go`、`go101.go` 展示一个内容型工具如何把资料打包成可运行程序，可以作为“文档站/本地手册工具”的结构参考。

**迁移到 Go 架构学习**：

- 设计 `ProviderClient` 前读 interface/method set。
- 设计 `SessionEvent[T]` 或 graph state 前读 generics。
- 写高并发 map/cache 前读 memory model 和并发安全语义。

**本地练习**：给 `architecture_labs/gateway` 的 `Provider` 增加接口版本，比较 value receiver、pointer receiver、interface nil 的行为。

Backlinks: [Architecture Boundaries](../docs/knowledge-handbook/concepts/architecture-boundaries.md), [Concurrency And Backpressure](../docs/knowledge-handbook/concepts/concurrency-backpressure.md)

## quii/learn-go-with-tests

**它解决什么问题**：用测试先定义行为。这个项目最重要的不是语法覆盖面，而是把“外部可见行为 -> 最小接口 -> 实现”的节奏练熟。

**关键段落/代码剖析**：

- `arrays/*` 用很小的函数和测试说明表格测试、期望值、失败信息。后续网关 fallback、限流和状态机都应该先写这种行为测试。
- `concurrency/*` 把 `WebsiteChecker` 抽成函数依赖，说明并发代码不要直接绑死真实网络。
- `context.md` 把取消和超时从 API 设计层引入。AI provider 调用、tool execution、worker queue 都必须把 `context.Context` 传到底。
- `http-server.md` 是 `api_service` 的直接前置材料：请求解析、响应写入、测试 HTTP handler。

**迁移到 Go 架构学习**：

- `gateway`：先测 preferred provider unhealthy 时 fallback，再实现 router。
- `agent`：先测事件顺序和 tool call ID 保留，再实现 session。
- `inference`：先测 queue full，再实现 bounded queue。

**本地练习**：为 `architecture_labs/gateway` 增加一个表格测试，覆盖 preferred 为空、preferred 不存在、多个健康 provider。

Backlinks: [AI Gateway](../docs/knowledge-handbook/concepts/ai-gateway.md), [Agent Runtime](../docs/knowledge-handbook/concepts/agent-runtime.md)

## mmcgrana/gobyexample

**它解决什么问题**：Go by Example 用一个目录一个概念的方式展示最小可运行代码。它适合把语言点转成小积木。

**关键段落/代码剖析**：

- `examples/channel-directions` 用 `chan<-` 和 `<-chan` 把“只能发送/只能接收”写进函数签名。后续 event bus 可以用这种类型边界防误用。
- `examples/worker-pools` 是 provider worker pool、tool executor pool、batch inference queue 的最小模型。
- `examples/rate-limiting` 是 API key 限流、provider 限流和 token budget 控制的起点。
- `examples/context` 是 deadline、cancel、request lifecycle 的最小模型。

**迁移到 Go 架构学习**：

```text
job -> LLM request
worker -> provider worker
limiter -> per-key/per-provider quota
context -> request deadline and cancellation
```

**本地练习**：把 `architecture_labs/inference` 从 slice queue 扩展为 channel worker pool，要求 queue full 时快速拒绝。

Backlinks: [Concurrency And Backpressure](../docs/knowledge-handbook/concepts/concurrency-backpressure.md)

## golang/example

**它解决什么问题**：官方小型完整程序，帮助你建立标准库优先的服务直觉。

**关键段落/代码剖析**：

- `helloserver/server.go` 是标准库 HTTP server 的最小形态：handler、path、response、listen。它提醒你一开始不必引入框架。
- `outyet/main.go` 更接近长期运行服务：有后台 goroutine、`sync.RWMutex`、模板渲染、状态变量和测试 hook。
- `hello` 说明 module、main package、本地 package 的基础组织方式。

**迁移到 Go 架构学习**：

- `api_service` 可以先坚持 `net/http`，把 handler/service/repository 边界学清楚。
- provider health check 可以参考 `outyet` 的后台轮询思想，但要补 context、shutdown 和 metrics。

**本地练习**：给 `api_service` 增加 `/healthz`，并用标准库 `httptest` 测试。

Backlinks: [Architecture Boundaries](../docs/knowledge-handbook/concepts/architecture-boundaries.md), [Observability](../docs/knowledge-handbook/concepts/observability.md)

## inancgumus/learngo

**它解决什么问题**：大量小练习，适合补肌肉记忆，不适合作为架构模板。

**关键段落/代码剖析**：

- `02-write-your-first-program` 用注释拆 `package main`、`import`、`func main`，帮助你快速识别可执行入口。
- `09-go-type-system` 适合补 defined type、overflow、byte/rune、predeclared type 等基础。
- `interfaces` 目录适合反复练 value/pointer receiver、方法集合、接口组合。
- `concurrency` 目录适合做并发小题，但读大项目时仍要回到 context、生命周期和错误出口。

**迁移到 Go 架构学习**：

- 每读一个大项目卡住时，回这里找相同语言点的小练习。
- 不从这里学习项目分层，只用来加固语法和 idiom。

**本地练习**：把 `architecture_labs/agent.EventType` 改成带方法的 defined type，练习 typed constant 和方法。

Backlinks: [Architecture Boundaries](../docs/knowledge-handbook/concepts/architecture-boundaries.md)

## 本阶段知识网

```text
Go 101 -> language semantics -> provider interface / event type
Learn Go with Tests -> behavior first -> gateway and agent tests
Go by Example -> concurrency primitives -> bounded queue / worker pool
golang/example -> stdlib service -> api_service
learngo -> syntax drills -> reading fluency
```
