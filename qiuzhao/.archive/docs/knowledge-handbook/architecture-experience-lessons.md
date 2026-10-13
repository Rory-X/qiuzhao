# Architecture Experience Lessons

这份手册沉淀跨 GitHub 项目反复出现的工程经验。它不是某一个仓库的摘要，而是把 Go 大系统的共同规律抽出来，服务最终目标：AI Gateway + Agent Runtime。

## Lesson 1: 入口要薄，组合要清楚

Sources: project-layout, modern-go-application, Memos, Caddy.

经验：

- `cmd/.../main.go` 可以长，但不应该承载业务规则。
- 入口负责 config、logger、store、queue、provider、server、shutdown 的装配。
- 业务代码应该藏在 `internal/...` 里，由入口注入依赖。

Code:

```go
func main() {
	ctx := context.Background()
	cfg := LoadConfig()
	log := NewLogger(cfg.Log)

	providers := provider.BuildRegistry(cfg.Providers, log)
	router := gateway.NewRouter(cfg.Routing, providers)
	events := eventstore.NewMemoryStore()
	agentRunner := agent.NewRunner(events, providers)

	handler := httpapi.NewHandler(router, agentRunner, log)
	server := httpapi.NewServer(cfg.HTTPAddr, handler)

	if err := RunWithSignals(ctx, server, log); err != nil {
		log.Error("gateway stopped", "err", err)
		os.Exit(1)
	}
}
```

Local proof:

- `api_service/cmd/api/main.go`
- Future `cmd/gateway`

## Lesson 2: 小接口比“大平台接口”更适合业务内部

Sources: Google Go Styleguide, Go 101, go-kit, Caddy.

经验：

- 业务内部先定义小接口，例如 `ChatCaller`、`EventStore`、`Limiter`。
- 只有当接口本身就是产品平台边界时，才接受大接口，例如 PocketBase `App`、Caddy module registry。

Code:

```go
type ChatCaller interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type EventAppender interface {
	Append(ctx context.Context, streamID string, event Event) error
}

type TokenLimiter interface {
	Consume(ctx context.Context, key string, tokens int) error
}
```

反例：

```go
type Provider interface {
	Chat(context.Context, ChatRequest) (ChatResponse, error)
	Embed(context.Context, EmbedRequest) (EmbedResponse, error)
	Image(context.Context, ImageRequest) (ImageResponse, error)
	Audio(context.Context, AudioRequest) (AudioResponse, error)
	Pricing() Pricing
	Health(context.Context) error
}
```

这个接口会逼每个 provider 实现不支持的能力，后续 mock 也会变重。

## Lesson 3: 请求链路要有明确中间层

Sources: Tyk, Hertz, go-kit, Clean Architecture examples.

经验：

- HTTP transport 负责 decode/encode。
- middleware 负责 cross-cutting concerns：auth、rate limit、trace、panic recover。
- usecase/service 负责业务规则。
- provider/repository 负责外部依赖。

Code:

```go
type Handler struct {
	chat gateway.ChatUsecase
}

func (h Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/chat/completions", h.chatCompletions)

	return Chain(
		mux,
		Recover(),
		RequestID(),
		Trace(),
		Authenticate(),
		RateLimit(),
	)
}
```

## Lesson 4: fallback 是策略，不是简单 for 循环

Sources: Bifrost, Tyk, Uber Go Guide.

经验：

- fallback 前要判断错误类型。
- fallback 要有 attempt budget。
- fallback 要记录 provider/model/attempt/error_class。
- 非重试错误不能 fallback，例如 invalid input、unauthorized。

Code:

```go
func (f Fallback) Try(ctx context.Context, plan []Route, req ChatRequest) (ChatResponse, error) {
	var lastErr error
	for attempt, route := range plan {
		resp, err := f.call(ctx, route, req)
		if err == nil {
			f.telemetry.Success(ctx, route, attempt)
			return resp, nil
		}

		lastErr = err
		f.telemetry.Failure(ctx, route, attempt, Classify(err))

		if attempt+1 >= f.maxAttempts || !CanFallback(err) {
			break
		}
	}
	return ChatResponse{}, lastErr
}
```

Test:

```go
func TestFallbackSkipsUnauthorized(t *testing.T) {
	err := GatewayError{Class: ErrorUnauthorized, Err: errors.New("bad key")}
	if CanFallback(err) {
		t.Fatal("unauthorized errors must not fallback")
	}
}
```

## Lesson 5: 队列就是产品承诺

Sources: Bifrost ProviderQueue, Go by Example worker pool, OpenTelemetry exporterhelper queue, NATS slow consumer.

经验：

- 无界队列是隐藏故障。
- 队列满时要明确：拒绝、降级、阻塞、丢弃、死信。
- AI gateway 热路径通常应快速拒绝或降级，不应无限阻塞。

Code:

```go
type Admission struct {
	queue chan Request
}

func (a Admission) Admit(ctx context.Context, req Request) error {
	select {
	case a.queue <- req:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return ErrOverloaded
	}
}
```

## Lesson 6: agent 的事实是事件，不是最终文本

Sources: trpc-agent-go, Temporal, Memos, Syncthing protocol.

经验：

- 用户消息、模型决策、tool call、tool result、assistant message 都要成为事件。
- UI 可以从事件流渲染。
- 崩溃恢复可以从事件流 replay。
- 审计可以从事件流查证。

Code:

