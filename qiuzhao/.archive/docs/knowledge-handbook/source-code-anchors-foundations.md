# Foundation Source Code Anchors

这份手册补齐 `01_language_basics` 到 `04_real_projects` 的源码级锚点。上一份 [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md) 已经覆盖高级系统；本文件覆盖基础语言、项目结构、架构模式和真实产品项目。

每张卡片都按同一条链路写：

```text
real GitHub file/symbol/line
  -> design extraction
  -> learning Go translation
  -> local proof / future lab
```

这些学习版代码不是上游源码复制，而是把上游设计迁移到你的 Go 大业务系统学习：AI gateway、agent runtime、高并发、高可用、可观测。

Related:

- [`source-segments/language-segments.md`](source-segments/language-segments.md)
- [`source-segments/structure-segments.md`](source-segments/structure-segments.md)
- [`source-segments/architecture-segments.md`](source-segments/architecture-segments.md)
- [`source-segments/real-project-segments.md`](source-segments/real-project-segments.md)
- [`go-code-patterns.md`](go-code-patterns.md)
- [`reference-implementations.md`](reference-implementations.md)
- [`system-blueprints.md`](system-blueprints.md)

## Coverage Snapshot

| Phase | Source | Verified commit | Anchors |
|---|---|---:|---|
| 01 | [go101/go101](https://github.com/go101/go101/tree/c13b00435002a00f574430b61eb65ec5a268acfe) | `c13b00435002a` | `pages/fundamentals/interface.tmd`, `container.tmd`, `channel.tmd` |
| 01 | [quii/learn-go-with-tests](https://github.com/quii/learn-go-with-tests/tree/dc00c650f66695f7b8cc2e8c8234be177d7b28c6) | `dc00c650f666` | `concurrency/v3/check_websites.go`, `context/v3/context.go`, `http-server/v5/server.go` |
| 01 | [mmcgrana/gobyexample](https://github.com/mmcgrana/gobyexample/tree/c437a3d5f6814b1141b822ab19a685c3672cec94) | `c437a3d5f681` | `worker-pools.go`, `rate-limiting.go`, `channel-directions.go` |
| 01 | [golang/example](https://github.com/golang/example/tree/7f05d217867b2af52b0a28c6d1c91df97e1b5b39) | `7f05d217867b` | `helloserver/server.go`, `outyet/main.go`, `slog-handler-guide/*` |
| 01 | [inancgumus/learngo](https://github.com/inancgumus/learngo/tree/3c475a78e54336c6255e925ff66b8ef4da6a2ae7) | `3c475a78e543` | `16-slices/*`, full slice/copy exercises |
| 02 | [golang-standards/project-layout](https://github.com/golang-standards/project-layout/tree/a9d6fae7015527b10550ebb6d6b71a71b1ef5ea7) | `a9d6fae70155` | `cmd/README.md`, `internal/README.md`, `pkg/README.md`, `api/README.md` |
| 02 | [uber-go/guide](https://github.com/uber-go/guide/tree/1d60a91aa5e87d443002e23c21903c49489dbde5) | `1d60a91aa5e8` | `error-wrap.md`, `channel-size.md`, `container-copy.md`, `interface-compliance.md` |
| 02 | [google/styleguide](https://github.com/google/styleguide/tree/1809c769de31ba388c755ad15dd057a9ba8531fd/go) | `1809c769de31` | `go/best-practices.md`, `go/guide.md` |
| 02 | [sagikazarmark/modern-go-application](https://github.com/sagikazarmark/modern-go-application/tree/468a20bc42f96ffebae693a51b006b263b4a497e) | `468a20bc42f9` | `cmd/modern-go-application/main.go`, `internal/app/mga/app.go` |
| 03 | [ThreeDotsLabs/wild-workouts-go-ddd-example](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example/tree/f264c714c5d643bf207d72335f02d3be858d9a84) | `f264c714c5d6` | `domain/hour/hour.go`, `repository.go`, command decorator |
| 03 | [go-backend-clean-architecture](https://github.com/amitshekhariitbhu/go-backend-clean-architecture/tree/8a8bf00d4936b325baed89ceb631faae3122d1b5) | `8a8bf00d4936` | `usecase/task_usecase.go`, `api/controller/task_controller.go` |
| 03 | [evrone/go-clean-template](https://github.com/evrone/go-clean-template/tree/caa9e35d8ed7c438070954f3355973be9e6ae313) | `caa9e35d8ed` | `internal/usecase/contracts.go`, REST controller, `entity/task.go` |
| 03 | [go-kit/examples](https://github.com/go-kit/examples/tree/e18c82edc2f9c7de3aff9748751d63270c052c1b) | `e18c82edc2f9` | `addservice`, `addendpoint`, `addtransport` |
| 04 | [pocketbase/pocketbase](https://github.com/pocketbase/pocketbase/tree/667a765070bc4554696acb1c96e8a484697008fd) | `667a765070bc` | `pocketbase.go`, `apis/base.go`, `tools/hook/hook.go` |
| 04 | [usememos/memos](https://github.com/usememos/memos/tree/d1cef7a9ab23e8c93f76b2f32661c720c733536d) | `d1cef7a9ab23` | `cmd/memos/main.go`, `server/server.go`, `sse_hub.go` |
| 04 | [caddyserver/caddy](https://github.com/caddyserver/caddy/tree/13a4c3f43c79ca04064457ab9cf95b376c294141) | `13a4c3f43c79` | `modules.go`, `admin.go`, `caddy.go` |
| 04 | [syncthing/syncthing](https://github.com/syncthing/syncthing/tree/ef4629ea56021d0941017f30ec53be45d2836e24) | `ef4629ea5602` | `GOALS.md`, `lib/protocol/protocol.go`, `lib/model/model.go` |

## 01 Language Basics

### go101: Interface, Container, Channel Semantics

Source anchors:

```text
pages/fundamentals/interface.tmd line 24: interface type defines requirements
pages/fundamentals/interface.tmd line 43: error interface example
pages/fundamentals/container.tmd line 43: slice/map value may have underlying part
pages/fundamentals/container.tmd line 77: copy shares underlying parts
pages/fundamentals/channel.tmd line 87: chan<- send-only
pages/fundamentals/channel.tmd line 90: <-chan receive-only
pages/fundamentals/channel.tmd line 277: close nil/already closed panics
```

Design extraction:

```text
接口是能力要求，不是类层级。
slice/map 过边界要小心共享底层状态。
channel 方向是 API contract，可以把生产者/消费者能力限制住。
close channel 是所有权操作，不能随意在 consumer 侧关闭。
```

Provider interface assertion:

```go
type ChatCaller interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type OpenAIClient struct {
	http *http.Client
}

func (c *OpenAIClient) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	return ChatResponse{}, nil
}

var _ ChatCaller = (*OpenAIClient)(nil)
```

Copy boundary:

```go
type Session struct {
	events []Event
	meta   map[string]string
}

func (s *Session) Events() []Event {
	out := make([]Event, len(s.events))
	copy(out, s.events)
	return out
}

func (s *Session) Metadata() map[string]string {
	out := make(map[string]string, len(s.meta))
	for k, v := range s.meta {
		out[k] = v
	}
	return out
}
```

Channel ownership:

```go
type EventPublisher struct {
	out chan Event
}

func (p *EventPublisher) Publish(event Event) error {
	select {
	case p.out <- event:
		return nil
	default:
		return ErrQueueFull
	}
}

func (p *EventPublisher) Subscribe() <-chan Event {
	return p.out
}

func (p *EventPublisher) Close() {
	close(p.out)
}
```

Local proof:

```text
architecture_labs/agent.Session.Events copies event history.
future gateway/provider clients should use compile-time interface assertions.
future event bus should expose receive-only subscription channels.
```

### Learn Go With Tests: Behavior First, Fake Dependencies, Context

Source anchors:

```text
concurrency/v3/check_websites.go line 12: CheckWebsites
line 14: resultChannel
line 17: go func
line 23: receive result
context/v3/context.go line 10: Store interface
line 15: Server returns http.HandlerFunc
line 17: store.Fetch(r.Context())
http-server/v5/server.go line 10: PlayerStore interface
line 20: ServeHTTP
```

Design extraction:

```text
先写行为测试，再实现并发。
网络、存储、provider 都通过接口或函数注入，测试不碰真实外部系统。
HTTP request context 必须传到 store/provider/tool。
```

Gateway route test:

```go
func TestRouterFallsBackWhenPreferredProviderIsUnhealthy(t *testing.T) {
	router := NewRouter([]ProviderSnapshot{
		{Name: "primary", Healthy: false, Models: map[ModelName]bool{"gpt": true}},
		{Name: "backup", Healthy: true, Models: map[ModelName]bool{"gpt": true}},
	})
	policy := TenantPolicy{
		AllowedModels:    map[ModelName]bool{"gpt": true},
		AllowedProviders: map[ProviderName]bool{"primary": true, "backup": true},
		AllowFallbacks:   true,
	}

	plan, err := router.Plan(ChatRequest{Model: "gpt"}, policy)
	if err != nil {
		t.Fatal(err)
	}
	if plan.Primary.Provider != "backup" {
		t.Fatalf("primary provider: want backup got %s", plan.Primary.Provider)
	}
}
```

Context forwarding:

```go
type Store interface {
	Fetch(ctx context.Context, id string) (Resource, error)
}

func ResourceHandler(store Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resource, err := store.Fetch(r.Context(), r.PathValue("id"))
		if err != nil {
			WriteError(w, err)
			return
		}
		WriteJSON(w, http.StatusOK, resource)
	}
}
```

Fake provider:

```go
type ProviderFunc func(context.Context, ChatRequest) (ChatResponse, error)

func (f ProviderFunc) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	return f(ctx, req)
}

func timeoutProvider() ProviderFunc {
	return func(ctx context.Context, req ChatRequest) (ChatResponse, error) {
		return ChatResponse{}, GatewayError{Class: ErrorTimeout, Err: context.DeadlineExceeded}
	}
}
```

### Go By Example: Worker Pool, Rate Limiter, Channel Direction

Source anchors:

```text
worker-pools.go line 16: worker(id int, jobs <-chan int, results chan<- int)
line 31: jobs := make(chan int, numJobs)
line 37: go worker
line 45: close(jobs)
rate-limiting.go line 29: limiter := time.Tick
line 44: burstyLimiter buffered channel
channel-directions.go line 13: ping(chan<- string)
line 19: pong(<-chan string, chan<- string)
```

Design extraction:

```text
worker pool 需要输入队列、输出队列和关闭协议。
rate limit 是读取许可，不是 sleep 散落在业务代码里。
channel direction 把 API 能力限制写进类型系统。
```

Provider worker pool:

```go
type ProviderWorkerPool struct {
	jobs   chan ProviderJob
	client ProviderClient
}

func NewProviderWorkerPool(client ProviderClient, capacity int) *ProviderWorkerPool {
	return &ProviderWorkerPool{
		jobs:   make(chan ProviderJob, capacity),
		client: client,
	}
}

func (p *ProviderWorkerPool) Start(ctx context.Context, workers int) {
	for i := 0; i < workers; i++ {
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case job, ok := <-p.jobs:
					if !ok {
						return
					}
					resp, err := p.client.Chat(ctx, job.Request)
					job.Reply <- ProviderResult{Resp: resp, Err: err}
				}
			}
		}()
	}
}
```

Token limiter:

```go
type TickerLimiter struct {
	tokens <-chan time.Time
}

func NewTickerLimiter(interval time.Duration) TickerLimiter {
	return TickerLimiter{tokens: time.Tick(interval)}
}

func (l TickerLimiter) Wait(ctx context.Context) error {
	select {
	case <-l.tokens:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
```

### golang/example: Standard HTTP And Long-Running Poller

Source anchors:

```text
helloserver/server.go line 35: func main
line 49: http.HandleFunc
line 53: http.ListenAndServe
outyet/main.go line 49: type Server implements http.Handler
line 59: NewServer
line 67: poll
line 98: ServeHTTP
slog-handler-guide/indenthandler4/indent_handler.go line 18: IndentHandler
line 47: Enabled
line 52: WithGroup
line 67: WithAttrs
line 98: Handle
```

Design extraction:

```text
标准库足够表达最小 HTTP boundary。
长期运行服务经常有 background poller，要纳入生命周期。
slog.Handler 展示了结构化日志适配器接口：Enabled/Handle/WithAttrs/WithGroup。
```

HTTP app skeleton:

```go
func BuildMux(handler Handler) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handler.Health)
	mux.HandleFunc("POST /v1/chat/completions", handler.Chat)
	mux.HandleFunc("POST /v1/agent/sessions/{sessionID}/runs", handler.StartRun)
	return mux
}
```

Background poller:

```go
type HealthPoller struct {
	interval time.Duration
	check    func(context.Context) error
}

func (p HealthPoller) Run(ctx context.Context) error {
	ticker := time.NewTicker(p.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			_ = p.check(ctx)
		}
	}
}
```

### learngo: Slice Copy And Backing Array Discipline

Source anchors:

```text
16-slices/14-copy/01-usage/main.go line 24: copy(evens, odds)
16-slices/exercises/23-limit-the-backing-array-sharing/solution/api/api.go line 13: Read returns slice
line 18: limit capacity of returned slice
line 28: All returns temps slice
```

Design extraction:

```text
slice 返回值如果共享 backing array，调用方 append 可能污染内部状态。
对 event history、route plan、provider list、tool calls 都要明确 copy 策略。
```

Defensive route plan:

```go
type RoutePlan struct {
	primary   Route
	fallbacks []Route
}

func (p RoutePlan) Primary() Route {
	return p.primary
}

func (p RoutePlan) Fallbacks() []Route {
	out := make([]Route, len(p.fallbacks))
	copy(out, p.fallbacks)
	return out
}
```

## 02 Project Structure And Style

### project-layout: Directories Communicate Intent

Source anchors:

```text
cmd/README.md line 1: /cmd
line 7: keep reusable/private code outside cmd
line 9: small main function
internal/README.md line 1: /internal
line 3: private code enforced by compiler
pkg/README.md line 1: /pkg
line 3: public library code
api/README.md line 1: /api
line 3: OpenAPI/Swagger/protocol specs
```

Design extraction:

```text
cmd 是 composition root。
internal 是默认业务实现边界。
pkg 表示对外承诺，早期不要滥用。
api 放协议定义，不放业务逻辑。
```

Target package map:

```text
cmd/gateway
internal/gateway/httpapi
internal/gateway/policy
internal/gateway/router
internal/gateway/provider
internal/gateway/fallback
internal/agent/session
internal/agent/event
internal/agent/runner
internal/agent/tool
internal/platform/observability
internal/platform/lifecycle
api/openapi
```

Composition root:

```go
func main() {
	cfg := LoadConfig()
	app, err := BuildGatewayApp(cfg)
	if err != nil {
		log.Fatal(err)
	}
	ctx := RootContext()
	if err := app.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatal(err)
	}
}
```

### Uber Go Guide: Error, Channel Size, Copy, Interface Compliance

Source anchors:

```text
src/error-wrap.md line 23: use %w when caller needs underlying error
src/channel-size.md line 3: channels usually size one or unbuffered
src/channel-size.md line 6: justify what prevents filling under load
src/container-copy.md line 35: copy input slice
src/interface-compliance.md line 38: var _ http.Handler = (*Handler)(nil)
line 51: compile failure if interface no longer matches
```

Design extraction:

```text
错误跨层要带上下文，同时保留 errors.Is/errors.As。
channel capacity 是架构决策，要解释负载下为什么不会无限堆积。
容器进出边界要 copy。
重要接口用 compile-time assertion 防止重构破坏。
```

Gateway error wrapping:

```go
func (c ProviderClient) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	resp, err := c.transport.Send(ctx, req)
	if err != nil {
		return ChatResponse{}, fmt.Errorf("provider %s chat model %s: %w", c.name, req.Model, err)
	}
	return resp, nil
}
```

Capacity comment:

```go
// providerQueueCapacity bounds in-memory provider calls. Overflow returns
// 503/overloaded so upstream clients apply backoff instead of growing latency.
const providerQueueCapacity = 256
```

Interface compliance:

```go
var _ http.Handler = (*GatewayHandler)(nil)
var _ ProviderClient = (*OpenAIClient)(nil)
var _ EventStore = (*PostgresEventStore)(nil)
```

### Google Go Styleguide: Clarity And Test Doubles

Source anchors:

```text
go/guide.md line 47: code clear to reader
line 83: explain why
line 143: comments explain why, not what
go/best-practices.md line 171: test doubles
line 249: stub example
line 293: multiple test double behaviors
```

Design extraction:

```text
注释用于解释策略和约束，不重复代码。
测试替身是架构学习的一等工具：provider、tool、event store、telemetry 都应该能 fake。
```

Policy comment:

```go
// Drop telemetry rather than blocking the request path. The dropped counter is
// exported, so overload remains visible without turning observability into an outage.
func (s *AsyncTelemetrySink) Record(ctx context.Context, event TelemetryEvent) {
	select {
	case s.queue <- event:
	default:
		s.dropped.Add(1)
	}
}
```

Test double set:

```go
type AlwaysSucceedsProvider struct{}

func (AlwaysSucceedsProvider) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	return ChatResponse{Provider: req.Provider, Model: req.Model, Content: "ok"}, nil
}

type AlwaysTimesOutProvider struct{}

func (AlwaysTimesOutProvider) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	return ChatResponse{}, GatewayError{Class: ErrorTimeout, Err: context.DeadlineExceeded}
}
```

### modern-go-application: Production Startup Surface

Source anchors:

```text
cmd/modern-go-application/main.go line 71: main
line 97: unmarshal config
line 104: create logger
line 137: health checker
line 151: tracing config
line 178: graceful restart
line 220: connect database
line 238: Watermill pub/sub
line 317: initialize app
line 325: message router Run
line 340: httpServer.Shutdown
line 349: signal handler
internal/app/mga/app.go line 66: HTTP server options
line 111: register routes
line 130: RegisterEventHandlers
```

Design extraction:

```text
生产启动不只是 http.ListenAndServe。
启动面包括配置、日志、健康检查、tracing、DB、pub/sub、HTTP、gRPC、消息 worker、信号处理和优雅关闭。
业务 app 初始化和 platform 初始化要分层。
```

Gateway app runner:

```go
type GatewayApp struct {
	httpServer *http.Server
	workers    []Runner
	telemetry  Component
}

func (a GatewayApp) Run(ctx context.Context) error {
	group, ctx := errgroup.WithContext(ctx)

	group.Go(func() error { return a.telemetry.Start(ctx) })
	group.Go(func() error {
		err := a.httpServer.ListenAndServe()
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	})
	for _, worker := range a.workers {
		w := worker
		group.Go(func() error { return w.Run(ctx) })
	}

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = a.httpServer.Shutdown(shutdownCtx)
	_ = a.telemetry.Shutdown(shutdownCtx)
	return group.Wait()
}
```

## 03 Architecture Patterns

### Wild Workouts: Domain Invariants And Repository Closure

Source anchors:

```text
internal/trainer/domain/hour/hour.go line 11: Hour
line 73: NewFactory
line 105: availability Available
line 116: availability NotAvailable
internal/trainer/domain/hour/repository.go line 8: Repository interface
line 10: UpdateHour
line 13: updateFn func(h *Hour)
internal/common/decorator/command.go line 11: ApplyCommandDecorators
line 21: CommandHandler
```

Design extraction:

```text
领域对象保护状态，不把字段裸露给 handler。
repository closure 把 read-modify-write 事务放在存储层协调。
command decorator 把日志、metrics、tracing 作为外层 wrapper，而不是污染用例。
```

Agent session repository:

```go
type SessionRepository interface {
	Update(ctx context.Context, sessionID string, fn func(*Session) error) error
}

func AppendAssistantMessage(ctx context.Context, repo SessionRepository, sessionID, content string) error {
	return repo.Update(ctx, sessionID, func(session *Session) error {
		return session.AppendAssistantMessage(content)
	})
}
```

Command decorator:

```go
type CommandHandler[C any] interface {
	Handle(ctx context.Context, cmd C) error
}

type CommandMiddleware[C any] func(CommandHandler[C]) CommandHandler[C]

func ApplyCommandDecorators[C any](h CommandHandler[C], mws ...CommandMiddleware[C]) CommandHandler[C] {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}
```

### go-backend-clean-architecture: Controller And Usecase Deadline

Source anchors:

```text
usecase/task_usecase.go line 10: taskUsecase
line 15: NewTaskUsecase(timeout)
line 23: context.WithTimeout
line 28: FetchByUserID
api/controller/task_controller.go line 11: TaskController
line 18: ShouldBind
line 20: JSON bad request
line 44: Fetch
```

Design extraction:

```text
controller 负责 bind/response/status。
usecase 负责 deadline 和调用 repository。
timeout 不应只放在 HTTP server；业务依赖也需要明确 deadline。
```

Provider usecase:

```go
type ChatUsecase struct {
	timeout time.Duration
	gateway Gateway
}

func (u ChatUsecase) Execute(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, u.timeout)
	defer cancel()
	return u.gateway.Chat(ctx, req)
}
```

Thin controller:

```go
func (h Handler) Chat(w http.ResponseWriter, r *http.Request) {
	req, err := DecodeChatRequest(r)
	if err != nil {
		WriteError(w, err)
		return
	}
	resp, err := h.usecase.Execute(r.Context(), req)
	WriteResult(w, resp, err)
}
```

### go-clean-template: Multi Transport And Entity State Machine

Source anchors:

```text
internal/usecase/contracts.go line 27: Task interface
line 28: Create
line 32: Transition
internal/controller/restapi/v1/task.go line 27: createTask
line 47: r.tk.Create(ctx.UserContext())
line 221: transitionTask
internal/entity/task.go line 8: TaskStatus
line 29: Valid
line 39: Transition
line 40: validTransitions map
```

Design extraction:

```text
同一个 usecase 可以被 REST/gRPC/AMQP/NATS controller 调用。
状态迁移在 entity 内，controller 只转发命令。
transition 函数是 agent run/tool call 状态机的直接模板。
```

Agent usecase contract:

```go
type AgentUsecase interface {
	StartRun(ctx context.Context, sessionID string, input string) (Run, error)
	TransitionRun(ctx context.Context, runID string, status RunStatus) (Run, error)
}

type HTTPAgentController struct{ usecase AgentUsecase }
type WorkerAgentController struct{ usecase AgentUsecase }
```

Run transition:

```go
func (r *Run) Transition(next RunStatus) error {
	valid := map[RunStatus][]RunStatus{
		RunPending:   {RunRunning, RunCanceled},
		RunRunning:   {RunCompleted, RunFailed, RunCanceled},
		RunCompleted: {},
		RunFailed:    {},
		RunCanceled:  {},
	}
	if !slices.Contains(valid[r.Status], next) {
		return ErrInvalidTransition
	}
	r.Status = next
	return nil
}
```

### go-kit/examples: Service, Endpoint, Transport

Source anchors:

```text
addsvc/pkg/addservice/service.go line 12: Service interface
line 55: Sum
line 66: Concat
addsvc/pkg/addendpoint/set.go line 27: Set
line 40: rate limiter middleware
line 41: circuit breaker middleware
line 42: tracing middleware
line 46: logging middleware
line 91: MakeSumEndpoint
addsvc/pkg/addtransport/http.go line 35: NewHTTPHandler
line 51: httptransport.NewServer
line 98: endpoint as http transport client
line 244: endpoint.Failer handling
```

Design extraction:

```text
service 是业务能力。
endpoint 是可被 middleware 包装的函数。
transport 是协议适配。
rate limit、circuit breaker、trace、log 都应该包 endpoint。
```

Gateway endpoint set:

```go
type GatewayEndpoints struct {
	Chat       Endpoint[ChatRequest, ChatResponse]
	StreamChat Endpoint[ChatRequest, StreamHandle]
}

func MakeGatewayEndpoints(s GatewayService, limiter Limiter, telemetry TelemetrySink) GatewayEndpoints {
	chat := Endpoint[ChatRequest, ChatResponse](s.Chat)
	chat = WithEndpointMetrics("gateway.chat", telemetry, chat)
	chat = WithEndpointRateLimit(limiter, chat)
	return GatewayEndpoints{Chat: chat}
}
```

Transport adapter:

```go
func NewGatewayHTTPHandler(endpoints GatewayEndpoints) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/chat/completions", AdaptJSON(DecodeChatRequest, endpoints.Chat))
	return mux
}
```

## 04 Real Projects

### PocketBase: App Core, Route Aggregation, Hooks

Source anchors:

```text
pocketbase.go line 33: PocketBase struct
line 73: New
line 88: NewWithConfig
line 166: Start
apis/base.go line 18: NewRouter
line 38: API routes
line 49: bindRealtimeApi
line 50: bindHealthApi
tools/hook/hook.go line 54: Hook
line 65: Bind
line 111: BindFunc
line 153: Trigger
```

Design extraction:

```text
产品核心是稳定 App，对外开放 hooks 和 route aggregation。
默认 API 从一个 NewRouter composition point 绑定。
hook 系统让定制行为进入扩展点，而不是 fork 核心逻辑。
```

Gateway app hooks:

```go
type Hook[T any] struct {
	handlers []func(context.Context, T) error
}

func (h *Hook[T]) Bind(fn func(context.Context, T) error) {
	h.handlers = append(h.handlers, fn)
}

func (h *Hook[T]) Trigger(ctx context.Context, event T) error {
	for _, handler := range h.handlers {
		if err := handler(ctx, event); err != nil {
			return err
		}
	}
	return nil
}

type GatewayHooks struct {
	BeforeRoute    Hook[*ChatRequest]
	BeforeProvider Hook[*ProviderAttempt]
	AfterProvider  Hook[*ProviderResult]
}
```

Route aggregation:

```go
func NewRouter(app App) *http.ServeMux {
	mux := http.NewServeMux()
	bindHealthAPI(mux, app.Health)
	bindGatewayAPI(mux, app.Gateway)
	bindAgentAPI(mux, app.Agent)
	bindAdminAPI(mux, app.Admin)
	return mux
}
```

### Memos: Server Lifecycle And SSE Backpressure

Source anchors:

```text
cmd/memos/main.go line 56: context.WithCancel
line 71: server.NewServer
line 80: graceful shutdown signal comment
line 85: http.ErrServerClosed handling
server/server.go line 31: Server
line 37: httpServer
line 40: backgroundRunnerCancels
line 101: Start
line 129: startBackgroundRunners
line 134: Shutdown
line 153: startBackgroundRunners
line 204: long-lived SSE shutdown note
server/router/api/v1/sse_hub.go line 54: SSEHub
line 71: Subscribe
line 73: buffered events
line 115: Broadcast
line 129: drop slow client event
```

Design extraction:

```text
产品服务把 HTTP server、background runners、signal、shutdown 放到一个生命周期里。
SSE 长连接不会自然结束，要主动纳入 shutdown。
SSE broadcast 不应被慢客户端阻塞，buffer 满时要有 drop/disconnect/persist 策略。
```

Agent event stream hub:

```go
type AgentStreamHub struct {
	mu      sync.RWMutex
	clients map[string]map[string]*StreamClient
}

type StreamClient struct {
	SessionID string
	UserID    string
	Events    chan []byte
}

func (h *AgentStreamHub) Subscribe(sessionID, userID string) *StreamClient {
	client := &StreamClient{
		SessionID: sessionID,
		UserID:    userID,
		Events:    make(chan []byte, 32),
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[sessionID] == nil {
		h.clients[sessionID] = map[string]*StreamClient{}
	}
	h.clients[sessionID][userID] = client
	return client
}

func (h *AgentStreamHub) Broadcast(sessionID string, event AgentEvent) {
	data, _ := json.Marshal(event)
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, client := range h.clients[sessionID] {
		select {
		case client.Events <- data:
		default:
			// Drop UI event; durable event store remains the source of truth.
		}
	}
}
```

### Caddy: Module Lifecycle And Admin Config

Source anchors:

```text
modules.go line 54: Module
line 63: ModuleInfo
line 138: RegisterModule
line 163: GetModule
line 296: Provisioner
line 306: Validate
admin.go line 71: AdminConfig
line 221: newAdminHandler
line 367: replaceLocalAdminServer
line 1006: handleConfig
caddy.go line 104: Run
line 115: Load
line 419: run
line 484: provisionContext
line 572: load and provision apps
line 694: Stop
line 744: Validate
```

Design extraction:

```text
module 必须有 ID 和 factory。
config load 走 provision/validate/run，不允许直接改运行态对象。
admin API 是动态配置入口，但仍受 lifecycle 约束。
```

Provider module lifecycle:

```go
type Module interface {
	ID() string
	Provision(ctx context.Context, raw json.RawMessage) error
	Validate() error
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
}

type ModuleRegistry struct {
	factories map[string]func() Module
}

func (r ModuleRegistry) Build(ctx context.Context, id string, raw json.RawMessage) (Module, error) {
	factory, ok := r.factories[id]
	if !ok {
		return nil, fmt.Errorf("module %s: %w", id, ErrNotFound)
	}
	module := factory()
	if err := module.Provision(ctx, raw); err != nil {
		return nil, err
	}
	if err := module.Validate(); err != nil {
		return nil, err
	}
	return module, nil
}
```

Admin config replace:

```go
func (a AdminService) ReplaceProvider(ctx context.Context, raw ProviderConfig) error {
	next, err := a.factory.BuildProvider(ctx, raw)
	if err != nil {
		return err
	}
	return a.providers.Replace(ctx, next)
}
```

### Syncthing: Goals, Protocol Boundary, Long-Running Model

Source anchors:

```text
GOALS.md line 1: goals
line 17: protecting data is paramount
line 65: safe, secure, easy sync
lib/protocol/protocol.go line 84: Model interface
line 116: Connection interface
line 222: NewConnection
line 274: Start
line 429: dispatcherLoop
line 688: handleRequest
line 957: Close
lib/model/model.go line 76: Model interface
line 148: globalRequestLimiter
line 215: NewModel
line 268: serve
line 1153: Index
line 1159: IndexUpdate
line 1163: handleIndex
```

Design extraction:

```text
先写系统目标，再选架构。
协议边界用稳定 interface 和消息类型表达，内部实现可以演进。
长运行 model 聚合配置、DB、连接、限流、状态、统计和后台循环。
```

AI platform goals:

```text
1. Agent session events must not be lost.
2. Provider failures must not exhaust shared concurrency.
3. Tenant quota and cost controls are hard boundaries.
4. Every route, fallback and tool decision must be observable.
5. Streaming protocol must remain compatible across UI and runtime changes.
```

Protocol boundary:

```go
type AgentProtocol interface {
	UserMessage(ctx context.Context, msg UserMessage) error
	ToolResult(ctx context.Context, result ToolResult) error
	StreamEvent(ctx context.Context, event AgentStreamEvent) error
	Close(error)
}

type AgentStreamEvent struct {
	Version   string          `json:"version"`
	ID        string          `json:"id"`
	SessionID string          `json:"session_id"`
	RunID     string          `json:"run_id"`
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
}
```

Runtime model:

```go
type RuntimeModel struct {
	config     ConfigStore
	events     EventStore
	providers  ProviderRegistry
	tools      ToolRegistry
	streams    EventBus
	limiter    Limiter
	stats      Stats
}

func (m *RuntimeModel) Serve(ctx context.Context) error {
	group, ctx := errgroup.WithContext(ctx)
	group.Go(func() error { return m.streams.Run(ctx) })
	group.Go(func() error { return m.providers.Monitor(ctx) })
	return group.Wait()
}
```

## Cross-Phase Learning Ladder

从 01 到 04，不要把材料割裂读。它们其实构成同一条工程能力链：

```text
Go 101 / Go by Example
  -> 类型、channel、copy、context、worker pool

Learn Go with Tests
  -> 表格测试、fake dependency、context propagation

project-layout / Uber / Google
  -> cmd/internal/pkg、错误、copy、接口、注释

Wild Workouts / Clean Architecture / go-kit
  -> domain/usecase/repository/endpoint/transport

PocketBase / Memos / Caddy / Syncthing
  -> hooks、lifecycle、SSE、module、protocol、long-running state

Advanced systems
  -> Bifrost/Tyk/Hertz/OTel/Temporal/NATS
```

合并成未来项目的一条链路：

```go
func BuildGatewayRuntime(cfg Config) (*RuntimeModel, error) {
	providers, err := BuildProviderRegistry(cfg.Providers)
	if err != nil {
		return nil, err
	}
	events, err := BuildEventStore(cfg.EventStore)
	if err != nil {
		return nil, err
	}
	runtime := &RuntimeModel{
		config:    cfg.Store,
		events:    events,
		providers: providers,
		tools:     BuildToolRegistry(cfg.Tools),
		streams:   NewEventBus(cfg.Streams),
		limiter:   NewLimiter(cfg.Limits),
		stats:     NewStats(),
	}
	return runtime, nil
}
```

测试闭环：

```go
func TestGatewayRuntimeRejectsOverloadedProvider(t *testing.T) {
	runtime := newTestRuntime(t,
		withProvider("primary", AlwaysTimesOutProvider{}),
		withProviderQueueCapacity("primary", 1),
	)

	_, err := runtime.Chat(context.Background(), ChatRequest{
		RequestID: "req-1",
		TenantID:  "tenant-1",
		Model:     "gpt",
	})

	if Classify(err) != ErrorTimeout && Classify(err) != ErrorOverloaded {
		t.Fatalf("expected timeout or overload, got %v", err)
	}
}
```

## Local Assignments

| Assignment | Source anchors | Local target |
|---|---|---|
| Defensive copying | Go 101 container, learngo copy | `architecture_labs/agent`, future route plan |
| Context propagation | Learn Go with Tests context, clean usecase timeout | `api_service`, provider calls |
| Bounded workers | Go by Example worker/rate limit | `architecture_labs/inference`, `capstone_ai_gateway_agent_runtime/internal/gateway/provider` |
| Package boundary | project-layout + modern-go-application | `capstone_ai_gateway_agent_runtime/cmd/gateway` |
| Error taxonomy | Uber wrapping + Google clarity | gateway fallback errors |
| Domain transition | Wild Workouts + go-clean-template | agent run/tool state |
| Endpoint stack | go-kit examples | gateway endpoint middleware |
| Hook/module lifecycle | PocketBase + Caddy | provider/tool plugins |
| SSE slow consumer | Memos SSE hub + NATS advanced anchors | agent event stream |
| Protocol model | Syncthing protocol/model | agent stream/event protocol |
