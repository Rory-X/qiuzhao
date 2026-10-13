# Go Reference Implementations For Large Systems

这份手册是“代码优先”的参考实现层：把 GitHub 材料里反复出现的架构能力，翻译成可以直接改造成 `gateway_lab`、`agent_runtime_lab`、`observability_lab` 的 Go 骨架。

这些代码不是上游仓库源码复制，而是学习版转译。读法是：

```text
GitHub source -> design segment -> Go reference snippet -> future local lab
```

Related:

- [`go-code-patterns.md`](go-code-patterns.md)
- [`system-blueprints.md`](system-blueprints.md)
- [`mental-models-glossary.md`](mental-models-glossary.md)
- [`ai-gateway-agent-runtime-playbook.md`](ai-gateway-agent-runtime-playbook.md)
- [`capstone-implementation-manual.md`](capstone-implementation-manual.md)
- [`traceability-matrix.md`](traceability-matrix.md)

## Source Coverage

| Source | What to extract | Snippet families |
|---|---|---|
| [maximhq/bifrost](https://github.com/maximhq/bifrost) | provider routing, fallback, provider queue, observability | `Gateway`, `Router`, `FallbackExecutor`, `ProviderQueue` |
| [trpc-group/trpc-agent-go](https://github.com/trpc-group/trpc-agent-go) | agent, runner, event, tool, graph | `EventStore`, `Runner`, `ToolExecutor`, `Graph` |
| [TykTechnologies/tyk](https://github.com/TykTechnologies/tyk) | gateway middleware, policy, quota, analytics | `Middleware`, `PolicyEngine`, `Limiter`, `AsyncAnalytics` |
| [cloudwego/hertz](https://github.com/cloudwego/hertz) | high-throughput HTTP boundary, middleware, request context | `HTTPAdapter`, `Chain`, `Deadline` |
| [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector) | receiver/processor/exporter pipeline | `TelemetryPipeline`, `AsyncExporter` |
| [temporalio/temporal](https://github.com/temporalio/temporal) | durable history, replay, worker/task queue | `EventHistory`, `Replay`, `Worker` |
| [nats-io/nats-server](https://github.com/nats-io/nats-server) | pub/sub, slow consumer, persistence boundary | `Bus`, `SlowConsumerPolicy`, `DLQ` |
| [Caddy](https://github.com/caddyserver/caddy) | module lifecycle and dynamic config | `Component`, `ProviderModule` |
| [Memos](https://github.com/usememos/memos) | server lifecycle, SSE, best-effort side effects | `EventStream`, `BackgroundRunner` |
| [go-kit/examples](https://github.com/go-kit/examples) | service/endpoint/transport split | `Endpoint`, `EndpointMiddleware` |

## 1. Shared Domain Types

学习目标：先给大系统稳定词汇。AI 网关和 Agent Runtime 都要围绕 tenant、request、route、event、trace 组织。

```go
package gateway

import (
	"context"
	"errors"
	"fmt"
	"time"
)

type TenantID string
type RequestID string
type ProviderName string
type ModelName string

type ChatRequest struct {
	RequestID RequestID
	TenantID  TenantID
	Model     ModelName
	Provider  ProviderName
	Messages  []Message
	Stream    bool
	Metadata  map[string]string
}

type Message struct {
	Role    string
	Content string
}

type ChatResponse struct {
	RequestID    RequestID
	Provider     ProviderName
	Model        ModelName
	Content      string
	InputTokens  int
	OutputTokens int
}

func (r ChatRequest) EstimatedTokens() int {
	total := 0
	for _, msg := range r.Messages {
		total += 4 + len(msg.Content)/4
	}
	if total < 1 {
		return 1
	}
	return total
}
```

关键迁移：

```text
Go 101 / Google styleguide -> small named types
Bifrost / Tyk -> tenant, provider, route, policy all become explicit data
OpenTelemetry Collector -> every event has dimensions, not loose strings
```

## 2. Error Taxonomy

学习目标：fallback 和 retry 不能只看 `err != nil`。错误必须分类。

```go
type ErrorClass string

const (
	ErrorTimeout       ErrorClass = "timeout"
	ErrorRateLimited   ErrorClass = "rate_limited"
	ErrorInvalidInput  ErrorClass = "invalid_input"
	ErrorUnauthorized  ErrorClass = "unauthorized"
	ErrorQuotaExceeded ErrorClass = "quota_exceeded"
	ErrorProviderError ErrorClass = "provider_error"
	ErrorOverloaded    ErrorClass = "overloaded"
)

var (
	ErrNoProvider     = errors.New("no provider available")
	ErrQueueFull      = errors.New("provider queue full")
	ErrRetryBudget    = errors.New("retry budget exhausted")
	ErrInvalidRoute   = errors.New("invalid route")
	ErrTerminalState  = errors.New("terminal state")
	ErrToolNotFound   = errors.New("tool not found")
	ErrSlowConsumer   = errors.New("slow consumer")
)

type GatewayError struct {
	Class    ErrorClass
	Provider ProviderName
	Err      error
}

func (e GatewayError) Error() string {
	if e.Provider == "" {
		return fmt.Sprintf("%s: %v", e.Class, e.Err)
	}
	return fmt.Sprintf("%s/%s: %v", e.Provider, e.Class, e.Err)
}

func (e GatewayError) Unwrap() error { return e.Err }

func Classify(err error) ErrorClass {
	if err == nil {
		return ""
	}
	var ge GatewayError
	if errors.As(err, &ge) {
		return ge.Class
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return ErrorTimeout
	}
	if errors.Is(err, ErrQueueFull) {
		return ErrorOverloaded
	}
	return ErrorProviderError
}

func CanFallback(err error) bool {
	switch Classify(err) {
	case ErrorTimeout, ErrorRateLimited, ErrorProviderError, ErrorOverloaded:
		return true
	default:
		return false
	}
}
```

反链：

```text
Bifrost fallback -> ErrorClass -> FallbackExecutor
Tyk quota/policy -> non-retryable tenant errors
Temporal retry thinking -> retry only commands that are safe
```

## 3. HTTP Boundary

学习目标：HTTP handler 只负责协议适配，不把 provider 选择、限流、tool 调用塞在 handler 里。

```go
package httpapi

import (
	"encoding/json"
	"net/http"

	"example.com/app/internal/gateway"
)

type ChatService interface {
	Chat(ctx context.Context, req gateway.ChatRequest) (gateway.ChatResponse, error)
}

type Handler struct {
	chat ChatService
}

func NewHandler(chat ChatService) Handler {
	return Handler{chat: chat}
}

func (h Handler) Chat(w http.ResponseWriter, r *http.Request) {
	req, err := DecodeChatRequest(r)
	if err != nil {
		WriteError(w, err)
		return
	}

	resp, err := h.chat.Chat(r.Context(), req)
	if err != nil {
		WriteError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, resp)
}

func DecodeChatRequest(r *http.Request) (gateway.ChatRequest, error) {
	defer r.Body.Close()

	var req gateway.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return gateway.ChatRequest{}, gateway.GatewayError{
			Class: gateway.ErrorInvalidInput,
			Err:   err,
		}
	}
	req.RequestID = gateway.RequestID(r.Header.Get("X-Request-ID"))
	req.TenantID = gateway.TenantID(r.Header.Get("X-Tenant-ID"))
	return req, nil
}

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
```

`WriteError` 也应该按错误分类映射状态码：

```go
func WriteError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	switch gateway.Classify(err) {
	case gateway.ErrorInvalidInput:
		status = http.StatusBadRequest
	case gateway.ErrorUnauthorized:
		status = http.StatusUnauthorized
	case gateway.ErrorQuotaExceeded, gateway.ErrorRateLimited:
		status = http.StatusTooManyRequests
	case gateway.ErrorTimeout:
		status = http.StatusGatewayTimeout
	case gateway.ErrorOverloaded:
		status = http.StatusServiceUnavailable
	}

	WriteJSON(w, status, map[string]string{
		"error": err.Error(),
		"class": string(gateway.Classify(err)),
	})
}
```

## 4. Middleware Chain

学习目标：把 Tyk/Hertz 的入口管道翻译成标准库也能实现的结构。

```go
type Middleware func(http.Handler) http.Handler

func Chain(h http.Handler, mws ...Middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

func WithDeadline(timeout time.Duration) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func WithRequestID(newID func() string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := r.Header.Get("X-Request-ID")
			if id == "" {
				id = newID()
			}
			w.Header().Set("X-Request-ID", id)
			ctx := context.WithValue(r.Context(), requestIDKey{}, gateway.RequestID(id))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

type requestIDKey struct{}

func RequestIDFromContext(ctx context.Context) gateway.RequestID {
	id, _ := ctx.Value(requestIDKey{}).(gateway.RequestID)
	return id
}
```

## 5. Policy And Quota

学习目标：网关策略是数据，不应该散落成 handler 里的 if/else。

```go
type TenantPolicy struct {
	TenantID          TenantID
	AllowedModels     map[ModelName]bool
	AllowedProviders  map[ProviderName]bool
	RequestsPerMinute int
	TokensPerDay      int
	AllowFallbacks    bool
}

type PolicyStore interface {
	Get(ctx context.Context, tenant TenantID) (TenantPolicy, error)
}

type PolicyEngine struct {
	store PolicyStore
}

func (p PolicyEngine) Allow(ctx context.Context, req ChatRequest) (TenantPolicy, error) {
	policy, err := p.store.Get(ctx, req.TenantID)
	if err != nil {
		return TenantPolicy{}, err
	}
	if !policy.AllowedModels[req.Model] {
		return TenantPolicy{}, GatewayError{Class: ErrorUnauthorized, Err: fmt.Errorf("model %s not allowed", req.Model)}
	}
	if req.Provider != "" && !policy.AllowedProviders[req.Provider] {
		return TenantPolicy{}, GatewayError{Class: ErrorUnauthorized, Err: fmt.Errorf("provider %s not allowed", req.Provider)}
	}
	return policy, nil
}
```

一个学习版 token budget：

```go
type TokenLimiter interface {
	Consume(ctx context.Context, key string, tokens int) error
}

type MemoryTokenLimiter struct {
	mu     sync.Mutex
	limit  int
	used   map[string]int
	window time.Time
}

func NewMemoryTokenLimiter(limit int) *MemoryTokenLimiter {
	return &MemoryTokenLimiter{
		limit:  limit,
		used:   map[string]int{},
		window: time.Now().Truncate(time.Minute),
	}
}

func (l *MemoryTokenLimiter) Consume(ctx context.Context, key string, tokens int) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	nowWindow := time.Now().Truncate(time.Minute)
	if nowWindow.After(l.window) {
		l.window = nowWindow
		l.used = map[string]int{}
	}
	if l.used[key]+tokens > l.limit {
		return GatewayError{Class: ErrorRateLimited, Err: fmt.Errorf("token budget exceeded")}
	}
	l.used[key] += tokens
	return nil
}
```

## 6. Router And Route Plan

学习目标：provider selection 是 AI Gateway 的核心，不应被藏在 SDK client 里。

```go
type ProviderSnapshot struct {
	Name          ProviderName
	Models        map[ModelName]bool
	Healthy       bool
	CurrentLoad   int
	MaxInFlight   int
	Priority      int
	CostPer1KToken float64
}

type Route struct {
	Provider ProviderName
	Model    ModelName
	Reason   string
}

type RoutePlan struct {
	Primary   Route
	Fallbacks []Route
}

type Router struct {
	providers []ProviderSnapshot
}

func NewRouter(providers []ProviderSnapshot) Router {
	return Router{providers: append([]ProviderSnapshot(nil), providers...)}
}

func (r Router) Plan(req ChatRequest, policy TenantPolicy) (RoutePlan, error) {
	var candidates []ProviderSnapshot
	for _, p := range r.providers {
		if !p.Healthy || !p.Models[req.Model] || !policy.AllowedProviders[p.Name] {
			continue
		}
		if p.MaxInFlight > 0 && p.CurrentLoad >= p.MaxInFlight {
			continue
		}
		if req.Provider != "" && p.Name != req.Provider {
			continue
		}
		candidates = append(candidates, p)
	}
	if len(candidates) == 0 {
		return RoutePlan{}, GatewayError{Class: ErrorOverloaded, Err: ErrNoProvider}
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].Priority != candidates[j].Priority {
			return candidates[i].Priority < candidates[j].Priority
		}
		return candidates[i].CurrentLoad < candidates[j].CurrentLoad
	})

	plan := RoutePlan{
		Primary: Route{Provider: candidates[0].Name, Model: req.Model, Reason: "best_available"},
	}
	if policy.AllowFallbacks {
		for _, p := range candidates[1:] {
			plan.Fallbacks = append(plan.Fallbacks, Route{
				Provider: p.Name,
				Model:    req.Model,
				Reason:   "fallback",
			})
		}
	}
	return plan, nil
}
```

## 7. Fallback Executor

学习目标：fallback loop 要处理 context、错误分类、retry budget 和 telemetry。

```go
type ProviderClient interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type ProviderRegistry interface {
	Get(name ProviderName) (ProviderClient, bool)
}

type AttemptRecorder interface {
	ProviderAttempt(ctx context.Context, route Route, attempt int, latency time.Duration, err error)
}

type FallbackExecutor struct {
	providers ProviderRegistry
	recorder  AttemptRecorder
}

func (f FallbackExecutor) Try(ctx context.Context, plan RoutePlan, req ChatRequest) (ChatResponse, error) {
	routes := append([]Route{plan.Primary}, plan.Fallbacks...)
	var lastErr error

	for attempt, route := range routes {
		if ctx.Err() != nil {
			return ChatResponse{}, ctx.Err()
		}
		client, ok := f.providers.Get(route.Provider)
		if !ok {
			lastErr = GatewayError{Class: ErrorInvalidInput, Provider: route.Provider, Err: ErrInvalidRoute}
			continue
		}

		start := time.Now()
		resp, err := client.Chat(ctx, req.WithRoute(route))
		if f.recorder != nil {
			f.recorder.ProviderAttempt(ctx, route, attempt, time.Since(start), err)
		}
		if err == nil {
			return resp, nil
		}
		lastErr = err
		if !CanFallback(err) {
			break
		}
	}

	if lastErr == nil {
		lastErr = ErrNoProvider
	}
	return ChatResponse{}, lastErr
}

func (r ChatRequest) WithRoute(route Route) ChatRequest {
	r.Provider = route.Provider
	r.Model = route.Model
	return r
}
```

## 8. Provider Queue And Admission Control

学习目标：高并发入口要先 admission，再做昂贵 provider call。队列必须有容量和溢出策略。

```go
type ProviderJob struct {
	Req   ChatRequest
	Run   func(context.Context, ChatRequest) (ChatResponse, error)
	Reply chan ProviderResult
}

type ProviderResult struct {
	Resp ChatResponse
	Err  error
}

type ProviderQueue struct {
	name ProviderName
	jobs chan ProviderJob
}

func NewProviderQueue(name ProviderName, capacity int) *ProviderQueue {
	if capacity < 1 {
		capacity = 1
	}
	return &ProviderQueue{name: name, jobs: make(chan ProviderJob, capacity)}
}

func (q *ProviderQueue) TrySubmit(job ProviderJob) error {
	select {
	case q.jobs <- job:
		return nil
	default:
		return GatewayError{Class: ErrorOverloaded, Provider: q.name, Err: ErrQueueFull}
	}
}

func (q *ProviderQueue) Start(ctx context.Context, workers int) {
	for i := 0; i < workers; i++ {
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case job := <-q.jobs:
					resp, err := job.Run(ctx, job.Req)
					select {
					case job.Reply <- ProviderResult{Resp: resp, Err: err}:
					case <-ctx.Done():
					}
				}
			}
		}()
	}
}
```

队列包装成 provider client：

```go
type QueuedProvider struct {
	queue  *ProviderQueue
	client ProviderClient
}

func (p QueuedProvider) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	reply := make(chan ProviderResult, 1)
	job := ProviderJob{
		Req:   req,
		Run:   p.client.Chat,
		Reply: reply,
	}
	if err := p.queue.TrySubmit(job); err != nil {
		return ChatResponse{}, err
	}

	select {
	case result := <-reply:
		return result.Resp, result.Err
	case <-ctx.Done():
		return ChatResponse{}, ctx.Err()
	}
}
```

## 9. Circuit Breaker Skeleton

学习目标：连续 provider error 不应该无限把流量打过去。学习版 breaker 先做状态转换。

```go
type BreakerState string

const (
	BreakerClosed   BreakerState = "closed"
	BreakerOpen     BreakerState = "open"
	BreakerHalfOpen BreakerState = "half_open"
)

type Breaker struct {
	mu          sync.Mutex
	state       BreakerState
	failures    int
	threshold   int
	openedAt    time.Time
	cooldown    time.Duration
}

func NewBreaker(threshold int, cooldown time.Duration) *Breaker {
	return &Breaker{state: BreakerClosed, threshold: threshold, cooldown: cooldown}
}

func (b *Breaker) Allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.state == BreakerOpen && time.Since(b.openedAt) >= b.cooldown {
		b.state = BreakerHalfOpen
		return true
	}
	return b.state != BreakerOpen
}

func (b *Breaker) Record(err error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if err == nil {
		b.failures = 0
		b.state = BreakerClosed
		return
	}
	if !CanFallback(err) {
		return
	}
	b.failures++
	if b.failures >= b.threshold {
		b.state = BreakerOpen
		b.openedAt = time.Now()
	}
}
```

## 10. Agent Event Store

学习目标：Agent 事件不是日志，它是可重放的事实。Temporal 的 history 思想要落成 append-only event。

```go
package agent

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"sync"
	"time"
)

type EventType string

const (
	EventUserMessage       EventType = "user_message"
	EventAssistantMessage  EventType = "assistant_message"
	EventModelStarted      EventType = "model_started"
	EventToolCallStarted   EventType = "tool_call_started"
	EventToolCallFinished  EventType = "tool_call_finished"
	EventToolCallFailed    EventType = "tool_call_failed"
	EventRunCompleted      EventType = "run_completed"
	EventRunFailed         EventType = "run_failed"
)

type Event struct {
	ID         string
	SessionID  string
	RunID      string
	Type       EventType
	Content    string
	ToolName   string
	ToolCallID string
	Payload    json.RawMessage
	CreatedAt  time.Time
}

type EventStore interface {
	Append(ctx context.Context, sessionID string, event Event) error
	List(ctx context.Context, sessionID string) ([]Event, error)
}

type MemoryEventStore struct {
	mu     sync.Mutex
	events map[string][]Event
}

func NewMemoryEventStore() *MemoryEventStore {
	return &MemoryEventStore{events: map[string][]Event{}}
}

func (s *MemoryEventStore) Append(ctx context.Context, sessionID string, event Event) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if event.ID == "" {
		return errors.New("event id is required")
	}
	event.SessionID = sessionID
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now()
	}
	s.events[sessionID] = append(s.events[sessionID], event)
	return nil
}

func (s *MemoryEventStore) List(ctx context.Context, sessionID string) ([]Event, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	out := append([]Event(nil), s.events[sessionID]...)
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].CreatedAt.Before(out[j].CreatedAt)
	})
	return out, nil
}
```

## 11. Agent Replay

学习目标：每次恢复 session 都能从 event history 推导状态。

```go
type SessionState struct {
	SessionID    string
	Messages     []Message
	RunningTools map[string]string
	Completed    bool
	Failed       bool
}

func Replay(sessionID string, events []Event) SessionState {
	state := SessionState{
		SessionID:    sessionID,
		RunningTools: map[string]string{},
	}
	for _, event := range events {
		switch event.Type {
		case EventUserMessage:
			state.Messages = append(state.Messages, Message{Role: "user", Content: event.Content})
		case EventAssistantMessage:
			state.Messages = append(state.Messages, Message{Role: "assistant", Content: event.Content})
		case EventToolCallStarted:
			state.RunningTools[event.ToolCallID] = event.ToolName
		case EventToolCallFinished, EventToolCallFailed:
			delete(state.RunningTools, event.ToolCallID)
		case EventRunCompleted:
			state.Completed = true
		case EventRunFailed:
			state.Failed = true
		}
	}
	return state
}
```

## 12. Tool Executor

学习目标：tool 是外部副作用边界，必须有 timeout、schema、审计事件和错误事件。

```go
type Tool interface {
	Name() string
	Schema() json.RawMessage
	Invoke(ctx context.Context, input json.RawMessage) (json.RawMessage, error)
}

type ToolRegistry struct {
	tools map[string]Tool
}

func NewToolRegistry(tools ...Tool) ToolRegistry {
	registry := ToolRegistry{tools: map[string]Tool{}}
	for _, tool := range tools {
		registry.tools[tool.Name()] = tool
	}
	return registry
}

func (r ToolRegistry) Get(name string) (Tool, bool) {
	tool, ok := r.tools[name]
	return tool, ok
}

type ToolExecutor struct {
	registry ToolRegistry
	timeout  time.Duration
	events   EventStore
	newID    func() string
}

func (e ToolExecutor) Execute(ctx context.Context, sessionID string, call ToolCall) (json.RawMessage, error) {
	tool, ok := e.registry.Get(call.Name)
	if !ok {
		return nil, ErrToolNotFound
	}

	toolCtx, cancel := context.WithTimeout(ctx, e.timeout)
	defer cancel()

	started := Event{
		ID:         e.newID(),
		Type:       EventToolCallStarted,
		ToolName:   call.Name,
		ToolCallID: call.ID,
		Payload:    call.Input,
	}
	if err := e.events.Append(ctx, sessionID, started); err != nil {
		return nil, err
	}

	result, err := tool.Invoke(toolCtx, call.Input)
	eventType := EventToolCallFinished
	if err != nil {
		eventType = EventToolCallFailed
	}
	_ = e.events.Append(ctx, sessionID, Event{
		ID:         e.newID(),
		Type:       eventType,
		ToolName:   call.Name,
		ToolCallID: call.ID,
		Payload:    result,
	})
	return result, err
}

type ToolCall struct {
	ID    string
	Name  string
	Input json.RawMessage
}
```

## 13. Agent Runner

学习目标：agent runner 是事件循环，不是一个巨大的 prompt 函数。

```go
type ModelStep struct {
	FinalText string
	ToolCalls []ToolCall
}

type ModelClient interface {
	Next(ctx context.Context, state SessionState) (ModelStep, error)
}

type Runner struct {
	store    EventStore
	model    ModelClient
	tools    ToolExecutor
	newID    func() string
	maxSteps int
}

func (r Runner) Run(ctx context.Context, sessionID string, input string) error {
	if err := r.store.Append(ctx, sessionID, Event{
		ID:      r.newID(),
		Type:    EventUserMessage,
		Content: input,
	}); err != nil {
		return err
	}

	steps := r.maxSteps
	if steps < 1 {
		steps = 8
	}

	for i := 0; i < steps; i++ {
		events, err := r.store.List(ctx, sessionID)
		if err != nil {
			return err
		}
		state := Replay(sessionID, events)

		step, err := r.model.Next(ctx, state)
		if err != nil {
			_ = r.store.Append(ctx, sessionID, Event{ID: r.newID(), Type: EventRunFailed, Content: err.Error()})
			return err
		}

		if step.FinalText != "" {
			if err := r.store.Append(ctx, sessionID, Event{ID: r.newID(), Type: EventAssistantMessage, Content: step.FinalText}); err != nil {
				return err
			}
			return r.store.Append(ctx, sessionID, Event{ID: r.newID(), Type: EventRunCompleted})
		}

		for _, call := range step.ToolCalls {
			if _, err := r.tools.Execute(ctx, sessionID, call); err != nil {
				return err
			}
		}
	}

	return r.store.Append(ctx, sessionID, Event{ID: r.newID(), Type: EventRunFailed, Content: "max steps exceeded"})
}
```

## 14. Graph Runtime

学习目标：复杂 agent 不要把流程藏进 if/else。显式 graph 更容易观测、测试和中断。

```go
type Next struct {
	NodeID string
	Reason string
}

type Node[S any] interface {
	Run(ctx context.Context, state *S) (Next, error)
}

type Graph[S any] struct {
	nodes map[string]Node[S]
}

func NewGraph[S any](nodes map[string]Node[S]) Graph[S] {
	return Graph[S]{nodes: nodes}
}

func (g Graph[S]) Execute(ctx context.Context, start string, state *S) error {
	for current := start; current != ""; {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		node, ok := g.nodes[current]
		if !ok {
			return fmt.Errorf("node %q: %w", current, ErrInvalidRoute)
		}
		next, err := node.Run(ctx, state)
		if err != nil {
			return err
		}
		current = next.NodeID
	}
	return nil
}
```

## 15. Event Stream And Slow Consumer Policy

学习目标：实时流不是“往 channel 里塞就完了”。必须定义慢消费者策略。

```go
type StreamEvent struct {
	Seq       int64
	Type      string
	Data      []byte
	CreatedAt time.Time
}

type Subscriber struct {
	ID string
	C  chan StreamEvent
}

type Bus struct {
	mu   sync.RWMutex
	subs map[string]map[string]Subscriber
}

func NewBus() *Bus {
	return &Bus{subs: map[string]map[string]Subscriber{}}
}

func (b *Bus) Subscribe(topic string, id string, buffer int) Subscriber {
	sub := Subscriber{ID: id, C: make(chan StreamEvent, buffer)}
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.subs[topic] == nil {
		b.subs[topic] = map[string]Subscriber{}
	}
	b.subs[topic][id] = sub
	return sub
}

func (b *Bus) Publish(topic string, event StreamEvent) int {
	b.mu.RLock()
	defer b.mu.RUnlock()

	dropped := 0
	for id, sub := range b.subs[topic] {
		select {
		case sub.C <- event:
		default:
			dropped++
			_ = id
		}
	}
	return dropped
}
```

SSE 写出边界：

```go
func WriteSSE(ctx context.Context, w http.ResponseWriter, sub Subscriber) error {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")

	flusher, _ := w.(http.Flusher)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event := <-sub.C:
			if _, err := fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", event.Seq, event.Type, event.Data); err != nil {
				return err
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
	}
}
```

## 16. Telemetry Pipeline

学习目标：学习 OpenTelemetry Collector 的 receiver/processor/exporter 分层，把 gateway/agent 业务字段带出去。

```go
type TelemetryEvent struct {
	Name          string
	TraceID       string
	RequestID     string
	TenantID      string
	SessionID     string
	RunID         string
	Provider      string
	Model         string
	LatencyMS     int64
	InputTokens   int
	OutputTokens  int
	ErrorClass    string
	Attributes    map[string]string
}

type Processor interface {
	Process(ctx context.Context, event TelemetryEvent) (TelemetryEvent, error)
}

type Exporter interface {
	Export(ctx context.Context, event TelemetryEvent) error
}

type TelemetryPipeline struct {
	processors []Processor
	exporter   Exporter
}

func (p TelemetryPipeline) Handle(ctx context.Context, event TelemetryEvent) error {
	var err error
	for _, processor := range p.processors {
		event, err = processor.Process(ctx, event)
		if err != nil {
			return err
		}
	}
	return p.exporter.Export(ctx, event)
}
```

异步 exporter：

```go
type AsyncExporter struct {
	queue   chan TelemetryEvent
	export  Exporter
	dropped atomic.Int64
}

func NewAsyncExporter(export Exporter, capacity int) *AsyncExporter {
	return &AsyncExporter{
		queue:  make(chan TelemetryEvent, capacity),
		export: export,
	}
}

func (e *AsyncExporter) Export(ctx context.Context, event TelemetryEvent) error {
	select {
	case e.queue <- event:
		return nil
	default:
		e.dropped.Add(1)
		return nil
	}
}

func (e *AsyncExporter) Start(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event := <-e.queue:
			_ = e.export.Export(ctx, event)
		}
	}
}
```

## 17. Endpoint Middleware

学习目标：不仅 HTTP 有 middleware，业务 endpoint 和 provider client 也需要 middleware。

```go
type Endpoint[Req any, Resp any] func(context.Context, Req) (Resp, error)

func WithMetrics[Req any, Resp any](name string, exporter Exporter, next Endpoint[Req, Resp]) Endpoint[Req, Resp] {
	return func(ctx context.Context, req Req) (Resp, error) {
		start := time.Now()
		resp, err := next(ctx, req)
		_ = exporter.Export(ctx, TelemetryEvent{
			Name:       name,
			LatencyMS:  time.Since(start).Milliseconds(),
			ErrorClass: string(Classify(err)),
		})
		return resp, err
	}
}

func WithRetryBudget[Req any, Resp any](attempts int, next Endpoint[Req, Resp]) Endpoint[Req, Resp] {
	return func(ctx context.Context, req Req) (Resp, error) {
		var lastErr error
		for i := 0; i < attempts; i++ {
			resp, err := next(ctx, req)
			if err == nil || !CanFallback(err) {
				return resp, err
			}
			lastErr = err
		}
		var zero Resp
		return zero, fmt.Errorf("%w: %v", ErrRetryBudget, lastErr)
	}
}
```

## 18. App Lifecycle

学习目标：Caddy、Memos、NATS 这类长期运行系统都要有清晰生命周期。

```go
type Component interface {
	Name() string
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
}

type App struct {
	components []Component
}

func (a App) Run(ctx context.Context) error {
	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	errs := make(chan error, len(a.components))
	for _, component := range a.components {
		c := component
		go func() {
			if err := c.Start(runCtx); err != nil && !errors.Is(err, context.Canceled) {
				errs <- fmt.Errorf("%s: %w", c.Name(), err)
			}
		}()
	}

	select {
	case <-ctx.Done():
	case err := <-errs:
		cancel()
		return err
	}

	stopCtx, stopCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer stopCancel()
	for i := len(a.components) - 1; i >= 0; i-- {
		_ = a.components[i].Stop(stopCtx)
	}
	return nil
}
```

HTTP server component：

```go
type HTTPServerComponent struct {
	server *http.Server
}

func (c HTTPServerComponent) Name() string { return "http" }

func (c HTTPServerComponent) Start(ctx context.Context) error {
	errs := make(chan error, 1)
	go func() { errs <- c.server.ListenAndServe() }()

	select {
	case <-ctx.Done():
		return context.Canceled
	case err := <-errs:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

func (c HTTPServerComponent) Stop(ctx context.Context) error {
	return c.server.Shutdown(ctx)
}
```

## 19. Test Skeletons

学习目标：每个架构规则都要有测试证明。

Fallback 不应该重试 invalid input：

```go
func TestFallbackStopsOnInvalidInput(t *testing.T) {
	registry := fakeRegistry{
		"primary": fakeProvider{err: GatewayError{Class: ErrorInvalidInput, Err: errors.New("bad request")}},
		"backup":  fakeProvider{resp: ChatResponse{Content: "ok"}},
	}
	executor := FallbackExecutor{providers: registry}

	_, err := executor.Try(context.Background(), RoutePlan{
		Primary:   Route{Provider: "primary", Model: "gpt"},
		Fallbacks: []Route{{Provider: "backup", Model: "gpt"}},
	}, ChatRequest{Model: "gpt"})

	if err == nil {
		t.Fatal("expected error")
	}
	if got := registry.calls["backup"]; got != 0 {
		t.Fatalf("backup calls: want 0 got %d", got)
	}
}
```

Agent replay 应恢复 tool 生命周期：

```go
func TestReplayToolLifecycle(t *testing.T) {
	events := []Event{
		{Type: EventUserMessage, Content: "search docs"},
		{Type: EventToolCallStarted, ToolCallID: "call-1", ToolName: "search"},
		{Type: EventToolCallFinished, ToolCallID: "call-1", ToolName: "search"},
		{Type: EventAssistantMessage, Content: "done"},
	}

	state := Replay("s1", events)
	if len(state.RunningTools) != 0 {
		t.Fatalf("running tools: want 0 got %d", len(state.RunningTools))
	}
	if got := state.Messages[len(state.Messages)-1].Content; got != "done" {
		t.Fatalf("last message: want done got %q", got)
	}
}
```

Provider queue full 应快速失败：

```go
func TestProviderQueueFull(t *testing.T) {
	queue := NewProviderQueue("openai", 1)
	job := ProviderJob{Reply: make(chan ProviderResult, 1)}

	if err := queue.TrySubmit(job); err != nil {
		t.Fatalf("first submit: %v", err)
	}
	if err := queue.TrySubmit(job); !errors.Is(err, ErrQueueFull) && Classify(err) != ErrorOverloaded {
		t.Fatalf("second submit should overload, got %v", err)
	}
}
```

Telemetry async exporter 不阻塞主路径：

```go
func TestAsyncExporterDropsWhenFull(t *testing.T) {
	exporter := NewAsyncExporter(fakeExporter{}, 1)
	_ = exporter.Export(context.Background(), TelemetryEvent{Name: "first"})
	_ = exporter.Export(context.Background(), TelemetryEvent{Name: "second"})

	if exporter.dropped.Load() == 0 {
		t.Fatal("expected dropped telemetry when queue is full")
	}
}
```

## Implementation Order

把这些代码落成本地 lab 时，建议顺序：

```text
1. gateway/router: RoutePlan + table tests
2. gateway/fallback: ErrorClass + FallbackExecutor
3. gateway/admission: ProviderQueue + queue full tests
4. agent/eventstore: append/list/replay
5. agent/runner: fake model + fake tool
6. observability/pipeline: TelemetryEvent + AsyncExporter
7. cmd/gateway: App lifecycle + graceful shutdown
```

这条顺序正好覆盖你的最终目标：AI 网关分发、Agent 对话流、高并发背压、高可用生命周期、可观测 pipeline。
