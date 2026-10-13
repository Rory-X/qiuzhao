# Large System Blueprints In Go

这份手册把代码片段放回完整系统链路里。它服务最终目标：

```text
AI Gateway + Agent Runtime
  -> provider distribution
  -> high concurrency and backpressure
  -> high availability
  -> observability
  -> durable agent conversation flow
```

Related:

- [`reference-implementations.md`](reference-implementations.md)
- [`mental-models-glossary.md`](mental-models-glossary.md)
- [`ai-gateway-agent-runtime-playbook.md`](ai-gateway-agent-runtime-playbook.md)
- [`production-readiness-checklist.md`](production-readiness-checklist.md)
- [`source-segments/large-system-segments.md`](source-segments/large-system-segments.md)

## 1. Target Package Blueprint

这个结构综合了 `project-layout`、go-kit、Caddy、Bifrost、trpc-agent-go、OpenTelemetry Collector 的边界思想。

```text
cmd/gateway/
  main.go

internal/gateway/httpapi/
  handler.go
  middleware.go
  errors.go
  stream.go

internal/gateway/core/
  service.go
  request.go
  errors.go

internal/gateway/policy/
  policy.go
  store.go

internal/gateway/router/
  route.go
  planner.go
  health.go

internal/gateway/provider/
  client.go
  registry.go
  queue.go
  breaker.go

internal/gateway/fallback/
  executor.go
  taxonomy.go

internal/agent/session/
  session.go
  state.go

internal/agent/event/
  event.go
  store.go
  replay.go

internal/agent/runner/
  runner.go
  model.go

internal/agent/tool/
  tool.go
  executor.go
  registry.go

internal/agent/graph/
  graph.go
  node.go

internal/platform/observability/
  telemetry.go
  pipeline.go
  exporter.go

internal/platform/lifecycle/
  app.go
  component.go

internal/platform/queue/
  queue.go
  worker.go
```

包边界判断：

```text
httpapi: protocol boundary, owns HTTP status and JSON.
core: business usecase, owns gateway orchestration.
policy: tenant permission and quotas.
router: provider selection.
provider: external model APIs and per-provider admission.
fallback: retry/fallback decision.
agent/event: durable conversation facts.
agent/runner: model -> tool -> event loop.
observability: metrics/traces/log events.
lifecycle: app start/stop and graceful drain.
```

## 2. Chat Completion Flow

来源反链：

```text
Bifrost -> provider routing/fallback
Tyk -> auth/policy/quota gateway pipeline
Hertz -> HTTP boundary/middleware
go-kit -> endpoint/service/transport split
OpenTelemetry Collector -> telemetry pipeline
```

链路：

```text
client
  -> HTTP decode
  -> request id + deadline
  -> tenant auth
  -> policy allow
  -> token quota
  -> route plan
  -> provider queue
  -> provider client
  -> fallback executor
  -> response normalize
  -> telemetry async export
```

核心 service：

```go
type GatewayService struct {
	policies  PolicyEngine
	limiter   TokenLimiter
	router    Router
	fallback  FallbackExecutor
	telemetry TelemetrySink
}

func (s GatewayService) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	start := time.Now()
	policy, err := s.policies.Allow(ctx, req)
	if err != nil {
		s.record(ctx, req, start, err)
		return ChatResponse{}, err
	}

	key := string(req.TenantID) + ":" + string(req.Model)
	if err := s.limiter.Consume(ctx, key, req.EstimatedTokens()); err != nil {
		s.record(ctx, req, start, err)
		return ChatResponse{}, err
	}

	plan, err := s.router.Plan(req, policy)
	if err != nil {
		s.record(ctx, req, start, err)
		return ChatResponse{}, err
	}

	resp, err := s.fallback.Try(ctx, plan, req)
	s.record(ctx, req, start, err)
	return resp, err
}

func (s GatewayService) record(ctx context.Context, req ChatRequest, start time.Time, err error) {
	if s.telemetry == nil {
		return
	}
	s.telemetry.Record(ctx, TelemetryEvent{
		Name:       "gateway.chat",
		RequestID:  string(req.RequestID),
		TenantID:   string(req.TenantID),
		Model:      string(req.Model),
		Provider:   string(req.Provider),
		LatencyMS:  time.Since(start).Milliseconds(),
		ErrorClass: string(Classify(err)),
	})
}
```

