# Source To Test Proof Matrix

这份手册把“读 GitHub 材料”继续压实到“本地测试证明”。它回答一个很具体的问题：

```text
我读完一个 GitHub 仓库以后，
本地哪个 Go 测试能证明我真的吸收了它的机制？
```

Backlinks:

- Source map: [`source-map.md`](source-map.md)
- Traceability matrix: [`traceability-matrix.md`](traceability-matrix.md)
- GitHub repo cards: [`source-segments/github-repo-reading-cards.md`](source-segments/github-repo-reading-cards.md)
- Source to Capstone: [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)
- Key code index: [`key-code-index.md`](key-code-index.md)
- Practice workbook: [`practice-workbook.md`](practice-workbook.md)
- Capstone module: [`../../capstone_ai_gateway_agent_runtime`](../../capstone_ai_gateway_agent_runtime/README.md)
- Architecture labs: [`../../architecture_labs`](../../architecture_labs/README.md)
- API service: [`../../api_service`](../../api_service/README.md)

## Absorption Rule

一个 GitHub source 只有满足下面 5 项，才算被“学习吸收”：

```text
1. 有 source anchor：仓库、commit、文件、符号或段落。
2. 有 segment card：抽出一个可迁移机制。
3. 有 Go translation：本地学习版代码骨架。
4. 有 local proof：本地源码或 lab。
5. 有 test proof：至少一个行为测试或失败路径测试。
```

测试证明分三层：

```text
L1 lab test
  -> 最小机制，例如 route selection、batch queue、event flow。

L2 package test
  -> Capstone 包内机制，例如 fallback、retry budget、audit、stream、replay。

L3 E2E test
  -> HTTP/composition 纵切，例如 demo gateway fallback + telemetry + audit。
```

Run all proof tests:

```bash
export GOROOT="$HOME/.local/go/current"
export GOPATH="$HOME/go"
export PATH="$GOROOT/bin:$GOPATH/bin:$PATH"

cd /Users/jiahaoqian/proj/go_learning/capstone_ai_gateway_agent_runtime
go test ./...

cd /Users/jiahaoqian/proj/go_learning/architecture_labs
go test ./...

cd /Users/jiahaoqian/proj/go_learning/api_service
go test ./...
```

## Language Sources

| Source | Mechanism absorbed | Local code | Test proof |
|---|---|---|---|
| go101/go101 | small interfaces, defined types, copy-safe state | [`gateway/core/service.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go), [`agent/event/store.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go) | `TestMemoryLogCopiesLogs`, architecture lab copy-return methods |
| quii/learn-go-with-tests | behavior-first tests, fake dependency, table-style verification | Capstone fake providers, fake tools, HTTP recorder tests | `TestGatewayFallbackRecordsTelemetry`, `TestRunnerRecordsToolFlowAndReplayCompletes`, `TestChatHandlerReturnsServiceResponse` |
| mmcgrana/gobyexample | worker pool, rate limit, channel direction, context | [`provider/queue.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go), [`stream/bus.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go) | `TestQueueRejectsWhenFull`, `TestQueueHonorsCanceledContext`, `TestBusDoesNotBlockOnSlowSubscriber` |
| golang/example | standard `net/http`, health endpoint, background service shape | [`httpapi/handler.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go), [`api_service`](../../api_service/README.md) | `TestHandlerReportsHealth`, `TestChatHandlerReturnsServiceResponse` |
| inancgumus/learngo | receivers, typed constants, basic interface drills | [`gateway/core/types.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/types.go), [`architecture_labs/agent`](../../architecture_labs/agent/session.go) | `TestSessionRecordsToolCallFlowInOrder` |

### Language Proof Snippets

Fake provider proof from Learn Go with Tests style:

```go
registry.Replace("primary", provider.NewRuntime("primary", provider.FakeTimeout{}))
registry.Replace("backup", provider.NewRuntime("backup", provider.FakeSuccess{
	Name:    "backup",
	Content: "ok",
}))
```

Context proof from Go by Example context style:

