# Production Patterns Cookbook

这份 cookbook 把 GitHub 材料和本地 Capstone 进一步压成可复用的生产级 Go 模式。它面向最终目标：AI Gateway、Agent Runtime、RAG、Streaming、高并发、高可用和可观测。

它不是替代源码阅读，而是把阅读结论变成“以后写系统时能直接抄骨架、改实现、补测试”的模板。

Backlinks:

- Source network: [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)
- Advanced source anchors: [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)
- Key local code: [`key-code-index.md`](key-code-index.md)
- Capstone manual: [`capstone-implementation-manual.md`](capstone-implementation-manual.md)
- Readiness checklist: [`production-readiness-checklist.md`](production-readiness-checklist.md)
- System blueprints: [`system-blueprints.md`](system-blueprints.md)
- Local Capstone: [`../../capstone_ai_gateway_agent_runtime`](../../capstone_ai_gateway_agent_runtime/README.md)

## Pattern Map

| Pattern | Source inspiration | Local landing |
|---|---|---|
| Admission control | Tyk, Hertz, Bifrost | [`gateway/policy`](../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/engine.go), [`gateway/provider/queue.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go) |
| Route scoring | Bifrost, Tyk | [`gateway/router/planner.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/router/planner.go) |
| Bounded executor | Go by Example, NATS | [`gateway/provider/queue.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go) |
| Circuit breaker | Bifrost, go-kit style middleware | [`gateway/provider/breaker.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/breaker.go) |
| Retry budget | Bifrost, Temporal | [`gateway/fallback/executor.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go) |
| Event replay | trpc-agent-go, Temporal | [`agent/event/replay.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go) |
| Slow consumer policy | NATS, Memos | [`agent/stream/bus.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go) |
| Async telemetry | OTel Collector | [`platform/telemetry/exporter_async.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go) |
| Lifecycle | Caddy, Hertz, modern-go-application | [`platform/lifecycle/app.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app.go) |

## 1. Admission Control

Sources:

- Tyk: auth, quota, rate limit and gateway middleware.
- Hertz: request boundary should reject early.
- Bifrost: provider queue and fallback should not receive invalid work.

Admission control answers one question before expensive work starts: should this request enter the system now?

```go
type AdmissionDecision struct {
	Allowed bool
	Class   core.ErrorClass
	Reason  error
}

type AdmissionPolicy interface {
	Decide(ctx context.Context, req core.ChatRequest) AdmissionDecision
}

type AdmissionChain []AdmissionPolicy

func (c AdmissionChain) Admit(ctx context.Context, req core.ChatRequest) error {
	for _, policy := range c {
		decision := policy.Decide(ctx, req)
		if decision.Allowed {
			continue
		}
		return core.GatewayError{
			Class: decision.Class,
			Err:   decision.Reason,
		}
	}
	return nil
}
```

Tenant policy is one admission policy:

```go
type TenantAdmission struct {
	store *policy.MemoryStore
}

func (a TenantAdmission) Decide(ctx context.Context, req core.ChatRequest) AdmissionDecision {
	engine := policy.NewEngine(a.store)
	_, err := engine.Authorize(ctx, req)
	if err == nil {
		return AdmissionDecision{Allowed: true}
	}
	return AdmissionDecision{
		Allowed: false,
		Class:   core.ErrorClassOf(err),
		Reason:  err,
	}
}
```

Queue pressure is another admission policy:

```go
type QueueAdmission struct {
	QueueDepth int
	MaxDepth   int
}

func (a QueueAdmission) Decide(ctx context.Context, req core.ChatRequest) AdmissionDecision {
	if a.QueueDepth < a.MaxDepth {
		return AdmissionDecision{Allowed: true}
	}
	return AdmissionDecision{
		Allowed: false,
		Class:   core.ErrorOverloaded,
		Reason:  core.ErrProviderQueueFull,
	}
}
```

Test the chain, not only each policy:

```go
func TestAdmissionChainRejectsBeforeProviderWork(t *testing.T) {
	chain := AdmissionChain{
		QueueAdmission{QueueDepth: 10, MaxDepth: 10},
	}

	err := chain.Admit(context.Background(), core.ChatRequest{TenantID: "demo"})
	if core.ErrorClassOf(err) != core.ErrorOverloaded {
		t.Fatalf("class: want overloaded got %s err=%v", core.ErrorClassOf(err), err)
	}
}
```

Learning:

- Reject invalid, unauthorized, over-budget and overloaded requests before provider calls.
- Admission failure should be visible as typed error, HTTP status and telemetry label.
- Large systems should treat rejection as a success path for protecting availability.

## 2. Route Scoring

Sources:

- Bifrost: provider routing, fallback, model/provider abstraction.
- Tyk: gateway policy constrains which upstream can be selected.

The first Capstone router builds an ordered plan. Production systems usually need scoring.

```go
type Candidate struct {
	Route        core.Route
	Healthy      bool
	CostMicros   int64
	LatencyMS    int64
	ErrorRatePPM int64
	Supports     map[core.ModelName]bool
}

type Score struct {
	Value int64
	Why   []string
}

func ScoreCandidate(req core.ChatRequest, c Candidate) Score {
	if !c.Healthy {
		return Score{Value: -1, Why: []string{"unhealthy"}}
	}
	if len(c.Supports) > 0 && !c.Supports[req.Model] {
		return Score{Value: -1, Why: []string{"model_not_supported"}}
	}

	score := int64(1000)
	why := []string{"base=1000"}

	score -= c.CostMicros / 100
	why = append(why, "cost_penalty")

	score -= c.LatencyMS
	why = append(why, "latency_penalty")

	score -= c.ErrorRatePPM / 1000
	why = append(why, "error_rate_penalty")

	return Score{Value: score, Why: why}
}
```

Build a stable route plan:

```go
func BuildScoredPlan(req core.ChatRequest, candidates []Candidate, limit int) core.RoutePlan {
	type ranked struct {
		route core.Route
		score Score
	}
	rankedCandidates := make([]ranked, 0, len(candidates))
	for _, candidate := range candidates {
		score := ScoreCandidate(req, candidate)
		if score.Value < 0 {
			continue
		}
		rankedCandidates = append(rankedCandidates, ranked{
			route: candidate.Route,
			score: score,
		})
	}

	sort.SliceStable(rankedCandidates, func(i, j int) bool {
		return rankedCandidates[i].score.Value > rankedCandidates[j].score.Value
	})

	if limit <= 0 || limit > len(rankedCandidates) {
		limit = len(rankedCandidates)
	}
	attempts := make([]core.Route, 0, limit)
	for _, candidate := range rankedCandidates[:limit] {
		attempts = append(attempts, candidate.route)
	}
	return core.RoutePlan{Attempts: attempts}
}
```

Learning:

- Route plan should be explainable; record why a provider was selected.
- Cost, latency and error rate should affect routing without hiding tenant policy.
- Keep scoring separate from execution; fallback executor should consume a plan.

## 3. Bounded Provider Executor

Sources:

- Go by Example: worker pools and channel backpressure.
- NATS: slow consumers and overload are explicit failure modes.
- Bifrost: provider calls should be capacity aware.

Use a semaphore to bound in-flight provider calls:

```go
type BoundedClient struct {
	next      provider.Client
	semaphore chan struct{}
}

func NewBoundedClient(next provider.Client, maxInFlight int) *BoundedClient {
	if maxInFlight < 1 {
		maxInFlight = 1
	}
	return &BoundedClient{
		next:      next,
		semaphore: make(chan struct{}, maxInFlight),
	}
}

func (c *BoundedClient) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	select {
	case c.semaphore <- struct{}{}:
		defer func() { <-c.semaphore }()
	case <-ctx.Done():
		return core.ChatResponse{}, ctx.Err()
	default:
		return core.ChatResponse{}, core.GatewayError{
			Class: core.ErrorOverloaded,
			Route: core.Route{Provider: req.Provider, Model: req.Model},
			Err:   core.ErrProviderQueueFull,
		}
	}

	return c.next.Chat(ctx, req)
}
```

Learning:

- In-flight limits and queue limits are different knobs.
- Provider overload should trigger fallback if another route exists.
- Capacity protection belongs near provider execution, not only at HTTP ingress.

## 4. Circuit Breaker With Half Open

Sources:

- Bifrost: provider failures should change routing behavior.
- go-kit examples: endpoint middleware can wrap calls.

The current Capstone breaker opens after retryable failures. Production breakers normally support half-open probes.

```go
type BreakerState string

