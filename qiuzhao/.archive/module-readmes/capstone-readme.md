# Capstone AI Gateway Agent Runtime

这个 Go module 是知识手册的可运行落点：把 `AI Gateway + Agent Runtime` 的核心机制落成标准库优先、可测试的小型代码骨架。

它不是生产系统，也不是框架模板；它是学习用的“最终综合实验”：

```text
tenant policy
  -> route plan
  -> provider fallback
  -> telemetry

agent input
  -> event store
  -> scripted model command
  -> tool execution
  -> replay

process context
  -> component lifecycle
  -> graceful shutdown and drain order
```

## Package Map

| Package | Learning target | Source inspirations |
|---|---|---|
| `cmd/gateway` | runnable composition root and graceful shutdown | project-layout, modern-go-application |
| `internal/app` | demo wiring, runtime config validation and end-to-end HTTP proof | project-layout, Bifrost, Tyk, OTel, Caddy |
| `internal/gateway/core` | chat usecase, endpoint middleware, typed errors, route plan orchestration | go-kit, Clean Architecture, Bifrost |
| `internal/gateway/audit` | request log, token usage and cost estimate | Bifrost, Tyk analytics, Syncthing auditability |
| `internal/gateway/policy` | tenant/model/provider authorization and token budget | Tyk, Clean Architecture |
| `internal/gateway/router` | route plan and provider health filtering | Bifrost, Tyk |
| `internal/gateway/provider` | provider client, fake provider, registry, bounded queue | Bifrost, Go by Example, OTel queue |
| `internal/gateway/fallback` | fallback executor and provider-attempt telemetry | Bifrost, OpenTelemetry Collector |
| `internal/gateway/httpapi` | OpenAI-compatible HTTP adapter boundary | golang/example, Hertz, go-kit transport |
| `internal/agent/event` | append/list/replay event history | trpc-agent-go, Temporal |
| `internal/agent/graph` | node transition, step budget and human interrupt | trpc-agent-go GraphAgent, Temporal command validation |
| `internal/agent/tool` | tool registry and fake tool executors | trpc-agent-go, Temporal activity boundary |
| `internal/agent/stream` | session event fan-out and slow consumer policy | Memos, NATS |
| `internal/agent/runner` | model command loop and tool event timeline | trpc-agent-go, Wild Workouts |
| `internal/platform/telemetry` | memory exporter, async bounded queue and assertion-friendly events | OTel Collector, Tyk analytics |
| `internal/platform/idempotency` | duplicate side-effect suppression | Temporal, Memos, Notification template |
| `internal/platform/outbox` | retryable async side effects and dead-letter handling | Temporal, Memos, NATS |
| `internal/platform/lifecycle` | component start/shutdown orchestration | Caddy, modern-go-application, Hertz |

## Acceptance Tests

Run:

```bash
cd capstone_ai_gateway_agent_runtime
go test ./...
```

Important tests:

| Test | Proves |
|---|---|
| `TestEndpointMiddlewareWrapsServiceBoundary` | go-kit style endpoint middleware wraps the service boundary in deterministic order |
| `TestEndpointMiddlewareCanShortCircuitBeforeProviderCall` | gateway middleware can reject before service/provider execution |
| `TestErrorClassOfFindsWrappedGatewayError` | wrapped provider errors keep their typed gateway error class |
| `TestCanFallbackByErrorClass` | fallback decisions follow the error taxonomy |
| `TestGatewayFallbackRecordsTelemetry` | primary timeout falls back to backup and records both provider attempts |
| `TestGatewayRejectsDisallowedModel` | tenant policy blocks invalid model before provider call |
| `TestExecutorRecordsAuditLogs` | provider attempts produce token/cost/error audit records |
| `TestExecutorRespectsRetryBudget` | fallback stops when retry budget is exhausted |
| `TestQueueRejectsWhenFull` | bounded provider queue returns overload instead of hiding pressure |
| `TestBreakerOpensAfterRetryableFailures` | provider breaker opens after repeated retryable failures |
| `TestTimedBreakerMovesToHalfOpenAfterCooldown` | provider breaker supports cooldown and half-open recovery probe |
| `TestBoundedClientRejectsWhenInFlightFull` | provider in-flight limit returns overload instead of hiding pressure |
| `TestGraphRecordsTransitionAndCompletion` | graph node transitions are persisted as events |
| `TestGraphStopsAtStepBudget` | graph loops are bounded by explicit step budget |
| `TestGraphRecordsHumanInterrupt` | human interrupt is a replayable run state |
| `TestRunnerRecordsToolFlowAndReplayCompletes` | agent tool call becomes replayable event history |
| `TestRunnerRecordsToolFailureEvent` | tool failure is preserved as an event |
| `TestRAGToolReturnsCitedHits` | RAG tool returns cited local knowledge hits |
| `TestRAGFiltersCrossTenantAndUnreadableChunks` | RAG tool filters unreadable and cross-tenant documents |
| `TestBusDoesNotBlockOnSlowSubscriber` | event stream drops for slow consumers instead of blocking the runtime |
| `TestStreamReplayFromCursorFillsDroppedEvents` | stream replay can fill gaps from durable event history |
| `TestAsyncExporterDropsWhenQueueFull` | telemetry queue sheds load without blocking request path |
| `TestClaimSuppressesDuplicateKey` | idempotency store suppresses duplicate side effects |
| `TestOutboxRetriesWithBackoff` | async side effects retry with scheduled backoff |
| `TestOutboxMovesToDeadLetterAfterBudget` | exhausted side effects move to dead letter |
| `TestChatHandlerReturnsServiceResponse` | HTTP adapter stays thin and delegates to service |
| `TestAppShutdownsComponentsAfterContextCancel` | lifecycle shutdown runs after root context cancel |
| `TestGracefulDrainStopsIngressBeforeWorkers` | lifecycle drain stops ingress before background workers |
| `TestConfigSwapRejectsUnknownProviderInTenantPolicy` | hot config rejects unknown provider references before swap |
| `TestConfigSwapRecordsAuditEvent` | accepted hot config swap records actor, versions and summary |
| `TestConfigRollbackRestoresPriorVersionAsNewVersion` | rollback restores an older config as a new audited version |
| `TestDemoChatCompletionFallsBackAndRecordsProof` | full HTTP request path proves fallback, telemetry and audit |
| `TestDemoRejectsUnknownTenant` | full HTTP request path rejects unknown tenant before provider call |

## Run The Demo Gateway

```bash
cd capstone_ai_gateway_agent_runtime
go run ./cmd/gateway
```

Example request:

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{
    "request_id":"req-1",
    "tenant_id":"demo",
    "model":"gpt-demo",
    "provider":"primary",
    "fallbacks":[{"provider":"backup","model":"gpt-demo"}],
    "messages":[{"role":"user","content":"hello"}]
  }'
```

## Reading Order

1. [`../docs/knowledge-handbook/source-to-capstone-crosswalk.md`](../docs/knowledge-handbook/source-to-capstone-crosswalk.md)
2. [`../docs/knowledge-handbook/key-code-index.md`](../docs/knowledge-handbook/key-code-index.md)
3. [`../docs/knowledge-handbook/capstone-implementation-manual.md`](../docs/knowledge-handbook/capstone-implementation-manual.md)
4. [`../docs/knowledge-handbook/local-labs/capstone-lab.md`](../docs/knowledge-handbook/local-labs/capstone-lab.md)
5. The tests in this module.
6. The matching implementation packages.