```go
ctx, cancel := context.WithCancel(context.Background())
cancel()

err := NewQueue(1).TrySubmit(ctx, Job{ID: "job-1"})
if err != context.Canceled {
	t.Fatalf("want context canceled, got %v", err)
}
```

HTTP proof from `golang/example` style:

```go
req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", body)
rec := httptest.NewRecorder()

handler.Chat(rec, req)

if rec.Code != http.StatusOK {
	t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
}
```

Next exercises:

- Add table tests for `core.ErrorClassOf`.
- Add copy-safety tests for every memory store returning slices/maps.
- Add context deadline test around a future provider health runner.

## Structure And Style Sources

| Source | Mechanism absorbed | Local code | Test proof |
|---|---|---|---|
| golang-standards/project-layout | `cmd` as entry, `internal` as private implementation | [`cmd/gateway/main.go`](../../capstone_ai_gateway_agent_runtime/cmd/gateway/main.go), [`internal/app/demo.go`](../../capstone_ai_gateway_agent_runtime/internal/app/demo.go) | `TestDemoChatCompletionFallsBackAndRecordsProof` |
| uber-go/guide | error wrapping, queue size, copy slices/maps | [`core/errors.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/errors.go), [`provider/queue.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go) | `TestErrorClassOfFindsWrappedGatewayError`, `TestCanFallbackByErrorClass`, `TestQueueRejectsWhenFull`, `TestMemoryLogCopiesLogs` |
| google/styleguide | consumer-side interface, small API | [`core/service.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go), [`router/planner.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/router/planner.go) | `TestGatewayRejectsDisallowedModel`, `TestDemoRejectsUnknownTenant` |
| sagikazarmark/modern-go-application | production app composition, lifecycle, telemetry | [`platform/lifecycle/app.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app.go), [`platform/telemetry/exporter_async.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go) | `TestAppShutdownsComponentsAfterContextCancel`, `TestGracefulDrainStopsIngressBeforeWorkers`, `TestAsyncExporterDropsWhenQueueFull` |

### Structure Proof Snippets

Composition root proof:

```go
demo := BuildDemo()
req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{
	"request_id":"req-1",
	"tenant_id":"demo",
	"model":"gpt-demo",
	"provider":"primary",
	"fallbacks":[{"provider":"backup","model":"gpt-demo"}],
	"messages":[{"role":"user","content":"hello"}]
}`))
rec := httptest.NewRecorder()

demo.Handler.ServeHTTP(rec, req)
```

Lifecycle proof:

```go
ctx, cancel := context.WithCancel(context.Background())
cancel()