const (
	BreakerClosed   BreakerState = "closed"
	BreakerOpen     BreakerState = "open"
	BreakerHalfOpen BreakerState = "half_open"
)

type TimedBreaker struct {
	next        provider.Client
	limit       int
	cooldown    time.Duration
	now         func() time.Time
	mu          sync.Mutex
	state       BreakerState
	failures    int
	openedUntil time.Time
}

func (b *TimedBreaker) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	b.mu.Lock()
	if b.state == BreakerOpen && b.now().Before(b.openedUntil) {
		b.mu.Unlock()
		return core.ChatResponse{}, core.GatewayError{
			Class: core.ErrorProviderUnavailable,
			Route: core.Route{Provider: req.Provider, Model: req.Model},
			Err:   core.ErrNoProvider,
		}
	}
	if b.state == BreakerOpen {
		b.state = BreakerHalfOpen
	}
	b.mu.Unlock()

	resp, err := b.next.Chat(ctx, req)
	b.afterCall(err)
	return resp, err
}
```

State update:

```go
func (b *TimedBreaker) afterCall(err error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if err == nil {
		b.failures = 0
		b.state = BreakerClosed
		return
	}
	if !core.CanFallback(err) {
		return
	}

	b.failures++
	if b.state == BreakerHalfOpen || b.failures >= b.limit {
		b.state = BreakerOpen
		b.openedUntil = b.now().Add(b.cooldown)
	}
}
```

Learning:

- Breaker state should be observable: `closed`, `open`, `half_open`.
- Only retryable/provider errors should open a breaker.
- Half-open probe count should be bounded in real production code.

## 5. Retry Budget

Sources:

- Bifrost: fallback chain must be bounded.
- Temporal: retry and command processing are controlled, not infinite loops.

Retry budget is a request-scoped protection. It prevents “helpful fallback” from becoming traffic amplification.

```go
type RetryBudget struct {
	MaxAttempts int
	MaxCost     int
	attempts    int
	cost        int
}