HTTP wiring：

```go
func BuildHTTP(service ChatService, logger *slog.Logger) http.Handler {
	handler := httpapi.NewHandler(service)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/chat/completions", handler.Chat)

	return Chain(
		mux,
		WithRequestID(newRequestID),
		WithDeadline(60*time.Second),
		WithAccessLog(logger),
		WithRecover(logger),
	)
}
```

## 3. Provider Fallback Flow

来源反链：

```text
Bifrost -> fallback chain
Tyk -> upstream proxy failures and policy
Temporal -> retry budget and deterministic command thinking
```

链路：

```text
route plan [primary, fallback1, fallback2]
  -> attempt primary
  -> classify error
  -> stop if non-retryable
  -> stop if context deadline
  -> attempt fallback
  -> record every attempt
```

Fallback attempt structure：

```go
type Attempt struct {
	Index    int
	Route    Route
	Started  time.Time
	Finished time.Time
	Err      error
}

type AttemptLog struct {
	mu       sync.Mutex
	attempts []Attempt
}

func (l *AttemptLog) Record(route Route, index int, started time.Time, err error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.attempts = append(l.attempts, Attempt{
		Index:    index,
		Route:    route,
		Started:  started,
		Finished: time.Now(),
		Err:      err,
	})
}
```

Decision function：

```go
func ShouldContinueFallback(ctx context.Context, err error, remaining []Route) bool {
	if err == nil {
		return false
	}
	if ctx.Err() != nil {
		return false
	}
	if len(remaining) == 0 {
		return false
	}
	return CanFallback(err)
}
```

Table test：

```go
func TestShouldContinueFallback(t *testing.T) {
	tests := []struct {
		name      string
		err       error
		remaining []Route
		want      bool
	}{
		{
			name:      "timeout with fallback",
			err:       GatewayError{Class: ErrorTimeout, Err: context.DeadlineExceeded},
			remaining: []Route{{Provider: "backup"}},
			want:      true,
		},
		{
			name:      "invalid input stops",
			err:       GatewayError{Class: ErrorInvalidInput, Err: errors.New("bad request")},
			remaining: []Route{{Provider: "backup"}},
			want:      false,
		},
		{
			name:      "no remaining route stops",
			err:       GatewayError{Class: ErrorProviderError, Err: errors.New("500")},
			remaining: nil,
			want:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ShouldContinueFallback(context.Background(), tt.err, tt.remaining)
			if got != tt.want {
				t.Fatalf("want %v got %v", tt.want, got)
			}
		})
	}
}
```

## 4. Streaming Chat Flow

来源反链：

```text
Memos -> SSE style server lifecycle and event broadcast
NATS -> slow consumer and fan-out policy
trpc-agent-go -> structured streaming events
Bifrost -> streaming provider response normalization
```

链路：

```text
client opens SSE
  -> gateway creates stream id
  -> provider stream yields chunks
  -> chunks normalized to StreamEvent
  -> bus fan-out to client
  -> slow consumer policy drops or disconnects
  -> final usage event records tokens/cost
```

Stream interface：

```go
type ChatStream interface {
	Recv(ctx context.Context) (StreamEvent, error)
	Close() error
}

type StreamingProvider interface {
	StreamChat(ctx context.Context, req ChatRequest) (ChatStream, error)
}

type StreamNormalizer struct {
	provider ProviderName
}

func (n StreamNormalizer) Normalize(raw StreamEvent) StreamEvent {
	raw.Type = "provider." + raw.Type
	raw.CreatedAt = time.Now()
	return raw
}
```

Gateway stream loop：

```go
func StreamProvider(ctx context.Context, stream ChatStream, out chan<- StreamEvent) error {
	defer stream.Close()
	for {
		event, err := stream.Recv(ctx)
		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}
		select {
		case out <- event:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}
```

Slow consumer policy：

