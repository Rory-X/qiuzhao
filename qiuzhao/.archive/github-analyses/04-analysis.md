# 04 GitHub Project Analysis: Real Projects

Verified: 2026-07-06.

本阶段看真实项目如何长期演进。读法要克制：先找入口、生命周期、模块边界和一条关键链路，不要从最大文件开始。

## Source Snapshot

| Project | HEAD | Read anchors |
|---|---:|---|
| [pocketbase/pocketbase](https://github.com/pocketbase/pocketbase/tree/667a765070bc4554696acb1c96e8a484697008fd) | `667a765` | `examples/base/main.go`, `pocketbase.go`, `apis/base.go`, `core/app.go` |
| [usememos/memos](https://github.com/usememos/memos/tree/d1cef7a9ab23e8c93f76b2f32661c720c733536d) | `d1cef7a` | `cmd/memos/main.go`, `server/server.go`, `server/router/api/v1/memo_service.go` |
| [caddyserver/caddy](https://github.com/caddyserver/caddy/tree/13a4c3f43c79ca04064457ab9cf95b376c294141) | `13a4c3f` | `cmd/caddy/main.go`, `caddy.go`, `modules.go`, `admin.go` |
| [syncthing/syncthing](https://github.com/syncthing/syncthing/tree/ef4629ea56021d0941017f30ec53be45d2836e24) | `ef4629e` | `GOALS.md`, `cmd/syncthing/main.go`, `lib/model/model.go`, `lib/protocol/protocol.go` |

## Key Code Blocks

这些代码块把真实产品的结构翻译成你后续要写的 gateway/agent 形状。

### Single Binary With Hooks

PocketBase 的启发：核心产品稳定，扩展点通过 hook/plugin 进入。

```go
type App struct {
	router *http.ServeMux
	hooks  []func(*RequestContext) error
}

func (a *App) OnRequest(fn func(*RequestContext) error) {
	a.hooks = append(a.hooks, fn)
}

func (a *App) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := &RequestContext{Request: r, Writer: w}
	for _, hook := range a.hooks {
		if err := hook(ctx); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}
	a.router.ServeHTTP(w, r)
}
```

### Product Server Lifecycle

Memos 的启发：server 不是只有 HTTP，还会带后台 runner 和关闭流程。

```go
type Server struct {
	httpServer *http.Server
	runners    []Runner
}

func (s *Server) Start(ctx context.Context) error {
	group, ctx := errgroup.WithContext(ctx)
	group.Go(func() error { return s.httpServer.ListenAndServe() })
	for _, runner := range s.runners {
		r := runner
		group.Go(func() error { return r.Run(ctx) })
	}
	return group.Wait()
}
```

### Main Path And Best-Effort Side Effects

真实业务方法常常有主路径和副作用，agent message 也一样。

```go
func (svc *MessageService) Create(ctx context.Context, input CreateMessage) (Message, error) {
	msg, err := svc.store.CreateMessage(ctx, input)
	if err != nil {
		return Message{}, err
	}

	// Best effort: do not fail the main write just because broadcast failed.
	if err := svc.events.Publish(ctx, MessageCreated{MessageID: msg.ID}); err != nil {
		svc.logger.Warn("publish message event", "err", err)
	}
	return msg, nil
}
```

### Caddy-Style Module Lifecycle

Caddy 的启发：provider/plugin 要有配置、校验、启动、清理。

```go
type Module interface {
	ID() string
	Provision(ctx context.Context) error
	Validate() error
	Cleanup() error
}

type ProviderModule struct {
	Name string
	Key  string
}

func (m *ProviderModule) Validate() error {
	if m.Name == "" || m.Key == "" {
		return ErrInvalidProviderConfig
	}
	return nil
}
```

### Protocol Boundary

Syncthing 的启发：协议层要稳定，handler 细节可以变。

```go
type AgentEvent struct {
	ID        string
	SessionID string
	Type      EventType
	Payload   json.RawMessage
}

type EventProtocol interface {
	Send(ctx context.Context, event AgentEvent) error
	Receive(ctx context.Context) (AgentEvent, error)
}
```

## pocketbase/pocketbase

**它解决什么问题**：PocketBase 是单 binary 后端产品，把 SQLite、用户、文件、Admin UI、REST、Realtime 组合起来，同时也是 Go toolkit。

**关键段落/代码剖析**：

- `examples/base/main.go`：最小 app 通常是创建 app、注册 hook/plugin、启动。它展示“产品核心 + 用户扩展点”的形状。
- `pocketbase.go`：核心 app 启动器和 CLI 入口，说明产品型 Go 服务可以从单 binary 起步。
- `apis/base.go`：默认 middleware 和 API route 聚合点，适合学习大型 REST 产品如何集中注册模块。
- `core/app.go`：App interface 很大，这是“平台接口”的例外，不应机械套用“小接口原则”。

**迁移到 AI gateway/agent**：

- 网关可以先做单 binary，后续再拆 worker 或控制面。
- Hook/plugin 机制适合 provider middleware、审计、成本统计。
- Admin API 和业务 API 应该分组注册。

**本地练习**：为未来 gateway 设计 `OnProviderResponse` hook，只记录接口，不实现插件系统。

Backlinks: [AI Gateway](../docs/knowledge-handbook/concepts/ai-gateway.md), [Architecture Boundaries](../docs/knowledge-handbook/concepts/architecture-boundaries.md)

## usememos/memos

**它解决什么问题**：Memos 是产品型 Go 后端 + 前端，适合观察一个真实应用如何组合 CLI、DB、server、API、静态资源、后台任务。

**关键段落/代码剖析**：

- `cmd/memos/main.go`：读取 profile/config，创建 DB/store/server，处理 signal 和 graceful shutdown。
- `server/server.go`：组合 middleware、healthz、frontend、file server、RSS、gRPC gateway、MCP、background runner。
- `server/router/api/v1/memo_service.go`：创建 memo 的业务链路包含鉴权、内容处理、附件、关系、webhook、广播、通知等副作用。

**迁移到 AI gateway/agent**：

- Agent message 创建也会有主路径和副作用：持久化消息是主路径，通知/SSE/webhook 可以 best-effort。
- SSE/event broadcast 可参考它的产品形态，但要为 agent event 增加事件 ID 和重放。
- 后台 runner 可用于 provider health check、price refresh、日志 flush。

**本地练习**：给 `architecture_labs/agent` 设计一个 `EventSink` 接口，区分主存储和 best-effort broadcast。

Backlinks: [Agent Runtime](../docs/knowledge-handbook/concepts/agent-runtime.md), [Durable Workflow](../docs/knowledge-handbook/concepts/durable-workflow.md)

## caddyserver/caddy

**它解决什么问题**：Caddy 是可扩展 server platform，适合学习模块注册、动态配置、生命周期和 admin API。

**关键段落/代码剖析**：

- `cmd/caddy/main.go`：入口很小，能力通过模块注册进入。
- `modules.go`：模块注册表、ModuleID、ModuleInfo 和生命周期是核心。
- `caddy.go`：Config/App/Load/Run 说明配置驱动的模块加载。
- `admin.go`：动态配置 API，适合学习控制面如何安全更新运行中服务。

**迁移到 AI gateway/agent**：

- Provider 不只是函数，还需要 lifecycle：load、validate、start、stop。
- 路由策略、provider 配置、限流策略未来可通过 admin API 更新。
- 编译期模块和运行期配置要分清。
- 本地 capstone 已落地两个 Caddy-style proof：`TestConfigSwapRejectsUnknownProviderInTenantPolicy` 证明热配置先整体验证再替换，`TestGracefulDrainStopsIngressBeforeWorkers` 证明 lifecycle 反向 shutdown 可以先停 ingress 再 drain worker。

**本地练习**：为 `architecture_labs/gateway` 设计 `ProviderFactory` 和 `Validate()`，不用马上实现动态加载。

Backlinks: [AI Gateway](../docs/knowledge-handbook/concepts/ai-gateway.md), [Architecture Boundaries](../docs/knowledge-handbook/concepts/architecture-boundaries.md)

## syncthing/syncthing

**它解决什么问题**：Syncthing 是长期运行、重安全和数据一致性的文件同步系统，适合进阶看目标排序、协议和复杂状态。

**关键段落/代码剖析**：

- `GOALS.md`：先读目标排序。它把安全和不丢数据放在易用性之前。大业务系统也需要这种价值排序。
- `cmd/syncthing/main.go`：复杂 CLI 和服务入口，体现长期运行服务的启动面。
- `lib/model/model.go`：核心 model 聚合配置、数据库、事件、连接、runner、limiter、错误和统计。
- `lib/protocol/protocol.go`：协议边界清楚区分消息、请求、响应和连接行为。

**迁移到 AI gateway/agent**：

- Agent event protocol 应该比 handler 细节更稳定。
- 高并发系统内部状态多，必须有锁、生命周期和错误边界。
- 先写目标排序：稳定、成本、可观测、扩展性、体验。

**本地练习**：为最终系统补一份目标排序，明确“不能丢 session event”和“不能无限重试 provider”优先级。

Backlinks: [Durable Workflow](../docs/knowledge-handbook/concepts/durable-workflow.md), [Concurrency And Backpressure](../docs/knowledge-handbook/concepts/concurrency-backpressure.md)

## 本阶段知识网

```text
PocketBase -> single binary + hooks + admin/realtime
Memos -> product server lifecycle + SSE + side effects
Caddy -> module registry + dynamic config lifecycle
Syncthing -> safety goals + protocol boundary + long-running state
```