func (b *RetryBudget) Spend(route core.Route, estimatedCost int) error {
	if b.MaxAttempts > 0 && b.attempts >= b.MaxAttempts {
		return core.GatewayError{Class: core.ErrorRetryBudget, Err: core.ErrRetryBudgetExceeded}
	}
	if b.MaxCost > 0 && b.cost+estimatedCost > b.MaxCost {
		return core.GatewayError{Class: core.ErrorRetryBudget, Err: core.ErrRetryBudgetExceeded}
	}
	b.attempts++
	b.cost += estimatedCost
	return nil
}
```

Use it inside fallback:

```go
func ExecuteWithBudget(ctx context.Context, req core.ChatRequest, plan core.RoutePlan, budget RetryBudget, call func(core.Route) (core.ChatResponse, error)) (core.ChatResponse, error) {
	var lastErr error
	for _, route := range plan.Attempts {
		if err := budget.Spend(route, req.EstimatedTokens()); err != nil {
			return core.ChatResponse{}, err
		}
		resp, err := call(route)
		if err == nil {
			return resp, nil
		}
		lastErr = err
		if !core.CanFallback(err) {
			break
		}
	}
	return core.ChatResponse{}, lastErr
}
```

Learning:

- Retry budget should include attempts and sometimes estimated cost/tokens.
- Fallback across paid LLM providers can multiply spend; budget must be explicit.
- Budget exhaustion should be a typed error and telemetry event.

## 6. Hedged Request

Sources:

- Distributed systems tail-latency practice.
- Apply cautiously to AI provider calls because LLM requests are expensive.

Hedging launches a backup route after a delay if the primary is still running.

```go
type HedgePolicy struct {
	Delay       time.Duration
	Enabled     bool
	MaxParallel int
}