```go
type SlowConsumerPolicy string

const (
	DropNewest    SlowConsumerPolicy = "drop_newest"
	Disconnect    SlowConsumerPolicy = "disconnect"
	DeadLetter    SlowConsumerPolicy = "dead_letter"
)

func PublishWithPolicy(sub Subscriber, event StreamEvent, policy SlowConsumerPolicy, dlq chan<- StreamEvent) error {
	select {
	case sub.C <- event:
		return nil
	default:
		switch policy {
		case DropNewest:
			return nil
		case DeadLetter:
			select {
			case dlq <- event:
			default:
			}
			return nil
		case Disconnect:
			return ErrSlowConsumer
		default:
			return ErrSlowConsumer
		}
	}
}
```

## 5. Agent Run Flow

来源反链：

```text
trpc-agent-go -> Agent / Runner / Event / Tool / Graph
Temporal -> durable event history and replay
Memos -> event stream to UI
Wild Workouts -> domain state transition
```

链路：

```text
POST /sessions/{id}/runs
  -> append UserMessage
  -> replay state
  -> model decides next step
  -> append ToolCallStarted
  -> execute tool with timeout
  -> append ToolCallFinished or Failed
  -> replay state
  -> append AssistantMessage
  -> append RunCompleted
  -> stream every event to UI
```

Run status state machine：

```go
type RunStatus string

const (
	RunPending   RunStatus = "pending"
	RunRunning   RunStatus = "running"
	RunCompleted RunStatus = "completed"
	RunFailed    RunStatus = "failed"
	RunCanceled  RunStatus = "canceled"
)

type Run struct {
	ID        string
	SessionID string
	Status    RunStatus
	StartedAt time.Time
	EndedAt   time.Time
}

func (r *Run) Transition(next RunStatus) error {
	switch r.Status {
	case RunCompleted, RunFailed, RunCanceled:
		return ErrTerminalState
	case RunPending:
		if next != RunRunning && next != RunCanceled {
			return fmt.Errorf("pending -> %s: %w", next, ErrInvalidTransition)
		}
	case RunRunning:
		if next != RunCompleted && next != RunFailed && next != RunCanceled {
			return fmt.Errorf("running -> %s: %w", next, ErrInvalidTransition)
		}
	}
	r.Status = next
	if next == RunCompleted || next == RunFailed || next == RunCanceled {
		r.EndedAt = time.Now()
	}
	return nil
}
```

Agent HTTP boundary：

```go
type RunService interface {
	StartRun(ctx context.Context, sessionID string, input string) (Run, error)
}

func (h Handler) StartRun(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("sessionID")
	var body struct {
		Input string `json:"input"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, err)
		return
	}

	run, err := h.runs.StartRun(r.Context(), sessionID, body.Input)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusAccepted, run)
}
```

## 6. Tool Call Flow

来源反链：

```text
trpc-agent-go -> tool abstraction
Temporal -> activity boundary
OpenTelemetry Collector -> per-tool telemetry
```

链路：

```text
model emits tool call
  -> validate tool name
  -> validate input schema
  -> append started event
  -> invoke with timeout
  -> classify error
  -> append result event
  -> record latency and error class
```

Tool telemetry wrapper：

```go
type ToolEndpoint func(context.Context, json.RawMessage) (json.RawMessage, error)

func WithToolTelemetry(name string, telemetry TelemetrySink, next ToolEndpoint) ToolEndpoint {
	return func(ctx context.Context, input json.RawMessage) (json.RawMessage, error) {
		start := time.Now()
		out, err := next(ctx, input)
		telemetry.Record(ctx, TelemetryEvent{
			Name:       "agent.tool",
			LatencyMS:  time.Since(start).Milliseconds(),
			ErrorClass: string(Classify(err)),
			Attributes: map[string]string{
				"tool.name": name,
			},
		})
		return out, err
	}
}
```

Tool permission guard：

```go
type ToolPolicy struct {
	AllowedByTenant map[TenantID]map[string]bool
}

func (p ToolPolicy) Allow(tenant TenantID, toolName string) error {
	allowed := p.AllowedByTenant[tenant]
	if !allowed[toolName] {
		return GatewayError{Class: ErrorUnauthorized, Err: fmt.Errorf("tool %s not allowed", toolName)}
	}
	return nil
}
```

## 7. RAG Subflow For Agent

来源反链：

```text
awesome-architecture RAG -> document/chunk/retrieve/rerank/citation
trpc-agent-go -> retrieval as tool
OpenTelemetry -> retrieval latency and hit quality
```

链路：

```text
agent wants knowledge
  -> retrieval tool
  -> permission filter by tenant/project
  -> vector/top-k retrieval
  -> rerank
  -> citations returned as tool result
  -> model answers with citations
