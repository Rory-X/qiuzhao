# Project Structure and Style Materials

这一组材料回答两个问题：

- Go 项目目录应该怎么长？
- 团队规模变大后，代码风格和边界怎么防止系统变乱？

它们对最终 AI gateway/agent 系统很关键，因为大业务系统不是靠“文件多”变清晰，而是靠边界稳定、命名一致、错误处理一致、可测试入口稳定。

## golang-standards/project-layout

Source: [golang-standards/project-layout](https://github.com/golang-standards/project-layout/tree/a9d6fae7015527b10550ebb6d6b71a71b1ef5ea7)

### 先读什么

- [`README.md`](https://github.com/golang-standards/project-layout/blob/a9d6fae7015527b10550ebb6d6b71a71b1ef5ea7/README.md)：先读 Overview，特别注意它声明自己不是 Go 官方标准。
- [`cmd/README.md`](https://github.com/golang-standards/project-layout/blob/a9d6fae7015527b10550ebb6d6b71a71b1ef5ea7/cmd/README.md)：入口目录。
- [`internal/README.md`](https://github.com/golang-standards/project-layout/blob/a9d6fae7015527b10550ebb6d6b71a71b1ef5ea7/internal/README.md)：Go 编译器强制的私有包边界。
- [`pkg/README.md`](https://github.com/golang-standards/project-layout/blob/a9d6fae7015527b10550ebb6d6b71a71b1ef5ea7/pkg/README.md)：可被外部复用的库。

### 分段剖析

README 的第一层价值是“目录名词典”。比如 `cmd` 放可执行程序入口，`internal` 放不想被外部 import 的代码，`api` 放 OpenAPI 或 proto 这类接口定义，`configs` 放配置模板。

第二层价值是它明确提醒：小项目照搬会过重。这个提醒比目录本身更重要。我们当前 `api_service` 只保留 `cmd` 和 `internal`，因为还没有外部复用库，也没有部署配置。

第三层价值是命名意图。目录不是装饰，而是承诺：放进 `pkg` 就意味着别人可以依赖；放进 `internal` 就意味着只服务本模块。AI gateway 到后期可以有 `internal/gateway/provider`、`internal/agent/runner`、`internal/platform/observability`，但不要一开始建空目录。

### 迁移到最终系统

- `cmd/gateway`：启动 HTTP gateway。
- `cmd/worker`：如果后续有异步任务 worker，再单独建。
- `internal/gateway`：provider routing、限流、auth。
- `internal/agent`：session、event、tool、graph。
- `internal/platform`：store、queue、observability。

## uber-go/guide

Source: [uber-go/guide](https://github.com/uber-go/guide/tree/1d60a91aa5e87d443002e23c21903c49489dbde5)

### 先读什么

- [`style.md`](https://github.com/uber-go/guide/blob/1d60a91aa5e87d443002e23c21903c49489dbde5/style.md)：总指南。
- [`src/error-wrap.md`](https://github.com/uber-go/guide/blob/1d60a91aa5e87d443002e23c21903c49489dbde5/src/error-wrap.md)：错误包装。
- [`src/channel-size.md`](https://github.com/uber-go/guide/blob/1d60a91aa5e87d443002e23c21903c49489dbde5/src/channel-size.md)：channel 缓冲。
- [`src/container-copy.md`](https://github.com/uber-go/guide/blob/1d60a91aa5e87d443002e23c21903c49489dbde5/src/container-copy.md)：slice/map 边界拷贝。

### 分段剖析

Uber guide 的重点不是格式化，`gofmt` 已经解决格式。它关心的是团队代码在并发、错误和 API 边界上是否容易踩坑。

错误包装章节尤其重要。大系统里错误会穿过很多层：HTTP handler、router、provider client、transport、telemetry。错误消息如果每层都写空泛前缀，会变成噪声；如果需要上层判断错误类型，就用 wrapping 保留 cause；如果不希望调用方依赖底层错误，就只保留文本。

channel 和容器边界也会直接影响 gateway。provider queue 的缓冲大小不是越大越好，map/slice 暴露给调用方时也不能让内部状态被外部修改。

### 迁移到最终系统

- 所有跨层错误都用明确上下文，比如 `provider openai: deadline exceeded`。
- 对外返回数据前拷贝 slice/map，避免共享可变状态。
- channel 缓冲只在有明确吞吐和背压设计时使用。
- 禁止 fire-and-forget goroutine，除非有生命周期和错误出口。

## google/styleguide Go

Source: [google/styleguide/go](https://github.com/google/styleguide/tree/1809c769de31ba388c755ad15dd057a9ba8531fd/go)

### 先读什么

- [`go/guide.md`](https://github.com/google/styleguide/blob/1809c769de31ba388c755ad15dd057a9ba8531fd/go/guide.md)：原则。
- [`go/best-practices.md`](https://github.com/google/styleguide/blob/1809c769de31ba388c755ad15dd057a9ba8531fd/go/best-practices.md)：接口、测试、包大小。
- [`go/decisions.md`](https://github.com/google/styleguide/blob/1809c769de31ba388c755ad15dd057a9ba8531fd/go/decisions.md)：具体取舍。

### 分段剖析

Google 的核心原则是清晰、简单、简洁、可维护、一致。对于大业务系统，最值得反复看的是接口章节：不要因为有 “service” 或 “repository” 这个概念就先定义大接口。Go 里的接口通常由使用方定义，而且越小越有力量。

这会影响我们设计 provider 和 agent runtime。比如 `ProviderClient` 不应该一开始包含聊天、embedding、image、audio、health、pricing、quota 所有方法。可以先为 chat routing 定义最小接口，后面按业务面扩展。

另一个关键点是注释解释 why，不重复 what。比如 Bifrost 的队列关闭注释之所以有价值，是因为它解释了为什么不关闭 hot path channel，而不是重复“这里有一个 channel”。

### 迁移到最终系统

- consumer-side interface：handler 需要什么，就在 handler 或 service 附近定义最小接口。
- 注释解释并发、可靠性和安全取舍。
- 小包优先，不用抽象层数证明架构感。

## sagikazarmark/modern-go-application

Source: [sagikazarmark/modern-go-application](https://github.com/sagikazarmark/modern-go-application/tree/468a20bc42f96ffebae693a51b006b263b4a497e)

### 先读什么

- [`README.md`](https://github.com/sagikazarmark/modern-go-application/blob/468a20bc42f96ffebae693a51b006b263b4a497e/README.md)：看它覆盖的生产能力。
- [`cmd/modern-go-application/main.go`](https://github.com/sagikazarmark/modern-go-application/blob/468a20bc42f96ffebae693a51b006b263b4a497e/cmd/modern-go-application/main.go)：看生产入口如何膨胀。
- [`internal/app/mga/app.go`](https://github.com/sagikazarmark/modern-go-application/blob/468a20bc42f96ffebae693a51b006b263b4a497e/internal/app/mga/app.go)：看 HTTP、gRPC、GraphQL、消息事件如何组装。

### 分段剖析

README 把现代 Go 应用拆成配置、日志、错误、metrics、tracing、health check、优雅重启、消息、数据库等能力。它不是初学模板，而是生产系统能力清单。

`cmd/modern-go-application/main.go` 非常长，原因不是业务复杂，而是入口负责配置、日志、健康检查、pprof、metrics、tracing、数据库、消息、HTTP、gRPC、graceful restart 等基础设施。读这个文件要学会识别“生产启动面”：哪些是业务，哪些是平台能力。

`internal/app/mga/app.go` 展示了一个应用如何组装多个 transport 和 middleware。它的价值是让你看到当一个系统同时支持 HTTP、gRPC、GraphQL、消息事件时，依赖组装会变成核心问题。

### 迁移到最终系统

- `gateway_lab` 后期要补 healthz、metrics、tracing、pprof、graceful shutdown。
- agent runtime 如果支持 HTTP + SSE + worker，就需要清晰的 app composition。
- 不要把 `main.go` 变成业务文件，入口只做配置和依赖装配。

## 本阶段输出

读完这组材料后，你应该能完成：

- 把 `api_service` 的目录解释清楚。
- 说出什么时候需要 `pkg`，什么时候不需要。
- 给 gateway 定义最小 provider interface。
- 写一条跨层错误处理规范。
- 设计 `cmd/gateway` 的启动职责边界。

## Go 代码转译

这一节把目录、风格和团队规范转成最终 Capstone 的代码约束。

### Small `cmd`, Real Composition In `internal/app`

来源：

- `golang-standards/project-layout/cmd`
- `sagikazarmark/modern-go-application/cmd/.../main.go`
- `caddyserver/caddy/cmd/caddy/main.go`

`cmd` 入口只处理进程级职责：日志、配置、构建 app、运行 app。不要把业务分发写进 `main.go`。

```go
func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	demo := app.BuildDemo()

	server := &http.Server{
		Addr:              ":8080",
		Handler:           demo.Handler,
		ReadHeaderTimeout: 5 * time.Second,
	}
	runtime := lifecycle.App{
		Components: []lifecycle.Component{
			lifecycle.NewHTTPServer("http", server),
		},
		ShutdownTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := runtime.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		logger.Error("gateway stopped", "err", err)
		os.Exit(1)
	}
}
```

学习要点：

- `cmd/gateway` 是进程入口，不是业务层。
- `internal/app` 是 composition root，负责把 policy、router、executor、telemetry 接起来。
- 多个二进制入口可以共享 `internal/app` 的构建函数。

### `internal` As A Compile-Time Boundary

来源：`golang-standards/project-layout/internal`。

最终 gateway/agent 的私有包边界：

```text
internal/gateway/core        business usecase and typed errors
internal/gateway/policy      tenant policy and token budget
internal/gateway/router      provider route planning
internal/gateway/provider    provider clients, registry, queue, breaker
internal/gateway/fallback    attempt loop, retry budget, audit
internal/agent/event         append/list/replay history
internal/agent/runner        model command loop
internal/agent/tool          tool registry and adapters
internal/platform/lifecycle  process component lifecycle
internal/platform/telemetry  metrics/traces/log sinks
```

学习要点：

- `internal` 不是装饰，它会被 Go 编译器强制。
- 业务系统先别急着建 `pkg`，除非你真的承诺给其他 module import。
- 包名应该描述能力边界，而不是技术分层口号。

### Consumer-Side Interface

来源：

- `google/styleguide/go/best-practices.md`
- `uber-go/guide` 的小接口和依赖边界思想。

错误示例：provider 接口过大。

```go
type BadProvider interface {
	Chat(context.Context, ChatRequest) (ChatResponse, error)
	Embedding(context.Context, EmbeddingRequest) (EmbeddingResponse, error)
	Image(context.Context, ImageRequest) (ImageResponse, error)
	Health(context.Context) error
	Pricing(context.Context) Pricing
}
```

推荐写法：调用方需要什么就定义什么。

```go
type ChatClient interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type HealthView interface {
	Healthy(name ProviderName) bool
}

type AuditSink interface {
	Record(ctx context.Context, log RequestLog) error
}
```

学习要点：

- 小接口让 fake 更容易写，测试也更聚焦。
- 能力不同的 provider 不必实现一堆空方法。
- 未来扩展 embedding/image/audio 时，为各自链路单独建接口。

### Error Wrapping And Error Class

来源：`uber-go/guide/src/error-wrap.md`。

大系统错误要同时满足两个目标：人能读，机器能分类。

```go
type ErrorClass string

const (
	ErrorTimeout             ErrorClass = "timeout"
	ErrorOverloaded          ErrorClass = "overloaded"
	ErrorProviderUnavailable ErrorClass = "provider_unavailable"
	ErrorQuotaExceeded       ErrorClass = "quota_exceeded"
)

type GatewayError struct {
	Class ErrorClass
	Route Route
	Err   error
}

func (e GatewayError) Error() string {
	if e.Route.Provider == "" {
		return e.Err.Error()
	}
	return fmt.Sprintf("%s/%s: %v", e.Route.Provider, e.Route.Model, e.Err)
}

func (e GatewayError) Unwrap() error {
	return e.Err
}
```

调用方用分类做决策：

```go
func CanFallback(err error) bool {
	switch ErrorClassOf(err) {
	case ErrorTimeout, ErrorOverloaded, ErrorProviderUnavailable:
		return true
	default:
		return false
	}
}
```

学习要点：

- `Error()` 给人读，`ErrorClass` 给路由、HTTP status、metrics label 使用。
- 需要保留底层错误时实现 `Unwrap`。
- 不要让上层通过字符串 contains 判断错误类型。

### Copy Slices And Maps At Boundaries

来源：`uber-go/guide/src/container-copy.md`。

provider registry、event store、policy store 都会持有内部 slice/map。返回给调用方前要拷贝，防止外部修改内部状态。

```go
type EventStore struct {
	mu     sync.RWMutex
	events map[string][]Event
}

func (s *EventStore) List(ctx context.Context, sessionID string) ([]Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	copied := make([]Event, len(s.events[sessionID]))
	copy(copied, s.events[sessionID])
	return copied, nil
}
```

map 也一样：

```go
func CopyLabels(in map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}
```

学习要点：

- slice header 拷贝不等于底层数组拷贝。
- map 是引用语义，直接返回就等于暴露内部状态。
- 大系统里这类小疏忽会变成非常难查的并发 bug。

### App Builder Owns Wiring

来源：`modern-go-application/internal/app/...`。

Capstone 学习版 composition root：

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

	return Demo{Handler: mux, Service: service, Telemetry: telemetrySink, Audit: auditLog}
}
```

学习要点：

- wiring 集中，业务包保持纯净。
- fake provider 和 memory sink 让 E2E 测试稳定。
- 生产版可以在同一个形状下替换为真实 provider、Redis limiter、OTel exporter。
