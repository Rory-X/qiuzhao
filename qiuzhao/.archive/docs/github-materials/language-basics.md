# Language Basics Materials

这一组材料用于建立 Go 的基本语感。它不是终点，但会直接影响后面的高并发网关和 agent runtime，因为这些系统大量依赖接口、context、channel、测试和标准库。

## go101/go101

Source: [go101/go101](https://github.com/go101/go101/tree/c13b00435002a00f574430b61eb65ec5a268acfe)

### 先读什么

- [`README.md`](https://github.com/go101/go101/blob/c13b00435002a00f574430b61eb65ec5a268acfe/README.md)：先确认它是书籍集合，不是示例项目。
- [`pages/generics`](https://github.com/go101/go101/tree/c13b00435002a00f574430b61eb65ec5a268acfe/pages/generics)：泛型语义。
- [`pages/fundamentals`](https://github.com/go101/go101/tree/c13b00435002a00f574430b61eb65ec5a268acfe/pages/fundamentals)：类型、接口、内存、并发语义。

### 分段剖析

README 把内容分成 Fundamentals、Generics、Optimizations、Details & Tips。这个分类很适合当查漏补缺地图：先不要逐页读完，而是在写代码时反查。比如你在写 provider registry 时需要理解接口和方法集，就读接口章节；写限流或对象池时，再读内存和优化章节。

仓库本身也有 Go 程序入口，例如 [`main.go`](https://github.com/go101/go101/blob/c13b00435002a00f574430b61eb65ec5a268acfe/main.go) 和 [`go101.go`](https://github.com/go101/go101/blob/c13b00435002a00f574430b61eb65ec5a268acfe/go101.go)。它把 markdown/html 书籍内容打包成本地网站，适合理解“内容型工具”的结构：入口、生成、嵌入资源、HTTP 服务。

### 迁移到最终系统

- provider interface 设计前，回看接口和方法集。
- queue、pool、channel 设计前，回看并发和内存语义。
- 泛型用于 typed event、typed graph node、typed repository 时，先查泛型约束章节。

## quii/learn-go-with-tests

Source: [quii/learn-go-with-tests](https://github.com/quii/learn-go-with-tests/tree/dc00c650f66695f7b8cc2e8c8234be177d7b28c6)

### 先读什么

- [`README.md`](https://github.com/quii/learn-go-with-tests/blob/dc00c650f66695f7b8cc2e8c8234be177d7b28c6/README.md)：看目录，理解它按 TDD 递进。
- [`arrays/v5/sum_test.go`](https://github.com/quii/learn-go-with-tests/blob/dc00c650f66695f7b8cc2e8c8234be177d7b28c6/arrays/v5/sum_test.go)：看最小测试如何描述行为。
- [`concurrency/v1/check_websites_test.go`](https://github.com/quii/learn-go-with-tests/blob/dc00c650f66695f7b8cc2e8c8234be177d7b28c6/concurrency/v1/check_websites_test.go)：看并发行为如何从函数签名开始设计。
- [`http-server.md`](https://github.com/quii/learn-go-with-tests/blob/dc00c650f66695f7b8cc2e8c8234be177d7b28c6/http-server.md)、[`context.md`](https://github.com/quii/learn-go-with-tests/blob/dc00c650f66695f7b8cc2e8c8234be177d7b28c6/context.md)：后端服务必读。

### 分段剖析

它的核心价值不是“学语法”，而是用测试先定义 API。比如数组章节先写测试，再把 `Sum`、`SumAll` 这种函数逼出来；并发章节先把 `WebsiteChecker` 作为函数依赖传入，之后才能替换真实网络请求和 mock。

这种写法会直接影响我们自己的 `api_service` 和后续 `gateway_lab`：先测试“fallback 发生时返回备用 provider 的结果”，再写 provider router。先测试“context cancel 后请求停止”，再写 worker queue。不要先写一堆实现再补测试。

### 迁移到最终系统

- gateway routing：用表格测试覆盖模型名、provider 状态、fallback 顺序。
- agent runtime：用事件序列测试覆盖 tool call、tool result、handoff。
- 高并发：用 fake dependency 测并发行为，不让测试依赖真实网络。

## mmcgrana/gobyexample

Source: [mmcgrana/gobyexample](https://github.com/mmcgrana/gobyexample/tree/c437a3d5f6814b1141b822ab19a685c3672cec94)

### 先读什么

- [`README.md`](https://github.com/mmcgrana/gobyexample/blob/c437a3d5f6814b1141b822ab19a685c3672cec94/README.md)：看它如何从示例源码生成静态站点。
- [`examples/channel-directions/channel-directions.go`](https://github.com/mmcgrana/gobyexample/blob/c437a3d5f6814b1141b822ab19a685c3672cec94/examples/channel-directions/channel-directions.go)：channel 方向。
- [`examples/worker-pools`](https://github.com/mmcgrana/gobyexample/tree/c437a3d5f6814b1141b822ab19a685c3672cec94/examples/worker-pools)：worker pool。
- [`examples/rate-limiting`](https://github.com/mmcgrana/gobyexample/tree/c437a3d5f6814b1141b822ab19a685c3672cec94/examples/rate-limiting)：限流。
- [`examples/context`](https://github.com/mmcgrana/gobyexample/tree/c437a3d5f6814b1141b822ab19a685c3672cec94/examples/context)：取消和超时。

### 分段剖析

Go by Example 的结构是“一个目录一个概念”。比如 channel direction 用 `chan<-` 和 `<-chan` 把发送/接收能力编码到函数签名里。这对大系统很重要：类型系统可以帮助你表达边界，不需要只靠注释。

它的 worker pool、rate limiting、context 示例是后面 gateway 的最小积木。读的时候不要只运行示例，要问：如果把 `job` 换成 LLM 请求，把 `worker` 换成 provider worker，把 `rate limiter` 换成 API key 限额，会缺哪些东西？答案通常是超时、队列长度、错误类型、观测指标和优雅关闭。

### 迁移到最终系统

- 用 channel direction 约束 event bus 的读写端。
- 用 worker pool 搭 provider request queue。
- 用 rate limiting 做 per-key 和 per-provider 控制。

## golang/example

Source: [golang/example](https://github.com/golang/example/tree/7f05d217867b2af52b0a28c6d1c91df97e1b5b39)

### 先读什么

- [`README.md`](https://github.com/golang/example/blob/7f05d217867b2af52b0a28c6d1c91df97e1b5b39/README.md)：官方示例目录说明。
- [`hello`](https://github.com/golang/example/tree/7f05d217867b2af52b0a28c6d1c91df97e1b5b39/hello)：命令行和本地 package。
- [`helloserver/server.go`](https://github.com/golang/example/blob/7f05d217867b2af52b0a28c6d1c91df97e1b5b39/helloserver/server.go)：最小 HTTP server。
- [`outyet/main.go`](https://github.com/golang/example/blob/7f05d217867b2af52b0a28c6d1c91df97e1b5b39/outyet/main.go)：后台 goroutine、锁、模板和监控变量。

### 分段剖析

`helloserver` 展示了标准库 HTTP 服务最小形态：flag 配置、handler 注册、`ListenAndServe`。它对新手最有价值的点是克制：一个 handler 只做一件事，输出前对 path 做清洗，HTML 输出前 escape。

`outyet` 比 `helloserver` 更接近真实服务。它有后台轮询，有 `sync.RWMutex` 保护状态，有 `expvar` 暴露计数，有 hook 让集成测试控制 sleep/done。这个文件很小，但已经具备长期运行服务的基本元素。

### 迁移到最终系统

- 网关入口先用标准库写清楚，再决定是否上框架。
- 后台 provider health check 可以参考 `outyet` 的轮询结构。
- 监控变量思想可升级成 Prometheus/OpenTelemetry。

## inancgumus/learngo

Source: [inancgumus/learngo](https://github.com/inancgumus/learngo/tree/3c475a78e54336c6255e925ff66b8ef4da6a2ae7)

### 先读什么

- [`README.md`](https://github.com/inancgumus/learngo/blob/3c475a78e54336c6255e925ff66b8ef4da6a2ae7/README.md)：确认它是示例、练习和 quiz 仓库。
- [`02-write-your-first-program/main.go`](https://github.com/inancgumus/learngo/blob/3c475a78e54336c6255e925ff66b8ef4da6a2ae7/02-write-your-first-program/main.go)：第一个程序的注释化拆解。
- [`concurrency`](https://github.com/inancgumus/learngo/tree/3c475a78e54336c6255e925ff66b8ef4da6a2ae7/concurrency)：并发练习。
- [`interfaces`](https://github.com/inancgumus/learngo/tree/3c475a78e54336c6255e925ff66b8ef4da6a2ae7/interfaces)：接口练习。

### 分段剖析

这个仓库适合“练手”，不适合当架构参考。它的好处是材料密度高：每个目录聚焦一个语言点，适合在读大项目卡住时回到基础训练。

第一程序文件用注释解释 `package main`、`import`、`func main` 和 exported symbol。这些看似基础，但它们会影响后面读大项目入口：你会更快识别哪些包是可执行入口，哪些包是库，哪些符号是公共 API。

### 迁移到最终系统

- 用它补接口、函数、指针、并发的肌肉记忆。
- 不从这里学项目结构，只把它当练习集。
- 每读完一个大系统代码片段，回这里找相同语言点的小练习。

## 本阶段输出

读完这组材料后，你应该能完成：

- 给 `api_service` 补完标准库 HTTP 测试。
- 写一个带 context timeout 的 provider mock。
- 写一个最小 worker pool。
- 写一个 per-key rate limiter 的单元测试。

## Go 代码转译

这一节把上面 5 个语言学习仓库转成后续 AI gateway/agent runtime 会反复使用的代码骨架。学习时不要只看“语法是什么”，要看“这个语言点如何保护大系统边界”。

### Interface Belongs To The Consumer

来源：

- `go101/go101`：接口、方法集和 interface value 语义。
- `quii/learn-go-with-tests`：用 fake dependency 先定义调用方需要的行为。

迁移到 gateway：`core.Service` 不需要知道 executor 是 fallback、single provider 还是 mock。它只声明自己要什么能力。

```go
type Executor interface {
	Execute(ctx context.Context, req ChatRequest, plan RoutePlan) (ChatResponse, error)
}

type Service struct {
	Policy   Authorizer
	Limiter  Limiter
	Router   Router
	Executor Executor
}

func (s Service) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	policy, err := s.Policy.Authorize(ctx, req)
	if err != nil {
		return ChatResponse{}, err
	}
	if err := s.Limiter.Admit(ctx, req.TenantID, req.EstimatedTokens()); err != nil {
		return ChatResponse{}, err
	}
	plan, err := s.Router.Plan(ctx, req, policy)
	if err != nil {
		return ChatResponse{}, err
	}
	return s.Executor.Execute(ctx, req, plan)
}
```

学习要点：

- 接口由调用方定义，方便测试和替换。
- 不要提前定义一个巨大 `Provider` 接口包含 chat、embedding、image、audio、price、health。
- 真正需要哪个方法，就先把哪个方法放到最小接口里。

### Test First For Gateway Fallback

来源：`quii/learn-go-with-tests` 的核心不是测试工具，而是用测试先钉住行为。

把它翻译成 gateway 测试时，应先写“primary 超时，backup 成功，并记录观测”的测试。

```go
func TestGatewayFallbackRecordsTelemetry(t *testing.T) {
	registry := provider.NewRegistry()
	registry.Replace("primary", provider.NewRuntime("primary", provider.FakeTimeout{}))
	registry.Replace("backup", provider.NewRuntime("backup", provider.FakeSuccess{
		Name:    "backup",
		Content: "ok",
	}))

	telemetrySink := telemetry.NewMemoryExporter()
	executor := fallback.NewExecutor(registry, telemetrySink)
	req := core.ChatRequest{
		RequestID: "req-1",
		TenantID:  "tenant-a",
		Model:     "gpt-demo",
		Provider:  "primary",
		Messages:  []core.Message{{Role: "user", Content: "hello"}},
	}
	plan := core.RoutePlan{Attempts: []core.Route{
		{Provider: "primary", Model: "gpt-demo"},
		{Provider: "backup", Model: "gpt-demo"},
	}}

	resp, err := executor.Execute(context.Background(), req, plan)
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if resp.Provider != "backup" {
		t.Fatalf("provider: want backup got %s", resp.Provider)
	}
	if !telemetrySink.Contains("gateway.provider_attempt", map[string]string{
		"provider":    "primary",
		"error_class": "timeout",
	}) {
		t.Fatalf("missing primary failure telemetry")
	}
}
```

学习要点：

- 测试名表达业务事实，不写成 `TestExecute1`。
- fake provider 是架构学习的核心工具，不是“偷懒”。
- fallback、限流、熔断、观测这些机制都应该先有失败路径测试。

### Context-Aware Provider Call

来源：

- `quii/learn-go-with-tests/context.md`
- `mmcgrana/gobyexample/examples/context`
- `golang/example/outyet` 的长期运行服务意识。

LLM provider 调用必须尊重 `context.Context`，否则一次慢请求会占住连接、goroutine 和下游额度。

```go
type ProviderClient interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type TimeoutProvider struct {
	Delay time.Duration
}

func (p TimeoutProvider) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	timer := time.NewTimer(p.Delay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ChatResponse{}, ctx.Err()
	case <-timer.C:
		return ChatResponse{}, GatewayError{
			Class: ErrorTimeout,
			Route: Route{Provider: req.Provider, Model: req.Model},
			Err:   context.DeadlineExceeded,
		}
	}
}
```

测试应该证明 cancel 后不会继续等待：

```go
func TestProviderHonorsCanceledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := TimeoutProvider{Delay: time.Minute}.Chat(ctx, ChatRequest{})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("want context canceled, got %v", err)
	}
}
```

学习要点：

- `context` 必须从 HTTP 入口一路传到 provider、store、tool。
- 不要在底层重新用 `context.Background()` 吃掉取消信号。
- 只有后台清理、异步 exporter 这类脱离请求生命周期的组件，才谨慎使用 background context。

### Channel Direction For Event Bus

来源：`mmcgrana/gobyexample/examples/channel-directions`。

把 `chan<-` 和 `<-chan` 写进签名，可以让编译器帮你守住“谁能发、谁能收”。

```go
type Event struct {
	ID        string
	SessionID string
	Type      string
	Content   string
}

func publish(out chan<- Event, evt Event) {
	out <- evt
}

func consume(in <-chan Event, handle func(Event)) {
	for evt := range in {
		handle(evt)
	}
}
```

迁移到 agent stream：

```go
func Subscribe(sessionID string, capacity int) <-chan Event {
	ch := make(chan Event, capacity)
	register(sessionID, ch)
	return ch
}
```

学习要点：

- 订阅者拿到 `<-chan Event`，就不能误发事件。
- publisher 内部持有 `chan<- Event` 或完整 channel，负责 fan-out 和 backpressure。
- channel 方向是最轻量的“类型级边界”。

### Bounded Worker Pool

来源：

- `mmcgrana/gobyexample/examples/worker-pools`
- `uber-go/guide/src/channel-size.md`

provider worker pool 不能无限接收请求。队列容量是系统承诺的一部分。

```go
type Job struct {
	ID      string
	Request ChatRequest
}

type WorkerPool struct {
	jobs chan Job
}

func NewWorkerPool(capacity int) *WorkerPool {
	if capacity < 1 {
		capacity = 1
	}
	return &WorkerPool{jobs: make(chan Job, capacity)}
}

func (p *WorkerPool) TrySubmit(ctx context.Context, job Job) error {
	select {
	case p.jobs <- job:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return GatewayError{Class: ErrorOverloaded, Err: ErrQueueFull}
	}
}
```

学习要点：

- `default` 分支让队列满时立即拒绝，形成 backpressure。
- 如果业务需要排队等待，必须设置 deadline，不能无限等。
- 高流量系统里，`ErrQueueFull` 是正常保护机制，不是罕见异常。

### Per-Key Rate Limiter

来源：`mmcgrana/gobyexample/examples/rate-limiting`。

学习版 per-tenant limiter：

```go
type Limiter struct {
	mu      sync.Mutex
	limit   int
	counter map[string]int
}

func NewLimiter(limit int) *Limiter {
	return &Limiter{
		limit:   limit,
		counter: map[string]int{},
	}
}

func (l *Limiter) Admit(key string, cost int) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.counter[key]+cost > l.limit {
		return false
	}
	l.counter[key] += cost
	return true
}
```

对应测试：

```go
func TestLimiterRejectsAfterBudget(t *testing.T) {
	limiter := NewLimiter(10)
	if !limiter.Admit("tenant-a", 7) {
		t.Fatal("first request should pass")
	}
	if limiter.Admit("tenant-a", 4) {
		t.Fatal("second request should exceed budget")
	}
	if !limiter.Admit("tenant-b", 4) {
		t.Fatal("different tenant should have independent budget")
	}
}
```

学习要点：

- key 可以是 tenant、API key、provider、model 或 session。
- 生产版要加时间窗口、分布式存储和原子更新。
- 单机版先用测试把语义说清楚，再引 Redis/Lua 或限流库。