func HedgedChat(ctx context.Context, req core.ChatRequest, primary provider.Client, backup provider.Client, policy HedgePolicy) (core.ChatResponse, error) {
	if !policy.Enabled {
		return primary.Chat(ctx, req)
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	type result struct {
		resp core.ChatResponse
		err  error
	}
	results := make(chan result, 2)

	go func() {
		resp, err := primary.Chat(ctx, req)
		results <- result{resp: resp, err: err}
	}()

	timer := time.NewTimer(policy.Delay)
	defer timer.Stop()

	select {
	case got := <-results:
		return got.resp, got.err
	case <-timer.C:
		go func() {
			resp, err := backup.Chat(ctx, req)
			results <- result{resp: resp, err: err}
		}()
	}

	got := <-results
	cancel()
	return got.resp, got.err
}
```

Learning:

- Hedging is not the same as fallback; it can run two calls in parallel.
- Add tenant/provider cost guardrails before enabling hedging.
- Always cancel the loser and record whether hedge was launched.

## 7. Tool Idempotency

Sources:

- Temporal: activities and commands need idempotent side effects.
- Notification systems: dedupe keys prevent duplicate delivery.
- Capstone: [`platform/idempotency`](../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store.go).

Agent tools often have side effects: send email, create ticket, call API. Use a deterministic idempotency key.

```go
type ToolSideEffect struct {
	SessionID  string
	ToolCallID string
	Name       string
	ArgsHash   string
}

func (e ToolSideEffect) Key() string {
	return strings.Join([]string{e.SessionID, e.ToolCallID, e.Name, e.ArgsHash}, ":")
}

type IdempotencyStore interface {
	Claim(ctx context.Context, key string) (bool, error)
}

func ExecuteSideEffect(ctx context.Context, store IdempotencyStore, effect ToolSideEffect, run func(context.Context) error) error {
	claimed, err := store.Claim(ctx, effect.Key())
	if err != nil {
		return err
	}
	if !claimed {
		return nil
	}
	return run(ctx)
}
```

Learning:

- Idempotency key must include enough semantic identity.
- Tool retries should be safe by default.
- Store result payload too if clients need consistent replayed response.

## 8. Event Outbox

Sources:

- Temporal: history is durable.
- Memos: business write and broadcast are separate concerns.
- NATS: async delivery can fail; track delivery state.

Outbox decouples state mutation from async side effects.

```go
type OutboxEvent struct {
	ID          string
	Topic       string
	Payload     []byte
	Attempts    int
	AvailableAt time.Time
}

type Outbox interface {
	Append(ctx context.Context, event OutboxEvent) error
	ClaimDue(ctx context.Context, now time.Time, limit int) ([]OutboxEvent, error)
	MarkDone(ctx context.Context, id string) error
	MarkRetry(ctx context.Context, id string, next time.Time) error
}
```

Worker loop:

```go
func RunOutboxWorker(ctx context.Context, outbox Outbox, publish func(context.Context, OutboxEvent) error) error {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case now := <-ticker.C:
			events, err := outbox.ClaimDue(ctx, now, 100)
			if err != nil {
				continue
			}
			for _, event := range events {
				if err := publish(ctx, event); err != nil {
					_ = outbox.MarkRetry(ctx, event.ID, now.Add(backoff(event.Attempts)))
					continue
				}
				_ = outbox.MarkDone(ctx, event.ID)
			}
		}
	}
}
```

Learning:

- Do not broadcast SSE or publish queue messages inside a DB transaction after the commit point has become ambiguous.
- Outbox gives you retry, audit and dead-letter hooks.
- In a learning system, memory outbox is enough to prove behavior; production needs durable storage.

## 9. Event Version And Upcaster

Sources:

- Temporal: history format must survive code changes.
- Syncthing: protocol compatibility matters.
- trpc-agent-go: event is a runtime fact.

Event-sourced systems need versioning.

```go
type StoredEvent struct {
	ID      string
	Version int
	Type    event.EventType
	Data    json.RawMessage
}