```go
type Event struct {
	ID         string
	SessionID  string
	Type       EventType
	ToolCallID string
	Payload    json.RawMessage
	CreatedAt  time.Time
}

type EventStore interface {
	Append(ctx context.Context, event Event) error
	List(ctx context.Context, sessionID string) ([]Event, error)
}
```

## Lesson 7: 状态机要集中，不要散在 handler 里

Sources: Wild Workouts, go-clean-template, Temporal.

经验：

- 状态转移应该由 domain/entity 方法控制。
- handler 只负责把请求转成 command。
- repository 负责持久化，不负责决定状态是否合法。

Code:

```go
func (c *ToolCall) Complete(result string) error {
	if c.Status != ToolRunning {
		return ErrInvalidTransition
	}
	c.Status = ToolCompleted
	c.Result = result
	return nil
}
```

## Lesson 8: 可观测字段要带业务维度

Sources: OpenTelemetry Collector, Bifrost, Tyk analytics, modern-go-application.

经验：

- HTTP status 不够。
- AI gateway 要记录 tenant、model、provider、fallback index、tokens、error class。
- agent 要记录 session、run、node、tool call、event id。

Code:

```go
type GatewayMetrics struct {
	Provider      string
	Model         string
	TenantID      string
	FallbackIndex int
	InputTokens   int
	OutputTokens  int
	ErrorClass    string
	Latency       time.Duration
}
```

## Lesson 9: telemetry 也要异步和有背压

Sources: OpenTelemetry Collector exporterhelper queue, Tyk analytics.

经验：

- 不要在请求热路径同步写慢存储。
- telemetry queue 满了要有策略：drop、sample、block、fallback exporter。
- 观测本身也需要错误和队列指标。

Code:

```go
func (s *TelemetrySink) Record(ctx context.Context, event TelemetryEvent) {
	select {
	case s.queue <- event:
	default:
		s.dropped.Add(1)
	}
}
```

## Lesson 10: 配置更新要经过 validate/provision/cleanup

Sources: Caddy, PocketBase, Bifrost config/plugins.

经验：

- provider 配置不是简单 map。
- 动态更新时要先 validate，再 provision，再原子替换，最后 cleanup old module。

Code:

```go
func (m *Manager) Replace(ctx context.Context, cfg ProviderConfig) error {
	next, err := m.factory.Build(cfg)
	if err != nil {
		return err
	}
	if err := next.Validate(); err != nil {
		return err
	}
	if err := next.Start(ctx); err != nil {
		return err
	}

	old := m.current.Swap(next)
	if old != nil {
		_ = old.Stop(ctx)
	}
	return nil
}
```

## Lesson 11: best-effort 副作用要明确标注

Sources: Memos, notification systems, gateway analytics.

经验：

- 主路径失败必须返回错误。
- 广播、webhook、analytics、通知常常是 best-effort。
- best-effort 失败要记录，但不能悄悄阻塞主路径。

Code:

```go
msg, err := s.messages.Create(ctx, input)
if err != nil {
	return Message{}, err
}

if err := s.webhooks.Publish(ctx, msg); err != nil {
	s.log.Warn("webhook publish failed", "message_id", msg.ID, "err", err)
}
```

## Lesson 12: long-running goroutine 必须有退出协议

Sources: Uber Go Guide, Memos background runner, NATS server lifecycle.

经验：

- goroutine 的输入、输出、错误和退出要明确。
- 不要 fire-and-forget。
- 使用 context、errgroup、close channel 管理生命周期。

Code:

```go
func (r Runner) Run(ctx context.Context) error {
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if err := r.check(ctx); err != nil {
				r.log.Warn("background check failed", "err", err)
			}
		}
	}
}
```

## Lesson 13: 协议比实现更稳定

Sources: Syncthing protocol, NATS subject protocol, OpenAI-compatible API, agent event stream.

经验：

- handler 可以重构，协议要稳定。
- event type、message schema、error code 要谨慎演进。
- 引入 version 字段比后续强行兼容容易。

Code:

```go
type StreamEvent struct {
	Version   string          `json:"version"`
	ID        string          `json:"id"`
	Type      string          `json:"type"`
	SessionID string          `json:"session_id"`
	Data      json.RawMessage `json:"data"`
}
```

## Lesson 14: 测试应该覆盖“决策点”

Sources: Learn Go with Tests, Bifrost fallback tests, trpc-agent-go event converter tests.

经验：

- 不只测 happy path。
- 重点测 fallback 决策、状态转移、事件顺序、queue full、context cancel。

Code:

```go
func TestEventReplayPreservesRunningTool(t *testing.T) {
	events := []Event{
		{Type: EventToolCallStarted, ToolCallID: "tool-1"},
	}
	state := ReplaySession(events)
	if !state.RunningTools["tool-1"] {
		t.Fatal("expected tool-1 to be running after replay")
	}
}
```

## Lesson 15: 目标排序要写在设计前面

Sources: Syncthing GOALS, AI Gateway production constraints.

推荐最终系统目标排序：

```text
1. 不丢 agent session event。
2. 不让 provider 故障拖垮请求池。
3. 成本和额度可控。
4. 每次 provider 决策可观测。
5. API 兼容 OpenAI 风格，便于接入。
6. provider/agent/tool 可扩展。
7. UI 体验流畅。
```

这能帮助做取舍：当“体验更快”和“不丢事件”冲突时，先保护事件。
