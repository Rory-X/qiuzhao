# 03 GitHub Project Analysis: Architecture Patterns

Verified: 2026-07-06.

本阶段要读懂业务结构：请求如何进入系统、业务规则放在哪里、状态如何保护、存储如何隔离、跨 transport 如何复用同一套用例。

## Source Snapshot

| Project | HEAD | Read anchors |
|---|---:|---|
| [ThreeDotsLabs/wild-workouts-go-ddd-example](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example/tree/f264c714c5d643bf207d72335f02d3be858d9a84) | `f264c71` | `internal/trainer/domain/hour/hour.go`, `repository.go`, `app/command/schedule_training.go`, `ports/http.go` |
| [amitshekhariitbhu/go-backend-clean-architecture](https://github.com/amitshekhariitbhu/go-backend-clean-architecture/tree/8a8bf00d4936b325baed89ceb631faae3122d1b5) | `8a8bf00` | `domain/task.go`, `usecase/task_usecase.go`, `repository/task_repository.go`, `api/controller/task_controller.go` |
| [evrone/go-clean-template](https://github.com/evrone/go-clean-template/tree/caa9e35d8ed7c438070954f3355973be9e6ae313) | `caa9e35` | `internal/entity/task.go`, `internal/usecase/task/task.go`, `internal/controller/restapi/v1/task.go`, `internal/repo/persistent/task_postgres.go` |
| [go-kit/examples](https://github.com/go-kit/examples/tree/e18c82edc2f9c7de3aff9748751d63270c052c1b) | `e18c82e` | `addsvc/pkg/addservice/service.go`, `addendpoint/set.go`, `addtransport/http.go` |

## Key Code Blocks

这些代码块把 DDD、Clean Architecture、go-kit endpoint 翻译成后续 AI gateway/agent 可用的结构。

### Domain Object Protects Invariants

Wild Workouts 的重点：领域对象不是裸数据。

```go
type Session struct {
	id     string
	status SessionStatus
	events []Event
}

func (s *Session) StartToolCall(id string, name string) error {
	if s.status == SessionClosed {
		return ErrSessionClosed
	}
	s.events = append(s.events, Event{
		Type:       EventToolCallStarted,
		ToolCallID: id,
		ToolName:   name,
	})
	return nil
}
```

### Repository Update Closure

读改写流程集中在 repository，可以减少并发更新分散到业务层。

```go
type SessionRepository interface {
	Update(ctx context.Context, id string, fn func(*Session) error) error
}

func (h StartToolHandler) Handle(ctx context.Context, cmd StartToolCommand) error {
	return h.sessions.Update(ctx, cmd.SessionID, func(s *Session) error {
		return s.StartToolCall(cmd.ToolCallID, cmd.ToolName)
	})
}
```

### Clean Usecase With Timeout

Clean Architecture 模板里的 context timeout 直接迁移到 provider 调用。

```go
type GatewayUsecase struct {
	timeout time.Duration
	router  Router
}

func (u GatewayUsecase) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, u.timeout)
	defer cancel()

	provider, err := u.router.Select(req.PreferredProvider)
	if err != nil {
		return ChatResponse{}, err
	}
	return provider.Chat(ctx, req)
}
```

### Entity State Machine

Evrone 模板的状态转移思想适合 tool call。

```go
type ToolCallStatus string

const (
	ToolPending   ToolCallStatus = "pending"
	ToolRunning   ToolCallStatus = "running"
	ToolSucceeded ToolCallStatus = "succeeded"
	ToolFailed    ToolCallStatus = "failed"
)

func (c *ToolCall) Transition(next ToolCallStatus) error {
	if c.Status == ToolSucceeded || c.Status == ToolFailed {
		return ErrTerminalState
	}
	c.Status = next
	return nil
}
```

### Go-Kit Endpoint Shape

service/endpoint/transport 适合把限流、trace、熔断挂在 provider 调用外层。

```go
type Endpoint func(ctx context.Context, request any) (response any, err error)

func MakeChatEndpoint(svc ChatService) Endpoint {
	return func(ctx context.Context, request any) (any, error) {
		req := request.(ChatRequest)
		return svc.Chat(ctx, req)
	}
}

func WithTracing(next Endpoint) Endpoint {
	return func(ctx context.Context, request any) (any, error) {
		ctx, span := tracer.Start(ctx, "gateway.chat")
		defer span.End()
		return next(ctx, request)
	}
}
```

## ThreeDotsLabs/wild-workouts-go-ddd-example

**它解决什么问题**：用一个业务项目逐步重构出 DDD Lite、Clean Architecture、Repository、CQRS，比直接看模板更容易理解“为什么拆”。

**关键段落/代码剖析**：

- `internal/trainer/domain/hour/hour.go`：领域对象保护不变量，不是裸 struct。状态变化通过方法进入。
- `internal/trainer/domain/hour/repository.go`：repository interface 放在 domain 附近，表达业务需要什么，而不是数据库如何做。
- `internal/trainer/app/command/schedule_training.go`：command handler 接收命令、调用 repository、执行领域逻辑，不关心 HTTP。
- `internal/trainer/ports/http.go`：HTTP port 把外部请求翻译成 command/query。

**迁移到 AI gateway/agent**：

- Agent session 的状态变化应像领域对象一样集中：`AppendUserMessage`、`StartToolCall`、`FinishToolCall`。
- Provider route policy 可以是领域规则，不应散落在 HTTP handler。
- Command/query 分离适合 agent：发送消息是 command，读取 timeline 是 query。

**本地练习**：把 `architecture_labs/agent.Session` 增加非法状态测试，例如 tool call 未开始就 finish 应返回错误。

Backlinks: [Agent Runtime](../docs/knowledge-handbook/concepts/agent-runtime.md), [Architecture Boundaries](../docs/knowledge-handbook/concepts/architecture-boundaries.md)

## amitshekhariitbhu/go-backend-clean-architecture

**它解决什么问题**：模板化展示 Router、Controller、Usecase、Repository、Domain 的后端 API 分层。

**关键段落/代码剖析**：

- `domain/task.go` 同时定义实体和接口，便于模板学习，但真实项目里接口应由消费者定义还是 domain 定义，需要按使用关系判断。
- `usecase/task_usecase.go` 为业务操作创建带 timeout 的 context。这对 provider 调用尤其重要。
- `repository/task_repository.go` 隐藏 Mongo 细节，业务层只面对 repository contract。
- `api/controller/task_controller.go` 做 HTTP binding、用户 ID、参数校验，不应该承载业务规则。

**迁移到 AI gateway/agent**：

```text
HTTP controller -> GatewayUsecase -> ProviderRepository/Client
HTTP controller -> AgentUsecase -> SessionRepository/EventStore
```

**本地练习**：在 `api_service` 中给 service 层增加 context 参数，练习从 handler 传递 request context。

Backlinks: [Architecture Boundaries](../docs/knowledge-handbook/concepts/architecture-boundaries.md), [AI Gateway](../docs/knowledge-handbook/concepts/ai-gateway.md)

## evrone/go-clean-template

**它解决什么问题**：更接近生产的 Clean Architecture 模板，覆盖 REST、gRPC、消息/RPC、Postgres 等多个 transport。

**关键段落/代码剖析**：

- `internal/entity/task.go` 把任务状态转移放在 entity 上，说明状态机应集中定义。
- `internal/usecase/task/task.go` 承载应用用例，不知道具体 transport。
- `internal/controller/restapi/v1/task.go` 是 REST adapter。
- `internal/repo/persistent/task_postgres.go` 是持久化 adapter。

**迁移到 AI gateway/agent**：

- Agent tool call 状态机应集中：pending、running、completed、failed、cancelled。
- 同一套 agent usecase 未来可以被 HTTP、SSE、worker、CLI、MCP 复用。
- Repository 负责 session/request log/quota store 的持久化细节。

**本地练习**：给 `architecture_labs/notification` 的通知投递增加状态字段和合法转移。

Backlinks: [Agent Runtime](../docs/knowledge-handbook/concepts/agent-runtime.md), [Durable Workflow](../docs/knowledge-handbook/concepts/durable-workflow.md)

## go-kit/examples

**它解决什么问题**：展示微服务常见的 service、endpoint、transport 拆分。这个拆法非常适合网关中间件。

**关键段落/代码剖析**：

- `addsvc/pkg/addservice/service.go`：业务能力是普通 Go interface/struct。
- `addsvc/pkg/addendpoint/set.go`：endpoint 把业务方法包装成统一调用单元，并在 endpoint 外层组合 rate limit、circuit breaker、trace、logging、metrics。
- `addsvc/pkg/addtransport/http.go`：transport 只做协议编解码。

**迁移到 AI gateway/agent**：

```text
transport: OpenAI-compatible HTTP JSON/SSE
endpoint: rate limit, circuit breaker, tracing, retry budget
service: provider chat/embedding call
```

**本地 proof**：Capstone 已加入 [`../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint.go`](../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint.go)，`TestEndpointMiddlewareWrapsServiceBoundary` 证明 middleware 包裹顺序，`TestEndpointMiddlewareCanShortCircuitBeforeProviderCall` 证明鉴权/限流类 middleware 可以在 provider 调用前短路。

Backlinks: [AI Gateway](../docs/knowledge-handbook/concepts/ai-gateway.md), [Observability](../docs/knowledge-handbook/concepts/observability.md)

## 本阶段知识网

```text
Wild Workouts -> domain + command + repository
Clean Architecture template -> controller/usecase/repository
Evrone template -> multi transport + state machine
go-kit -> service/endpoint/transport middleware
```