type Upcaster func(StoredEvent) (StoredEvent, error)

func ReplayWithUpcasters(events []StoredEvent, upcasters []Upcaster) (event.State, error) {
	current := make([]event.Event, 0, len(events))
	for _, stored := range events {
		var err error
		for _, upcast := range upcasters {
			stored, err = upcast(stored)
			if err != nil {
				return event.State{}, err
			}
		}
		decoded, err := DecodeEvent(stored)
		if err != nil {
			return event.State{}, err
		}
		current = append(current, decoded)
	}
	return event.Replay(current), nil
}
```

Example upcaster:

```go
func UpcastToolEventV1ToV2(stored StoredEvent) (StoredEvent, error) {
	if stored.Version != 1 || stored.Type != event.ToolStarted {
		return stored, nil
	}
	var old struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(stored.Data, &old); err != nil {
		return StoredEvent{}, err
	}
	next := struct {
		ToolCallID string `json:"tool_call_id"`
		ToolName   string `json:"tool_name"`
	}{ToolCallID: old.ID, ToolName: old.Name}
	data, _ := json.Marshal(next)
	stored.Version = 2
	stored.Data = data
	return stored, nil
}
```

Learning:

- Add `Version` before you need it.
- Replay tests should include old event payloads.
- Event schema belongs to platform/runtime contracts, not UI implementation.

## 10. Human Interrupt And Resume

Sources:

- trpc-agent-go graph agent.
- Temporal: workflows wait for external signals.
- Agent product experience: human approval and handoff are normal runtime states.

Interrupt is a state, not an error log line.

```go
type Interrupt struct {
	SessionID string
	NodeID    string
	Reason    string
	ResumeKey string
}

func RequestHumanApproval(ctx context.Context, store event.Store, interrupt Interrupt) error {
	return store.Append(ctx, interrupt.SessionID, event.Event{
		Type:    event.RunInterrupted,
		NodeID:  interrupt.NodeID,
		Content: interrupt.Reason,
	})
}

func ResumeAfterApproval(ctx context.Context, store event.Store, sessionID string, approved bool) error {
	content := "rejected"
	if approved {
		content = "approved"
	}
	return store.Append(ctx, sessionID, event.Event{
		Type:    event.UserMessage,
		Content: content,
	})
}
```

Graph node checks replayed state:

```go
func ApprovalNode(next string) graph.NodeFunc {
	return func(ctx context.Context, state event.State) (graph.Result, error) {
		for _, msg := range state.Messages {
			if msg.Role == "user" && msg.Content == "approved" {
				return graph.Result{NextNodeID: next}, nil
			}
			if msg.Role == "user" && msg.Content == "rejected" {
				return graph.Result{Complete: true, Reason: "rejected"}, nil
			}
		}
		return graph.Result{Interrupt: true, Reason: "waiting_for_approval"}, nil
	}
}
```

Learning:

- Human approval should be replayable.
- Resume should append a new fact, not mutate old event history.
- UI can render interrupts, but runtime owns interrupt semantics.

## 11. Stream Replay Cursor

Sources:

- NATS: slow consumer policy.
- Memos: realtime updates need reconnect behavior.
- Capstone: [`agent/stream`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go).

Live stream may drop events; durable replay fills gaps.

```go
type Cursor struct {
	SessionID string
	Offset    int
}

type EventReader interface {
	List(ctx context.Context, sessionID string) ([]event.Event, error)
}