if err := app.Run(ctx); err != nil {
	t.Fatalf("run: %v", err)
}
```

Next exercises:

- Add config loader test for `cmd/gateway` once config files exist.
- Add lifecycle test with failing shutdown component to prove joined errors.
- Add interface-size review checklist to [`production-readiness-checklist.md`](production-readiness-checklist.md).

## Architecture Pattern Sources

| Source | Mechanism absorbed | Local code | Test proof |
|---|---|---|---|
| ThreeDotsLabs/wild-workouts-go-ddd-example | domain object, repository update closure, command handler | [`architecture_labs/agent/session.go`](../../architecture_labs/agent/session.go), Capstone event store | `TestSessionRecordsToolCallFlowInOrder`, `TestRunnerRecordsToolFlowAndReplayCompletes` |
| amitshekhariitbhu/go-backend-clean-architecture | controller/usecase/repository boundary and context timeout | [`httpapi/handler.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go), [`core/service.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go) | `TestChatHandlerReturnsServiceResponse`, `TestGatewayRejectsDisallowedModel` |
| evrone/go-clean-template | multi transport usecase, entity state transition | [`agent/graph/graph.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph.go) | `TestGraphRecordsTransitionAndCompletion`, `TestGraphStopsAtStepBudget`, `TestGraphRecordsHumanInterrupt` |
| go-kit/examples | service/endpoint/transport and middleware | [`core/service.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/service.go), [`core/endpoint.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint.go), [`httpapi/handler.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go) | `TestEndpointMiddlewareWrapsServiceBoundary`, `TestEndpointMiddlewareCanShortCircuitBeforeProviderCall`, `TestGatewayFallbackRecordsTelemetry`, `TestChatHandlerReturnsServiceResponse` |

### Architecture Proof Snippets

Service boundary proof:

```go
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

Graph transition proof:

```go
assertEventTypes(t, events, []event.EventType{
	event.NodeTransitioned,
	event.RunCompleted,
})
```

Next exercises:

- Add repository update-closure memory implementation for agent session.
- Add explicit tool call state transition tests.
- Add endpoint middleware package for provider calls.

## Real Project Sources

| Source | Mechanism absorbed | Local code | Test proof |
|---|---|---|---|
| pocketbase/pocketbase | single binary, hooks, route aggregation | [`internal/app/demo.go`](../../capstone_ai_gateway_agent_runtime/internal/app/demo.go), production patterns hook template | `TestDemoChatCompletionFallsBackAndRecordsProof` |
| usememos/memos | server lifecycle, background runner, best-effort broadcast | [`agent/stream/bus.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go), lifecycle app | `TestBusDoesNotBlockOnSlowSubscriber`, `TestAppShutdownsComponentsAfterContextCancel` |
| caddyserver/caddy | module registry, dynamic config, lifecycle cleanup | [`internal/app/config.go`](../../capstone_ai_gateway_agent_runtime/internal/app/config.go), [`platform/lifecycle/app.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/lifecycle/app.go) | `TestConfigSwapRejectsUnknownProviderInTenantPolicy`, `TestConfigSwapRecordsAuditEvent`, `TestConfigRollbackRestoresPriorVersionAsNewVersion`, `TestAppShutdownsComponentsAfterContextCancel`, `TestGracefulDrainStopsIngressBeforeWorkers` |
| syncthing/syncthing | goals first, protocol boundary, long-running runtime state | [`agent/event/event.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/event.go), [`agent/event/replay.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go) | `TestRunnerRecordsToolFlowAndReplayCompletes`, `TestGraphRecordsHumanInterrupt` |

### Real Project Proof Snippets

Best-effort stream proof:

```go
bus.Publish("session-1", event.Event{ID: "event-1", Type: event.UserMessage})
bus.Publish("session-1", event.Event{ID: "event-2", Type: event.AssistantMessage})

if bus.Dropped() != 1 {
	t.Fatalf("dropped: want 1 got %d", bus.Dropped())
}
```

Lifecycle component proof:

```go
type Component interface {
	Name() string
	Start(ctx context.Context) error
	Shutdown(ctx context.Context) error
}
```

Next exercises:

- Add provider hook tests: before-provider failure blocks vs after-provider best-effort.
- Add config hot-swap tests inspired by Caddy admin config.
- Add event version/upcaster tests inspired by Syncthing protocol compatibility.

## Large System Sources

| Source | Mechanism absorbed | Local code | Test proof |
|---|---|---|---|
| maximhq/bifrost | provider routing, queue, fallback, telemetry | [`gateway/provider/queue.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go), [`gateway/fallback/executor.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/fallback/executor.go) | `TestQueueRejectsWhenFull`, `TestGatewayFallbackRecordsTelemetry`, `TestExecutorRespectsRetryBudget` |
| trpc-group/trpc-agent-go | runner, event, tool, graph | [`agent/runner/runner.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go), [`agent/graph/graph.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/graph/graph.go) | `TestRunnerRecordsToolFlowAndReplayCompletes`, `TestRunnerRecordsToolFailureEvent`, `TestGraphRecordsTransitionAndCompletion` |
| TykTechnologies/tyk | policy pipeline, rate limit, analytics | [`gateway/policy/engine.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/policy/engine.go), [`gateway/audit/log.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/audit/log.go) | `TestGatewayRejectsDisallowedModel`, `TestDemoRejectsUnknownTenant`, `TestExecutorRecordsAuditLogs` |
| cloudwego/hertz | HTTP boundary and middleware | [`gateway/httpapi/handler.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/httpapi/handler.go) | `TestChatHandlerReturnsServiceResponse` |
| open-telemetry/opentelemetry-collector | component graph and async exporter queue | [`platform/telemetry/exporter_async.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/telemetry/exporter_async.go) | `TestAsyncExporterExportsQueuedEvents`, `TestAsyncExporterDropsWhenQueueFull` |
| temporalio/temporal | event history, replay, idempotency, workflow budget | [`agent/event/replay.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/event/replay.go), [`platform/idempotency/store.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store.go) | `TestRunnerRecordsToolFlowAndReplayCompletes`, `TestClaimSuppressesDuplicateKey`, `TestGraphStopsAtStepBudget` |
| nats-io/nats-server | pub/sub, slow consumer, stream pressure | [`agent/stream/bus.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go), [`provider/queue.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go) | `TestBusDoesNotBlockOnSlowSubscriber`, `TestQueueRejectsWhenFull` |
| study8677/awesome-architecture | system templates to Go labs | [`../../architecture_labs`](../../architecture_labs/README.md), [`../architecture-to-go/lab-code-anchors.md`](../architecture-to-go/lab-code-anchors.md) | all `architecture_labs/*_test.go` |

### Large System Proof Snippets

Bifrost-style fallback proof:

```go
if !demo.Telemetry.Contains("gateway.provider_attempt", map[string]string{
	"provider":       "primary",
	"error_class":    "timeout",
	"fallback_index": "0",
}) {
	t.Fatalf("missing primary telemetry: %+v", demo.Telemetry.Events())
}
```

trpc-agent-go style event proof:

```go
assertEventTypes(t, events, []event.EventType{
	event.UserMessage,
	event.ToolStarted,
	event.ToolFinished,
	event.AssistantMessage,
	event.RunCompleted,
})
```

Temporal-style idempotency proof:

```go
first, err := store.Claim(context.Background(), "send-email:session-1:tool-1")
if err != nil || !first {
	t.Fatalf("first claim: %v %v", first, err)
}
second, err := store.Claim(context.Background(), "send-email:session-1:tool-1")
if err != nil || second {
	t.Fatalf("second claim should be suppressed")
}
```

Next exercises:

- Add breaker state telemetry and alerting labels.
- Add bounded client integration into provider registry wiring.
- Add outbox worker as a lifecycle component.

## Capstone Acceptance Map

The integrated Capstone is the strongest proof that multiple GitHub sources have been connected.

| Test | Proves | Source cluster |
|---|---|---|
| `TestDemoChatCompletionFallsBackAndRecordsProof` | HTTP -> policy -> router -> fallback -> provider -> telemetry -> audit | Bifrost, Tyk, Hertz, OTel, project-layout |
| `TestDemoRejectsUnknownTenant` | unauthorized tenant rejected before provider call | Tyk, Clean Architecture |
| `TestEndpointMiddlewareWrapsServiceBoundary` | endpoint middleware wraps service in deterministic order | go-kit, Tyk, OTel |
| `TestEndpointMiddlewareCanShortCircuitBeforeProviderCall` | middleware can reject before provider/service execution | go-kit, Tyk |
| `TestErrorClassOfFindsWrappedGatewayError` | wrapped provider errors keep typed gateway class | Uber Go Guide, Bifrost |
| `TestCanFallbackByErrorClass` | retry/fallback decision is controlled by error taxonomy | Bifrost, Uber Go Guide |
| `TestGatewayFallbackRecordsTelemetry` | provider timeout can fallback and record attempts | Bifrost, Learn Go with Tests |
| `TestExecutorRespectsRetryBudget` | fallback is bounded | Bifrost, Temporal |
| `TestExecutorRecordsAuditLogs` | cost/error/fallback audit ledger | Tyk, Bifrost |
| `TestQueueRejectsWhenFull` | overload is explicit | Go by Example, NATS |
| `TestBreakerOpensAfterRetryableFailures` | provider failures change availability | Bifrost, go-kit |
| `TestTimedBreakerMovesToHalfOpenAfterCooldown` | breaker supports cooldown and half-open probe | Bifrost, go-kit |
| `TestBoundedClientRejectsWhenInFlightFull` | provider in-flight limit protects downstream capacity | Go by Example, NATS, Bifrost |
| `TestRunnerRecordsToolFlowAndReplayCompletes` | tool flow is replayable event history | trpc-agent-go, Temporal |
| `TestRunnerRecordsToolFailureEvent` | tool failure remains visible | trpc-agent-go |
| `TestGraphRecordsTransitionAndCompletion` | graph transition is durable fact | trpc-agent-go graph, Temporal |
| `TestGraphRecordsHumanInterrupt` | human interrupt is replayable | Temporal signal, agent runtime |
| `TestBusDoesNotBlockOnSlowSubscriber` | slow consumer does not block runtime | NATS, Memos |
| `TestStreamReplayFromCursorFillsDroppedEvents` | durable event store can fill live stream gaps | NATS, Memos, Temporal |
| `TestAsyncExporterDropsWhenQueueFull` | observability queue sheds load | OTel Collector |
| `TestAppShutdownsComponentsAfterContextCancel` | lifecycle handles shutdown | Caddy, Hertz, modern-go-application |
| `TestGracefulDrainStopsIngressBeforeWorkers` | shutdown order stops ingress before background workers drain | Caddy, Hertz, modern-go-application |
| `TestConfigSwapRejectsUnknownProviderInTenantPolicy` | invalid hot config is rejected before replacing current runtime config | Caddy admin config, Tyk policy, PocketBase product config |
| `TestConfigSwapRecordsAuditEvent` | accepted config hot swap records actor, versions and diff summary | Caddy admin config, Tyk policy, PocketBase product config |
| `TestConfigRollbackRestoresPriorVersionAsNewVersion` | rollback restores a previous config snapshot as a new audited version | Caddy config lifecycle, Syncthing safety goals |
| `TestClaimSuppressesDuplicateKey` | side effects are idempotent | Temporal, notification systems |
| `TestOutboxRetriesWithBackoff` | async side effects retry with scheduled backoff | Temporal, Memos, NATS |
| `TestOutboxMovesToDeadLetterAfterBudget` | failed async side effects move to DLQ after budget | Temporal, notification systems |
| `TestRAGToolReturnsCitedHits` | RAG tool returns cited knowledge | RAG architecture template |
| `TestRAGFiltersCrossTenantAndUnreadableChunks` | RAG retrieval enforces tenant/user access | RAG template, product auth lessons |
| `TestRouteScoringPrefersHealthyLowLatencyProvider` | route plan can be ranked by health/latency/cost | Bifrost, Tyk |
| `TestRouteScoringExcludesUnsupportedModel` | route scoring respects model capability | Bifrost, Tyk |
| `TestReplayUpcastsOldToolEventVersion` | old event payloads can replay after schema evolution | Temporal, Syncthing |

## Gap Backlog

These are intentionally not marked done yet. They are the next tests that would make the learning system stronger:

```text
gateway/router
  - Add policy-aware route score explanations to telemetry

gateway/provider
  - Add breaker state telemetry and half-open probe concurrency limit
  - Wire BoundedClient into provider runtime configuration

agent/event
  - Add upcaster coverage for assistant/tool-failed schema changes

platform/outbox
  - Add outbox worker lifecycle component
  - Add persistent outbox implementation

rag
  - TestRAGCitationDoesNotExposeUnreadableDocument

app
  - Add config diff details beyond provider/tenant counts
  - Add config rollback authorization policy
```

Add new proof tests only when they connect to a source, concept and production pattern. The learning loop should stay closed:

```text
GitHub source
  -> segment card
  -> concept
  -> Go translation
  -> local implementation
  -> test proof
  -> notes back into the handbook
```
