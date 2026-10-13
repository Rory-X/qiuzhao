# Architecture Pattern Materials

这一组材料用来学习业务结构：请求如何进入系统，业务规则放在哪里，存储如何隔离，查询和命令是否分离，跨服务通信怎么组织。

对最终 AI gateway/agent runtime 来说，这一层是骨架。没有稳定骨架，高并发和可观测只会让混乱变得更快、更清楚。

## ThreeDotsLabs/wild-workouts-go-ddd-example

Source: [ThreeDotsLabs/wild-workouts-go-ddd-example](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example/tree/f264c714c5d643bf207d72335f02d3be858d9a84)

### 先读什么

- [`README.md`](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example/blob/f264c714c5d643bf207d72335f02d3be858d9a84/README.md)：按文章顺序理解它是重构系列。
- [`internal/trainer/domain/hour/hour.go`](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example/blob/f264c714c5d643bf207d72335f02d3be858d9a84/internal/trainer/domain/hour/hour.go)：领域对象如何保护不变量。
- [`internal/trainer/domain/hour/repository.go`](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example/blob/f264c714c5d643bf207d72335f02d3be858d9a84/internal/trainer/domain/hour/repository.go)：仓储接口。
- [`internal/trainer/app/command/schedule_training.go`](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example/blob/f264c714c5d643bf207d72335f02d3be858d9a84/internal/trainer/app/command/schedule_training.go)：命令 handler。
- [`internal/trainer/ports/http.go`](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example/blob/f264c714c5d643bf207d72335f02d3be858d9a84/internal/trainer/ports/http.go)：HTTP port。

### 分段剖析

README 的价值是文章路线：它不是直接说“DDD 应该这样写”，而是从一个应用逐步重构到 DDD Lite、Repository、Clean Architecture、CQRS。这比模板更适合学习，因为你能看到为什么要拆。

`Hour` 领域对象把时间合法性、可用状态和业务错误放在 domain 内部。它不是一个裸 struct，而是通过 factory 和方法保护状态。这个思想可以迁移到 agent session：session 状态变更不能散落在 handler 里，而应通过领域方法或 usecase 统一控制。

`Repository.UpdateHour(ctx, hourTime, updateFn)` 是一个很值得读的接口。它把“读取当前聚合、执行业务变更、保存”包成一次操作，减少并发更新时业务层到处写读改写流程。

`schedule_training.go` 展示 command handler：输入是命令，依赖是 repository，输出是错误。它不关心 HTTP，也不关心数据库细节。HTTP port 只是把请求转成 command/query。

### 迁移到最终系统

- `ProviderRoute` 可以像 domain 对象一样保护路由规则。
- `Session` 状态变更用方法控制，例如 `AppendUserMessage`、`StartToolCall`、`CompleteToolCall`。
- command/query 分离适合 agent runtime：发送消息是 command，读取 session timeline 是 query。

## amitshekhariitbhu/go-backend-clean-architecture