```

RAG interface：

```go
type DocumentChunk struct {
	ID         string
	TenantID   TenantID
	DocumentID string
	Text       string
	Score      float64
	Metadata   map[string]string
}

type Retriever interface {
	Retrieve(ctx context.Context, tenant TenantID, query string, topK int) ([]DocumentChunk, error)
}

type Reranker interface {
	Rerank(ctx context.Context, query string, chunks []DocumentChunk) ([]DocumentChunk, error)
}

type RAGTool struct {
	retriever Retriever
	reranker  Reranker
	tenant    TenantID
}

func (t RAGTool) Name() string { return "knowledge_search" }

func (t RAGTool) Invoke(ctx context.Context, input json.RawMessage) (json.RawMessage, error) {
	var req struct {
		Query string `json:"query"`
		TopK  int    `json:"top_k"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		return nil, err
	}
	if req.TopK <= 0 {
		req.TopK = 5
	}
	chunks, err := t.retriever.Retrieve(ctx, t.tenant, req.Query, req.TopK*3)
	if err != nil {
		return nil, err
	}
	chunks, err = t.reranker.Rerank(ctx, req.Query, chunks)
	if err != nil {
		return nil, err
	}
	if len(chunks) > req.TopK {
		chunks = chunks[:req.TopK]
	}
	return json.Marshal(chunks)
}
```

## 8. Telemetry Flow

来源反链：

```text
OpenTelemetry Collector -> receiver/processor/exporter
Bifrost -> AI gateway provider/model/tokens dimensions
Tyk -> gateway analytics pipeline
Memos -> background async side effects
```

链路：

```text
hot path creates TelemetryEvent
  -> async queue
  -> processors enrich/drop/sample
  -> exporter writes metrics/traces/logs
  -> dropped counter tracks overload
```

Processor examples：

```go
type TenantRedactor struct{}

func (TenantRedactor) Process(ctx context.Context, event TelemetryEvent) (TelemetryEvent, error) {
	if event.TenantID != "" {
		event.Attributes["tenant.hash"] = sha256Hex(event.TenantID)
		event.TenantID = ""
	}
	return event, nil
}

type ErrorSampler struct {
	KeepSuccessEvery int
	count atomic.Int64
}

func (s *ErrorSampler) Process(ctx context.Context, event TelemetryEvent) (TelemetryEvent, error) {
	if event.ErrorClass != "" {
		return event, nil
	}
	n := s.count.Add(1)
	if s.KeepSuccessEvery > 0 && n%int64(s.KeepSuccessEvery) != 0 {
		return TelemetryEvent{}, ErrDropTelemetry
	}
	return event, nil
}
```

Exporter boundary：

```go
type MetricsExporter struct {
	requests *prometheus.CounterVec
	latency  *prometheus.HistogramVec
}

func (e MetricsExporter) Export(ctx context.Context, event TelemetryEvent) error {
	e.requests.WithLabelValues(event.Name, event.Provider, event.Model, event.ErrorClass).Inc()
	e.latency.WithLabelValues(event.Name, event.Provider, event.Model).Observe(float64(event.LatencyMS) / 1000)
	return nil
}
```

## 9. High Availability Flow

来源反链：

```text
Caddy -> app lifecycle and config reload
NATS -> long-running server shutdown and slow consumer thinking
Temporal -> worker model and task durability
modern-go-application -> production app composition
```

链路：

```text
start config
  -> validate providers and policies
  -> start HTTP server
  -> start provider queues
  -> start telemetry exporter
  -> readiness true
  -> signal received
  -> readiness false
  -> stop accepting requests
  -> drain queues
  -> flush telemetry
  -> shutdown
```

Readiness gate：

```go
type Readiness struct {
	ready atomic.Bool
}

func (r *Readiness) MarkReady()    { r.ready.Store(true) }
func (r *Readiness) MarkNotReady() { r.ready.Store(false) }

func (r *Readiness) Handler(w http.ResponseWriter, req *http.Request) {
	if !r.ready.Load() {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte("not ready"))
		return
	}
	_, _ = w.Write([]byte("ok"))
}
```

Signal handling：

```go
func RootContext() context.Context {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	go func() {
		<-ctx.Done()
		stop()
	}()
	return ctx
}
```

Draining queue：

```go
type Drainable interface {
	Drain(ctx context.Context) error
}

func DrainAll(ctx context.Context, components []Drainable) error {
	for _, component := range components {
		if err := component.Drain(ctx); err != nil {
			return err
		}
	}
	return nil
}
```

## 10. Deployment And Capacity Blueprint

大系统学习不能只写代码，还要知道容量参数放在哪里。

```go
type Config struct {
	HTTP struct {
		Addr            string
		ReadTimeout     time.Duration
		WriteTimeout    time.Duration
		ShutdownTimeout time.Duration
	}
	Providers map[ProviderName]ProviderConfig
	Policy    PolicyConfig
	Telemetry TelemetryConfig
}

type ProviderConfig struct {
	BaseURL       string
	APIKeyEnv     string
	Timeout       time.Duration
	QueueCapacity int
	Workers       int
	Breaker       BreakerConfig
}

type BreakerConfig struct {
	FailureThreshold int
	Cooldown         time.Duration
}

type TelemetryConfig struct {
	QueueCapacity int
	SampleSuccessEvery int
}
```

容量初始值：

```text
provider queue capacity = workers * p95_latency_seconds * target_rps_per_worker
request timeout = provider_timeout + fallback_budget + small_transport_margin
worker count = min(provider_limit, cpu_budget, tenant_quota_budget)
telemetry queue = peak_rps * flush_interval_seconds
```

学习版容量估算函数：

```go
func QueueCapacity(workers int, p95Latency time.Duration, rpsPerWorker int) int {
	if workers < 1 {
		workers = 1
	}
	seconds := int(math.Ceil(p95Latency.Seconds()))
	if seconds < 1 {
		seconds = 1
	}
	return workers * seconds * rpsPerWorker
}
```

## 11. Blueprint To Local Labs

| Flow | First local lab | GitHub source anchors |
|---|---|---|
| Runnable composition root | `capstone_ai_gateway_agent_runtime/internal/app`, `cmd/gateway` | project-layout, modern-go-application, Caddy |
| Chat completion route/fallback | `capstone_ai_gateway_agent_runtime/internal/gateway/core` | Bifrost, Tyk, go-kit |
| Provider queue/admission | `capstone_ai_gateway_agent_runtime/internal/gateway/provider` | Bifrost, Hertz, OTel queue helpers |
| Agent run/event replay | `capstone_ai_gateway_agent_runtime/internal/agent/event` | trpc-agent-go, Temporal |
| Graph node transition/human interrupt | `capstone_ai_gateway_agent_runtime/internal/agent/graph` | trpc-agent-go GraphAgent, Temporal command validation |
| Tool execution | `capstone_ai_gateway_agent_runtime/internal/agent/tool` | trpc-agent-go, Temporal activity boundary |
| SSE event stream | `capstone_ai_gateway_agent_runtime/internal/agent/stream` | Memos, NATS |
| Telemetry async export | `capstone_ai_gateway_agent_runtime/internal/platform/telemetry` | OpenTelemetry Collector, Tyk analytics |
| Request audit and cost log | `capstone_ai_gateway_agent_runtime/internal/gateway/audit` | Bifrost, Tyk, Syncthing |
| Idempotent side effects | `capstone_ai_gateway_agent_runtime/internal/platform/idempotency` | Temporal, Memos, Notification template |
| App lifecycle | `capstone_ai_gateway_agent_runtime/internal/platform/lifecycle` | Caddy, modern-go-application, NATS |

最小实现顺序：

```text
Week 1: Router + fallback + tests.
Week 2: Provider queue + rate limit + timeout.
Week 3: Agent event store + replay + runner.
Week 4: Tool executor + RAG tool.
Week 5: Telemetry pipeline + async exporter.
Week 6: App lifecycle + graceful shutdown + readiness.
```
