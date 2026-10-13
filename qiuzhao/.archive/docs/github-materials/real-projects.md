# Real Project Materials

这一组材料用于观察真实 Go 项目如何支撑长期演进。它们不是按教程写的，所以读法要克制：从入口、模块边界、一条请求链路、生命周期管理开始。

## pocketbase/pocketbase

Source: [pocketbase/pocketbase](https://github.com/pocketbase/pocketbase/tree/667a765070bc4554696acb1c96e8a484697008fd)

### 先读什么

- [`README.md`](https://github.com/pocketbase/pocketbase/blob/667a765070bc4554696acb1c96e8a484697008fd/README.md)：理解它既是独立应用，也是 Go toolkit。
- [`examples/base/main.go`](https://github.com/pocketbase/pocketbase/blob/667a765070bc4554696acb1c96e8a484697008fd/examples/base/main.go)：最小 standalone app。
- [`pocketbase.go`](https://github.com/pocketbase/pocketbase/blob/667a765070bc4554696acb1c96e8a484697008fd/pocketbase.go)：启动器和 CLI。
- [`apis/base.go`](https://github.com/pocketbase/pocketbase/blob/667a765070bc4554696acb1c96e8a484697008fd/apis/base.go)：默认 middleware 和 API route 注册。
- [`core/app.go`](https://github.com/pocketbase/pocketbase/blob/667a765070bc4554696acb1c96e8a484697008fd/core/app.go)：核心 App interface。

### 分段剖析

README 的核心信息是 PocketBase 的产品形态：一个 Go 后端把 SQLite、实时订阅、用户、文件、Admin UI、REST API 组合成单 binary。这对我们很重要，因为 AI gateway 也可以走“单 binary 起步，逐步模块化”的路径。

`examples/base/main.go` 展示了 PocketBase 的扩展方式：创建 app，注册插件和 hooks，然后 `Start`。它不是把用户扩展写死进 core，而是通过 hook 机制给开发者插入点。

`apis/base.go` 展示默认 router：先绑 middleware，再挂 `/api` group，再注册 settings、collection、record、auth、logs、backup、cron、file、realtime、health、SQL 等模块。这是大型 API 产品的典型“路由聚合点”。

`core/app.go` 的 App interface 很大。按 Google styleguide，小接口一般更好；但 PocketBase 的 App 本身就是产品级平台接口，提供 DB、settings、cron、filesystem、mail、backup、hooks、events。这属于“接口就是产品”的例外。

### 迁移到最终系统

- gateway 可以先做单 binary，不急着微服务化。
- hooks/plugins 适合 provider middleware、审计、成本统计。
- admin API 和业务 API 分组注册，避免路由散落。

## usememos/memos

Source: [usememos/memos](https://github.com/usememos/memos/tree/d1cef7a9ab23e8c93f76b2f32661c720c733536d)

### 先读什么

- [`README.md`](https://github.com/usememos/memos/blob/d1cef7a9ab23e8c93f76b2f32661c720c733536d/README.md)：理解产品定位和部署形态。
- [`cmd/memos/main.go`](https://github.com/usememos/memos/blob/d1cef7a9ab23e8c93f76b2f32661c720c733536d/cmd/memos/main.go)：CLI、配置、DB、server 生命周期。
- [`server/server.go`](https://github.com/usememos/memos/blob/d1cef7a9ab23e8c93f76b2f32661c720c733536d/server/server.go)：Echo server、路由注册、后台 runner、关闭流程。
- [`server/router/api/v1/memo_service.go`](https://github.com/usememos/memos/blob/d1cef7a9ab23e8c93f76b2f32661c720c733536d/server/router/api/v1/memo_service.go)：业务服务方法。

### 分段剖析

Memos 是产品型单 binary。`cmd/memos/main.go` 先收集 profile/config，然后创建 DB driver、store、server，最后处理 signal 和 graceful shutdown。这是一个很好的生产入口样本。

`server/server.go` 展示了一个产品服务的组合方式：middleware、healthz、frontend 静态文件、file server、RSS、gRPC gateway、MCP service、background runner。这个文件值得反复看，因为它把产品能力和服务生命周期摆在一起。

`memo_service.go` 的业务方法比教程代码复杂很多：鉴权、UID、内容长度、payload rebuild、附件、关系、webhook、SSE broadcast、通知都在一条创建链路里。读它的重点不是模仿所有细节，而是学习真实业务方法如何把多个副作用串起来，并且哪些副作用应该 best-effort。

### 迁移到最终系统

- agent runtime 的 event broadcast 可参考 SSE hub 思路。
- gateway 后台 runner 可用于 provider health check、pricing refresh、日志 flush。
- 创建 agent message 时，主路径和 best-effort 副作用要分开。

## caddyserver/caddy

Source: [caddyserver/caddy](https://github.com/caddyserver/caddy/tree/13a4c3f43c79ca04064457ab9cf95b376c294141)

### 先读什么

- [`README.md`](https://github.com/caddyserver/caddy/blob/13a4c3f43c79ca04064457ab9cf95b376c294141/README.md)：理解它是可扩展 server platform。
- [`cmd/caddy/main.go`](https://github.com/caddyserver/caddy/blob/13a4c3f43c79ca04064457ab9cf95b376c294141/cmd/caddy/main.go)：插件式入口。
- [`caddy.go`](https://github.com/caddyserver/caddy/blob/13a4c3f43c79ca04064457ab9cf95b376c294141/caddy.go)：Config、App、Load/Run。
- [`modules.go`](https://github.com/caddyserver/caddy/blob/13a4c3f43c79ca04064457ab9cf95b376c294141/modules.go)：模块注册和生命周期。
- [`admin.go`](https://github.com/caddyserver/caddy/blob/13a4c3f43c79ca04064457ab9cf95b376c294141/admin.go)：动态配置管理 API。

### 分段剖析

Caddy 的入口极小，真正能力通过 blank import 注册模块。这是 Go 插件式架构的一种经典形式：编译期决定包含哪些模块，运行期通过 config 加载模块。

`modules.go` 是必读。它定义 `Module`、`ModuleInfo`、`ModuleID` 和注册表。模块通常会经历创建、配置反序列化、Provision、Validate、Cleanup 等生命周期。这个生命周期对 AI gateway 的 provider/plugin 很有启发：provider 不只是一个函数，它可能需要配置、校验、连接池、关闭清理。

`caddy.go` 的 Config 使用 JSON raw message 加载 app modules。这个设计让核心不需要 import 所有模块类型。我们的 gateway 后续可以用更简单的版本：provider 配置按 type 分发给不同 provider factory。

### 迁移到最终系统

- provider/plugin 要有生命周期：load、validate、start、stop。
- admin API 可用于动态更新 provider、模型、限流策略。
- 配置驱动模块加载，比在 handler 里硬编码 provider 更可演进。

## syncthing/syncthing

Source: [syncthing/syncthing](https://github.com/syncthing/syncthing/tree/ef4629ea56021d0941017f30ec53be45d2836e24)

### 先读什么

- [`README.md`](https://github.com/syncthing/syncthing/blob/ef4629ea56021d0941017f30ec53be45d2836e24/README.md)：先读 Goals，理解价值排序。
- [`GOALS.md`](https://github.com/syncthing/syncthing/blob/ef4629ea56021d0941017f30ec53be45d2836e24/GOALS.md)：安全、数据不丢、自动化这些约束。
- [`cmd/syncthing/main.go`](https://github.com/syncthing/syncthing/blob/ef4629ea56021d0941017f30ec53be45d2836e24/cmd/syncthing/main.go)：复杂 CLI 和服务入口。
- [`lib/model/model.go`](https://github.com/syncthing/syncthing/blob/ef4629ea56021d0941017f30ec53be45d2836e24/lib/model/model.go)：核心 model interface 和状态。
- [`lib/protocol/protocol.go`](https://github.com/syncthing/syncthing/blob/ef4629ea56021d0941017f30ec53be45d2836e24/lib/protocol/protocol.go)：协议接口。

### 分段剖析

Syncthing 最值得先读的不是代码，而是目标排序。它把“避免数据丢失”和“安全”放在易用性之前。大业务系统也需要这种排序：AI gateway 如果目标是生产流量，正确的降级、超时、审计和额度控制要排在炫酷功能前。

`lib/model/model.go` 的接口和 struct 都很大，因为它是文件同步核心。这里不要照搬“大接口”，而要观察复杂系统会聚合哪些状态：配置、数据库、事件、连接、folder runner、limiter、错误、统计。

`lib/protocol/protocol.go` 展示网络协议边界：model 处理 index、request、cluster config、download progress；connection 负责发送这些消息。对 agent runtime 来说，这类似 event protocol：事件类型、连接、请求、响应必须清楚分层。

### 迁移到最终系统

- 先写目标排序：稳定、成本控制、可观测、扩展性、体验。
- Agent event protocol 要比 handler 细节更稳定。
- 高并发系统内部状态多，必须有清晰锁和生命周期边界。

## 本阶段输出

读完这组材料后，你应该能完成：

- 画出一个产品型 Go 服务启动流程。
- 设计一个 provider/plugin 生命周期。
- 设计一个 admin API 更新配置的最小版本。
- 写出最终系统的目标排序，而不是只写功能列表。

## Go 代码转译

这一节把真实项目里的“产品型系统经验”翻译成本地 gateway/agent 代码骨架。

### Single Binary With Hooks

来源：`pocketbase/examples/base/main.go` 和 hook/plugin 思路。

迁移到 gateway：单 binary 起步，但给 provider、audit、policy 留 hook。

```go
type Hook[T any] struct {
	handlers []func(context.Context, T) error
}

func (h *Hook[T]) Add(fn func(context.Context, T) error) {
	h.handlers = append(h.handlers, fn)
}

func (h Hook[T]) Run(ctx context.Context, value T) error {
	for _, fn := range h.handlers {
		if err := fn(ctx, value); err != nil {
			return err
		}
	}
	return nil
}

type GatewayHooks struct {
	BeforeProvider Hook[core.ChatRequest]
	AfterProvider  Hook[core.ChatResponse]
}
```

学习要点：

- hook 是扩展点，但不是所有地方都要开放。
- 插件失败是否阻断主流程，要按 hook 类型明确规定。
- 审计、成本统计、策略注入适合 hook；核心路由规则不应散成一堆 hook。

### Route Aggregation Point

来源：`pocketbase/apis/base.go` 和 `memos/server/server.go`。

大型 API 产品要有路由聚合点，不要让 route 注册散落到业务文件里。

```go
func RegisterRoutes(mux *http.ServeMux, gateway httpapi.Handler, admin AdminHandler, stream StreamHandler) {
	mux.HandleFunc("GET /healthz", gateway.Health)
	mux.HandleFunc("POST /v1/chat/completions", gateway.Chat)
	mux.HandleFunc("GET /v1/agent/sessions/{id}/events", stream.Events)
	mux.HandleFunc("PUT /admin/providers/{name}", admin.UpdateProvider)
}
```

学习要点：

- route 聚合点能让产品面一眼可见。
- admin API 和 public API 分组，权限策略也应分组。
- 以后接 OpenAPI 文档或权限扫描时，这个入口非常有价值。

### Background Runner With Shutdown

来源：`usememos/memos/cmd/memos/main.go` 和 `server/server.go`。

后台 runner 用于 provider health check、pricing refresh、audit flush。

```go
type Runner struct {
	name string
	run  func(context.Context) error
}

func (r Runner) Name() string { return r.name }

func (r Runner) Start(ctx context.Context) error {
	return r.run(ctx)
}

func (r Runner) Shutdown(ctx context.Context) error {
	return nil
}

func ProviderHealthRunner(registry *provider.Registry, interval time.Duration) lifecycle.Component {
	return Runner{
		name: "provider-health",
		run: func(ctx context.Context) error {
			ticker := time.NewTicker(interval)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-ticker.C:
					registry.RefreshHealth(ctx)
				}
			}
		},
	}
}
```

学习要点：

- 后台 goroutine 必须挂到生命周期系统。
- runner 要能被 context 停掉，不能永远跑。
- health check/pricing/audit flush 都不应该塞进 HTTP handler。

### Provider Module Lifecycle

来源：`caddy/modules.go` 和 `caddy.go`。

provider 不只是一个 HTTP client；它有配置、校验、启动和清理。

```go
type ProviderModule interface {
	ID() string
	Provision(ctx context.Context, cfg ProviderConfig) error
	Validate() error
	Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error)
	Cleanup(ctx context.Context) error
}

type ProviderConfig struct {
	Type     string
	BaseURL  string
	APIKey   string
	Timeout  time.Duration
	MaxConns int
}
```

模块注册表：

```go
type ProviderFactory func() ProviderModule

type ProviderModules struct {
	mu        sync.RWMutex
	factories map[string]ProviderFactory
}

func (m *ProviderModules) Register(kind string, factory ProviderFactory) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.factories[kind] = factory
}

func (m *ProviderModules) New(kind string) (ProviderModule, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	factory, ok := m.factories[kind]
	if !ok {
		return nil, false
	}
	return factory(), true
}
```

学习要点：

- 动态 provider 配置需要 validate，不能直接热加载进请求路径。
- cleanup 对连接池、stream、background goroutine 很重要。
- 注册表让 gateway core 不需要 import 每个 provider 的具体类型。

### Dynamic Config Swap

来源：Caddy admin API 的动态配置思路。

学习版做法：先构建新配置并验证，成功后原子替换。

```go
type RuntimeConfig struct {
	Providers map[string]ProviderConfig
	Policies  map[string]core.TenantPolicy
}

type ConfigStore struct {
	value atomic.Value
}

func NewConfigStore(cfg RuntimeConfig) *ConfigStore {
	store := &ConfigStore{}
	store.value.Store(cfg)
	return store
}

func (s *ConfigStore) Load() RuntimeConfig {
	return s.value.Load().(RuntimeConfig)
}

func (s *ConfigStore) Swap(next RuntimeConfig) error {
	if err := ValidateRuntimeConfig(next); err != nil {
		return err
	}
	s.value.Store(next)
	return nil
}
```

学习要点：

- 热更新要先验证再替换。
- 读取路径应快速、无锁或低锁。
- 配置版本、审计日志和回滚是下一步生产能力。

### Stable Event Protocol

来源：`syncthing/lib/protocol/protocol.go` 的协议边界意识。

agent runtime 需要稳定事件协议，而不是把 UI 字段直接当内部事实。

```go
type EventType string

const (
	UserMessage      EventType = "user_message"
	AssistantMessage EventType = "assistant_message"
	ToolStarted      EventType = "tool_started"
	ToolFinished     EventType = "tool_finished"
	ToolFailed       EventType = "tool_failed"
	RunInterrupted   EventType = "run_interrupted"
	RunCompleted     EventType = "run_completed"
)

type Event struct {
	ID         string
	SessionID  string
	Type       EventType
	NodeID     string
	ToolCallID string
	ToolName   string
	Content    string
	CreatedAt  time.Time
}
```

学习要点：

- Event 是系统事实，UI message 只是事实的一种展示。
- 新增事件类型要考虑 replay、审计、兼容旧客户端。
- 大系统里的协议稳定性比 handler 内部实现更重要。