func ReplayFrom(ctx context.Context, reader EventReader, cursor Cursor, send func(event.Event) error) error {
	events, err := reader.List(ctx, cursor.SessionID)
	if err != nil {
		return err
	}
	for i := cursor.Offset; i < len(events); i++ {
		if err := send(events[i]); err != nil {
			return err
		}
	}
	return nil
}
```

SSE-style handler shape:

```go
func StreamEvents(ctx context.Context, sessionID string, offset int, reader EventReader, live <-chan event.Event, send func(event.Event) error) error {
	if err := ReplayFrom(ctx, reader, Cursor{SessionID: sessionID, Offset: offset}, send); err != nil {
		return err
	}
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case evt := <-live:
			if err := send(evt); err != nil {
				return err
			}
		}
	}
}
```

Learning:

- Live stream is an optimization; event store is source of truth.
- Cursor should be session-scoped and monotonic.
- Slow consumer drop is acceptable only when replay exists.

## 12. Async Telemetry With Dimensions

Sources:

- OpenTelemetry Collector: receiver, processor, exporter and queue.
- Tyk analytics: gateway business dimensions matter.
- Bifrost: provider attempts need model/provider labels.

Telemetry event should include stable AI dimensions.

```go
type AttemptTelemetry struct {
	RequestID     string
	TenantID      string
	Model         string
	Provider      string
	FallbackIndex int
	ErrorClass    string
	InputTokens   int
	OutputTokens  int
	LatencyMS     int64
	CostMicros    int64
}

func RecordAttempt(ctx context.Context, sink telemetry.Sink, t AttemptTelemetry) {
	_ = sink.Record(ctx, telemetry.Event{
		Name:          "gateway.provider_attempt",
		RequestID:     t.RequestID,
		TenantID:      t.TenantID,
		Model:         t.Model,
		Provider:      t.Provider,
		ErrorClass:    t.ErrorClass,
		FallbackIndex: t.FallbackIndex,
		LatencyMS:     t.LatencyMS,
	})
}
```

Async exporter should not block request path:

```go
func (e *AsyncExporter) Record(ctx context.Context, event Event) error {
	select {
	case e.queue <- event:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		e.mu.Lock()
		e.dropped++
		e.mu.Unlock()
		return nil
	}
}
```

Learning:

- Do not put raw prompt or secrets in telemetry labels.
- Use low-cardinality labels for metrics; put high-cardinality data in traces/logs if needed.
- Track dropped telemetry count; silent observability loss is dangerous.

## 13. Audit Log And Cost Ledger

Sources:

- Tyk analytics.
- Bifrost provider accounting.
- Capstone: [`gateway/audit`](../../capstone_ai_gateway_agent_runtime/internal/gateway/audit/log.go).

Audit is not the same as metrics. Audit answers “what happened for this request and what did it cost?”

```go
type RequestLog struct {
	RequestID     core.RequestID
	TenantID      core.TenantID
	Model         core.ModelName
	Provider      core.ProviderName
	FallbackIndex int
	InputTokens   int
	OutputTokens  int
	ErrorClass    core.ErrorClass
	CostMicros    int64
	CreatedAt     time.Time
}

type AuditSink interface {
	Record(ctx context.Context, log RequestLog) error
}
```

Cost estimate:

```go
type Price struct {
	InputMicrosPerToken  int64
	OutputMicrosPerToken int64
}

func EstimateCost(inputTokens int, outputTokens int, price Price) int64 {
	return int64(inputTokens)*price.InputMicrosPerToken +
		int64(outputTokens)*price.OutputMicrosPerToken
}
```

Learning:

- Audit logs should survive telemetry exporter outages.
- Cost ledger should record attempted provider and fallback index.
- Tenant-facing billing needs stronger guarantees than best-effort metrics.

## 14. Graceful Drain

Sources:

- Caddy: lifecycle and module cleanup.
- Hertz: server shutdown.
- modern-go-application: process composition.

Graceful shutdown should stop accepting new work, let bounded in-flight work finish, then flush.

```go
type Drainable interface {
	StopAccepting()
	InFlight() int
}