Source: [amitshekhariitbhu/go-backend-clean-architecture](https://github.com/amitshekhariitbhu/go-backend-clean-architecture/tree/8a8bf00d4936b325baed89ceb631faae3122d1b5)

### 先读什么

- [`README.md`](https://github.com/amitshekhariitbhu/go-backend-clean-architecture/blob/8a8bf00d4936b325baed89ceb631faae3122d1b5/README.md)：看 Router、Controller、Usecase、Repository、Domain 五层。
- [`domain/task.go`](https://github.com/amitshekhariitbhu/go-backend-clean-architecture/blob/8a8bf00d4936b325baed89ceb631faae3122d1b5/domain/task.go)：domain 同时定义实体和接口。
- [`usecase/task_usecase.go`](https://github.com/amitshekhariitbhu/go-backend-clean-architecture/blob/8a8bf00d4936b325baed89ceb631faae3122d1b5/usecase/task_usecase.go)：usecase 加 context timeout。
- [`repository/task_repository.go`](https://github.com/amitshekhariitbhu/go-backend-clean-architecture/blob/8a8bf00d4936b325baed89ceb631faae3122d1b5/repository/task_repository.go)：Mongo repository。
- [`api/controller/task_controller.go`](https://github.com/amitshekhariitbhu/go-backend-clean-architecture/blob/8a8bf00d4936b325baed89ceb631faae3122d1b5/api/controller/task_controller.go)：Gin controller。

### 分段剖析

这个项目是模板型 Clean Architecture。它的请求链路很直观：route 调 controller，controller 解析请求和用户 ID，usecase 施加 timeout 并调用 repository，repository 访问 Mongo。

`domain/task.go` 里把 `TaskRepository` 和 `TaskUsecase` 接口放在 domain 包，这种风格适合模板学习，但不是唯一答案。结合 Google styleguide 看，接口是否放 domain，要看谁消费它、是否真的需要替换实现。

`task_usecase.go` 的亮点是每个业务操作都创建带 timeout 的 context。这对 AI gateway 很重要：provider 请求必须有截止时间，否则慢 provider 会拖垮整个请求池。

### 迁移到最终系统

- `GatewayUsecase` 可以控制超时、fallback 和错误分类。
- provider repository 不应暴露数据库驱动细节。
- controller 只做 HTTP binding，不做 provider 选择。

## evrone/go-clean-template

Source: [evrone/go-clean-template](https://github.com/evrone/go-clean-template/tree/caa9e35d8ed7c438070954f3355973be9e6ae313)

### 先读什么

- [`README.md`](https://github.com/evrone/go-clean-template/blob/caa9e35d8ed7c438070954f3355973be9e6ae313/README.md)：看它支持 REST、gRPC、AMQP RPC、NATS RPC。
- [`internal/entity/task.go`](https://github.com/evrone/go-clean-template/blob/caa9e35d8ed7c438070954f3355973be9e6ae313/internal/entity/task.go)：任务状态机。
- [`internal/usecase/task/task.go`](https://github.com/evrone/go-clean-template/blob/caa9e35d8ed7c438070954f3355973be9e6ae313/internal/usecase/task/task.go)：usecase。
- [`internal/controller/restapi/v1/task.go`](https://github.com/evrone/go-clean-template/blob/caa9e35d8ed7c438070954f3355973be9e6ae313/internal/controller/restapi/v1/task.go)：REST controller。
- [`internal/repo/persistent/task_postgres.go`](https://github.com/evrone/go-clean-template/blob/caa9e35d8ed7c438070954f3355973be9e6ae313/internal/repo/persistent/task_postgres.go)：Postgres repository。

### 分段剖析

这个项目比上一份模板更接近多 transport 业务系统。一个任务领域同时暴露 REST、gRPC、AMQP RPC、NATS RPC。这个结构对最终系统非常有参考意义：agent runtime 可能同时需要 HTTP、SSE、CLI、worker、MCP 工具接口。

`entity/task.go` 的 `Transition` 方法是关键：状态机放在实体上，而不是散落在 controller 或 repository。对 agent 来说，tool call 状态也应如此：pending、running、completed、failed、cancelled 这些转移应该集中定义。

`task_postgres.go` 用查询构造器隔离 SQL，且在 `GetByID` 中检查 userID 所有权。这提醒我们：authorization 不一定只在 middleware，数据层也可以做最后防线。

### 迁移到最终系统

- 多 transport：HTTP gateway、agent SSE、admin API 可以共享 usecase。
- 状态机：session、tool call、workflow run 都要集中管理状态转移。
- repository：请求日志、session store、quota store 可按领域拆分。

## go-kit/examples

Source: [go-kit/examples](https://github.com/go-kit/examples/tree/e18c82edc2f9c7de3aff9748751d63270c052c1b)

### 先读什么

- [`README.md`](https://github.com/go-kit/examples/blob/e18c82edc2f9c7de3aff9748751d63270c052c1b/README.md)：确认这是 go-kit 示例集合。
- [`addsvc/pkg/addservice/service.go`](https://github.com/go-kit/examples/blob/e18c82edc2f9c7de3aff9748751d63270c052c1b/addsvc/pkg/addservice/service.go)：service 层。
- [`addsvc/pkg/addendpoint/set.go`](https://github.com/go-kit/examples/blob/e18c82edc2f9c7de3aff9748751d63270c052c1b/addsvc/pkg/addendpoint/set.go)：endpoint 层。
- [`addsvc/pkg/addtransport/http.go`](https://github.com/go-kit/examples/blob/e18c82edc2f9c7de3aff9748751d63270c052c1b/addsvc/pkg/addtransport/http.go)：HTTP transport。

### 分段剖析

go-kit 的核心拆法是 service、endpoint、transport。service 表达业务能力；endpoint 把业务方法包装成统一调用单元，并叠加限流、熔断、trace、metrics；transport 负责协议编解码。

这对 AI gateway 很直接：provider 调用可以先是 service 方法，随后变成 endpoint，endpoint 上叠加 rate limit、circuit breaker、tracing、logging。HTTP transport 只是其中一种入口。

`Set` 把多个 endpoint 聚合在一起，这是客户端库和服务端都能复用的形状。后续我们可以为 `ChatCompletionEndpoint`、`EmbeddingEndpoint`、`ToolExecutionEndpoint` 建类似集合。

### 迁移到最终系统

- `provider.Service`：执行模型调用。
- `gateway.Endpoint`：叠加限流、熔断、trace。
- `httpapi.Transport`：OpenAI-compatible JSON 编解码。
- `agent.Endpoint`：把 agent run、tool execution、session query 统一包装。

## 本阶段输出

读完这组材料后，你应该能画出三条链路：

- CRUD API：HTTP -> Controller -> Usecase -> Repository。
- DDD command：HTTP Port -> Command Handler -> Domain -> Repository。
- Gateway endpoint：Transport -> Endpoint Middleware -> Service -> Provider。

## Go 代码转译

这一节把 DDD、Clean Architecture 和 go-kit 的关键形状翻译成 AI gateway/agent runtime 能直接复用的 Go 代码。

### Domain Object Protects Session State

来源：`ThreeDotsLabs/wild-workouts-go-ddd-example/internal/trainer/domain/hour/hour.go`。

迁移到 agent：session 不是裸 `[]Event`，而是通过方法追加合法事件。

```go
type Session struct {
	id     string
	events []Event
}

func NewSession(id string) *Session {
	return &Session{id: id}
}

func (s *Session) AddUserMessage(content string) {
	s.events = append(s.events, Event{
		Type:    EventUserMessage,
		Content: content,
	})
}

func (s *Session) StartToolCall(id string, name string) {
	s.events = append(s.events, Event{
		Type:       EventToolCallStarted,
		ToolCallID: id,
		ToolName:   name,
	})
}

func (s *Session) FinishToolCall(id string, result string) {
	s.events = append(s.events, Event{
		Type:       EventToolCallFinished,
		ToolCallID: id,
		Content:    result,
	})
}

func (s *Session) Events() []Event {
	copied := make([]Event, len(s.events))
	copy(copied, s.events)
	return copied
}
```

学习要点：

- 状态变更入口集中在方法上，后面才能加不变量检查。
- `Events()` 返回拷贝，避免外部修改内部历史。
- 生产版可以进一步禁止“tool finish before tool start”这类非法序列。

### Repository `UpdateFn` For Concurrent Domain Change

来源：Wild Workouts 的 repository update function。

迁移到 agent run/session store：把读、改、写封装成一次操作，减少业务层散落并发控制。

```go
type SessionRepository interface {
	Update(ctx context.Context, sessionID string, update func(*Session) error) error
}

type MemorySessionRepository struct {
	mu       sync.Mutex
	sessions map[string]*Session
}

func (r *MemorySessionRepository) Update(ctx context.Context, sessionID string, update func(*Session) error) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	session := r.sessions[sessionID]
	if session == nil {
		session = NewSession(sessionID)
		r.sessions[sessionID] = session
	}
	return update(session)
}
```

学习要点：

- 对聚合的并发修改要有单一入口。
- 数据库版可以在 `Update` 内部开启事务、加版本号或乐观锁。
- command handler 不应该手写“先查再改再存”的重复流程。

### Clean Usecase With Timeout

来源：`go-backend-clean-architecture/usecase/task_usecase.go`。

迁移到 gateway：usecase 控制超时，不让 handler 或 provider client 随意决定请求生命周期。

```go
type GatewayUsecase struct {
	service core.Service
	timeout time.Duration
}

func (u GatewayUsecase) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	if u.timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, u.timeout)
		defer cancel()
	}
	return u.service.Chat(ctx, req)
}
```

测试：

```go
func TestGatewayUsecaseAppliesTimeout(t *testing.T) {
	usecase := GatewayUsecase{
		service: core.Service{Executor: SlowExecutor{}},
		timeout: time.Nanosecond,
	}

	_, err := usecase.Chat(context.Background(), core.ChatRequest{})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("want deadline exceeded, got %v", err)
	}
}
```

学习要点：

- 超时是业务契约的一部分，应在 usecase/service 边界可见。
- provider client 也要尊重 context，但不要自己发明全局 timeout。
- 不同模型或 tenant 可以有不同 timeout policy。

### Entity State Transition

来源：`evrone/go-clean-template/internal/entity/task.go`。

迁移到 tool call：状态机集中定义，避免 controller/runner 到处改字符串。

```go
type ToolStatus string

const (
	ToolPending   ToolStatus = "pending"
	ToolRunning   ToolStatus = "running"
	ToolSucceeded ToolStatus = "succeeded"
	ToolFailed    ToolStatus = "failed"
)

type ToolCall struct {
	ID     string
	Name   string
	Status ToolStatus
}

func (c *ToolCall) Start() error {
	if c.Status != ToolPending {
		return fmt.Errorf("cannot start tool call from %s", c.Status)
	}
	c.Status = ToolRunning
	return nil
}

func (c *ToolCall) Finish() error {
	if c.Status != ToolRunning {
		return fmt.Errorf("cannot finish tool call from %s", c.Status)
	}
	c.Status = ToolSucceeded
	return nil
}
```

学习要点：

- 状态机先在内存版写清楚，再决定是否事件溯源。
- 非法状态转移必须返回错误，不能静默覆盖。
- agent runtime 的恢复、审计、UI 展示都依赖稳定状态语义。

### go-kit Style Endpoint Middleware

来源：`go-kit/examples/addsvc/pkg/addendpoint`。

迁移到 provider call：endpoint 层可叠加限流、熔断、trace、metrics。

```go
type Endpoint[Req any, Resp any] func(context.Context, Req) (Resp, error)

type Middleware[Req any, Resp any] func(Endpoint[Req, Resp]) Endpoint[Req, Resp]

func WithTelemetry[Req any, Resp any](sink telemetry.Sink, name string) Middleware[Req, Resp] {
	return func(next Endpoint[Req, Resp]) Endpoint[Req, Resp] {
		return func(ctx context.Context, req Req) (Resp, error) {
			start := time.Now()
			resp, err := next(ctx, req)
			_ = sink.Record(ctx, telemetry.Event{
				Name:       name,
				ErrorClass: string(core.ErrorClassOf(err)),
				LatencyMS:  time.Since(start).Milliseconds(),
			})
			return resp, err
		}
	}
}
```

学习要点：

- endpoint 让横切能力不污染 service 方法。
- Go 泛型能表达通用 middleware，但不要为了炫技让类型变复杂。
- 对 gateway 来说，限流、熔断、trace 都适合挂在 provider endpoint 周围。

### Thin Transport Adapter

来源：go-kit transport 和 Clean Architecture controller。

HTTP 层只做 JSON 编解码和错误码映射：

```go
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

学习要点：

- controller/handler 不做 provider 选择。
- transport 不做业务重试。
- 错误码映射应该基于 core error class，而不是 provider 的原始字符串。