func Drain(ctx context.Context, d Drainable, tick time.Duration) error {
	d.StopAccepting()
	ticker := time.NewTicker(tick)
	defer ticker.Stop()

	for {
		if d.InFlight() == 0 {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}
```

HTTP component shape:

```go
func ShutdownHTTP(ctx context.Context, server *http.Server, telemetry interface{ Flush(context.Context) error }) error {
	if err := server.Shutdown(ctx); err != nil {
		return err
	}
	return telemetry.Flush(ctx)
}
```

Learning:

- Shutdown order matters: ingress first, workers next, exporters last.
- Drain must have timeout; infinite graceful shutdown is still an outage.
- Readiness should fail before shutdown starts draining.

## 15. Config Validation Before Hot Swap

Sources:

- Caddy dynamic config.
- Tyk gateway policy.
- PocketBase product configuration.
- Local Capstone proof: [`internal/app/config.go`](../../capstone_ai_gateway_agent_runtime/internal/app/config.go), [`internal/app/config_test.go`](../../capstone_ai_gateway_agent_runtime/internal/app/config_test.go).

Hot config update must validate the whole next state before swapping.

```go
type RuntimeConfig struct {
	Providers map[core.ProviderName]ProviderConfig
	Policies  map[core.TenantID]core.TenantPolicy
}

func ValidateRuntimeConfig(cfg RuntimeConfig) error {
	if len(cfg.Providers) == 0 {
		return errors.New("providers required")
	}
	for tenant, policy := range cfg.Policies {
		for providerName := range policy.AllowedProviders {
			if _, ok := cfg.Providers[providerName]; !ok {
				return fmt.Errorf("tenant %s allows unknown provider %s", tenant, providerName)
			}
		}
	}
	return nil
}
```

Atomic swap:

```go
type ConfigStore struct {
	value atomic.Value
}

func (s *ConfigStore) Swap(next RuntimeConfig) error {
	if err := ValidateRuntimeConfig(next); err != nil {
		return err
	}
	s.value.Store(next)
	return nil
}

func (s *ConfigStore) Load() RuntimeConfig {
	return s.value.Load().(RuntimeConfig)
}
```

Capstone learning version:

```go
func (c GatewayConfig) Validate() error {
	providers := make(map[core.ProviderName]ProviderConfig, len(c.Providers))
	models := map[core.ModelName]bool{}
	for _, provider := range c.Providers {
		if provider.Name == "" {
			return fmt.Errorf("provider name is required")
		}
		if _, exists := providers[provider.Name]; exists {
			return fmt.Errorf("provider %s is duplicated", provider.Name)
		}
		providers[provider.Name] = provider
		for model, enabled := range provider.Models {
			if enabled {
				models[model] = true
			}
		}
	}
	if len(providers) == 0 {
		return fmt.Errorf("at least one provider is required")
	}

	for _, tenant := range c.Tenants {
		for providerName, allowed := range tenant.AllowedProviders {
			if !allowed {
				continue
			}
			if _, ok := providers[providerName]; !ok {
				return fmt.Errorf("tenant %s allows unknown provider %s", tenant.TenantID, providerName)
			}
		}
		for modelName, allowed := range tenant.AllowedModels {
			if allowed && len(models) > 0 && !models[modelName] {
				return fmt.Errorf("tenant %s allows unknown model %s", tenant.TenantID, modelName)
			}
		}
	}
	return nil
}
```

```go
err = store.Swap(GatewayConfig{
	Providers: []ProviderConfig{{Name: "primary"}},
	Tenants: []core.TenantPolicy{
		{
			TenantID: "demo",
			AllowedProviders: map[core.ProviderName]bool{
				"primary": true,
				"ghost":   true,
			},
		},
	},
})
if err == nil {
	t.Fatal("expected invalid config")
}
```

Audit and rollback proof:

```go
version, err := store.SwapWithAudit("ops@example.com", next)
if err != nil {
	t.Fatalf("swap: %v", err)
}
if version != 2 || store.Version() != 2 {
	t.Fatalf("version: returned=%d current=%d", version, store.Version())
}

events := store.AuditEvents()
if events[0].Action != "swap" || events[0].Actor != "ops@example.com" {
	t.Fatalf("audit event: %+v", events[0])
}
```

```go
rollbackVersion, err := store.Rollback("incident@example.com", 1)
if err != nil {
	t.Fatalf("rollback: %v", err)
}
if rollbackVersion != 3 || store.Version() != 3 {
	t.Fatalf("version: returned=%d current=%d", rollbackVersion, store.Version())
}
```

Learning:

- Partial config update can create dangerous in-between states.
- Validate cross-references: tenant policy, provider, model and quota.
- Audit every config change with actor, version and diff summary.
- Implemented proof: `TestConfigSwapRejectsUnknownProviderInTenantPolicy`.
- Implemented proof: `TestConfigSwapRecordsAuditEvent`.
- Implemented proof: `TestConfigRollbackRestoresPriorVersionAsNewVersion`.

## 16. RAG Permission Filter

Sources:

- RAG architecture template.
- Real product systems: authorization must survive below HTTP middleware.

Retrieval must filter by tenant/user permission before ranking or before returning citations.

```go
type Chunk struct {
	ID         string
	DocumentID string
	TenantID   string
	ACL        map[string]bool
	Text       string
	Score      int
}

type Principal struct {
	TenantID string
	UserID   string
	Roles    []string
}

func CanRead(principal Principal, chunk Chunk) bool {
	if principal.TenantID != chunk.TenantID {
		return false
	}
	if chunk.ACL[principal.UserID] {
		return true
	}
	for _, role := range principal.Roles {
		if chunk.ACL["role:"+role] {
			return true
		}
	}
	return false
}
```

Use it before citations:

```go
func FilterReadable(principal Principal, chunks []Chunk) []Chunk {
	out := make([]Chunk, 0, len(chunks))
	for _, chunk := range chunks {
		if CanRead(principal, chunk) {
			out = append(out, chunk)
		}
	}
	return out
}
```

Learning:

- RAG leakage is a product and security incident, not just a retrieval bug.
- Permission filtering should be tested with cross-tenant fixtures.
- Citations should never reveal document IDs the user cannot access.

## 17. Test Matrix For Production Patterns

Every production pattern should have at least one behavior test and one failure-path test.

```text
admission control
  - rejects unknown tenant
  - rejects overloaded queue before provider call

route scoring
  - excludes unhealthy provider
  - stable order for equal scores
  - implemented proof: TestRouteScoringPrefersHealthyLowLatencyProvider
  - implemented proof: TestRouteScoringExcludesUnsupportedModel

bounded executor
  - rejects when in-flight full
  - honors canceled context
  - implemented proof: TestBoundedClientRejectsWhenInFlightFull

fallback
  - stops on non-retryable error
  - stops on retry budget

breaker
  - opens after retryable provider failures
  - moves to half-open after cooldown
  - implemented proof: TestTimedBreakerMovesToHalfOpenAfterCooldown

event replay
  - old event version upcasts
  - tool failure produces failed state
  - implemented proof: TestReplayUpcastsOldToolEventVersion

streaming
  - slow consumer does not block publisher
  - replay fills cursor gap
  - implemented proof: TestStreamReplayFromCursorFillsDroppedEvents

telemetry
  - request path does not block when queue full
  - dropped count increments

lifecycle
  - shutdown runs in reverse order
  - timeout returns context error
  - implemented proof: TestGracefulDrainStopsIngressBeforeWorkers

config hot swap
  - rejects tenant policy with unknown provider
  - rejects unknown model when provider model catalog exists
  - implemented proof: TestConfigSwapRejectsUnknownProviderInTenantPolicy
  - implemented proof: TestConfigSwapRecordsAuditEvent
  - implemented proof: TestConfigRollbackRestoresPriorVersionAsNewVersion

outbox
  - retries publish failures with backoff
  - moves exhausted events to dead letter
  - implemented proof: TestOutboxRetriesWithBackoff
  - implemented proof: TestOutboxMovesToDeadLetterAfterBudget

rag
  - permission filter excludes cross-tenant chunks
  - citation does not expose unreadable documents
  - implemented proof: TestRAGFiltersCrossTenantAndUnreadableChunks
```

When a pattern is added to Capstone, update:

```text
source-to-capstone-crosswalk.md
key-code-index.md
production-patterns-cookbook.md
production-readiness-checklist.md
local-labs/capstone-lab.md
```
