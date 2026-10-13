# Source Map

这是全部 GitHub 材料的总图。它把“源仓库”连到“概念节点”和“本地 Go 实验”。

逐段知识卡片见 [`source-segments/README.md`](source-segments/README.md)。
来源到 Capstone 的知识网络见 [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)。
代码化落地见 [`reference-implementations.md`](reference-implementations.md)、[`system-blueprints.md`](system-blueprints.md)、[`mental-models-glossary.md`](mental-models-glossary.md) 和 [`capstone-implementation-manual.md`](capstone-implementation-manual.md)。
01-04 基础/结构/架构/真实项目源码级锚点见 [`source-code-anchors-foundations.md`](source-code-anchors-foundations.md)。
高级仓库源码级锚点见 [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)。

## Language

| Source | Status | Concepts | Local target |
|---|---|---|---|
| [go101/go101](https://github.com/go101/go101) | Mapped | type system, interface, generics, memory, concurrency semantics | `01_language_basics`, Capstone provider interfaces |
| [quii/learn-go-with-tests](https://github.com/quii/learn-go-with-tests) | Mapped | TDD, table tests, dependency injection, context | `api_service`, all `architecture_labs/*_test.go` |
| [mmcgrana/gobyexample](https://github.com/mmcgrana/gobyexample) | Mapped | worker pool, rate limit, context, channel direction | `architecture_labs/inference`, Capstone provider queue |
| [golang/example](https://github.com/golang/example) | Mapped | standard library HTTP, background goroutine, expvar | `api_service`, Capstone HTTP adapter |
| [inancgumus/learngo](https://github.com/inancgumus/learngo) | Mapped | syntax practice, interface practice, concurrency drills | `01_language_basics` |

## Structure And Style

| Source | Status | Concepts | Local target |
|---|---|---|---|
| [golang-standards/project-layout](https://github.com/golang-standards/project-layout) | Mapped | `cmd`, `internal`, `pkg`, package boundary | `api_service`, target package map |
| [uber-go/guide](https://github.com/uber-go/guide) | Mapped | error wrapping, channel buffer, container copy, lifecycle | all Go code |
| [google/styleguide/go](https://github.com/google/styleguide/tree/gh-pages/go) | Mapped | clarity, small interface, consumer-side interface | provider/router/agent interfaces |
| [sagikazarmark/modern-go-application](https://github.com/sagikazarmark/modern-go-application) | Mapped | production startup, config, telemetry, graceful shutdown | Capstone lifecycle |

## Architecture Patterns

| Source | Status | Concepts | Local target |
|---|---|---|---|
| [ThreeDotsLabs/wild-workouts-go-ddd-example](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example) | Mapped | DDD Lite, command handler, repository update closure, CQRS | `architecture_labs/agent`, Capstone runner/event store |
| [amitshekhariitbhu/go-backend-clean-architecture](https://github.com/amitshekhariitbhu/go-backend-clean-architecture) | Mapped | controller/usecase/repository, context timeout | `api_service`, Capstone gateway service |
| [evrone/go-clean-template](https://github.com/evrone/go-clean-template) | Mapped | multi transport, entity state machine, repository | Capstone HTTP + agent runner |
| [go-kit/examples](https://github.com/go-kit/examples) | Mapped | service, endpoint, transport middleware | Capstone gateway core/httpapi |

## Real Projects

| Source | Status | Concepts | Local target |
|---|---|---|---|
| [pocketbase/pocketbase](https://github.com/pocketbase/pocketbase) | Mapped | single binary product, hooks, admin API, realtime | Capstone provider registry/lifecycle |
| [usememos/memos](https://github.com/usememos/memos) | Mapped | server lifecycle, background runner, SSE broadcast, side effects | Capstone agent event flow |
| [caddyserver/caddy](https://github.com/caddyserver/caddy) | Mapped | module registry, dynamic config, app lifecycle | provider plugin lifecycle |
| [syncthing/syncthing](https://github.com/syncthing/syncthing) | Mapped | protocol boundary, safety goals, long-running state | agent event protocol |

## Advanced Systems

| Source | Status | Concepts | Local target |
|---|---|---|---|
| [maximhq/bifrost](https://github.com/maximhq/bifrost) | Anchored + Mapped | AI gateway, provider fallback, plugin pipeline, telemetry | `architecture_labs/gateway`, Capstone gateway/provider/fallback |
| [trpc-group/trpc-agent-go](https://github.com/trpc-group/trpc-agent-go) | Anchored + Mapped | agent, runner, event, graph, tool | `architecture_labs/agent`, Capstone agent/runner/tool/graph |
| [TykTechnologies/tyk](https://github.com/TykTechnologies/tyk) | Anchored + Mapped | API gateway, auth, policy, rate limit, analytics | Capstone gateway/policy/httpapi |
| [cloudwego/hertz](https://github.com/cloudwego/hertz) | Anchored + Mapped | high-performance HTTP, middleware, router, request context | Capstone gateway/httpapi |
| [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector) | Anchored + Mapped | receiver, processor, exporter, service pipeline | Capstone platform/telemetry |
| [temporalio/temporal](https://github.com/temporalio/temporal) | Anchored + Mapped | durable workflow, history, matching, workers | Capstone agent/event/replay |
| [nats-io/nats-server](https://github.com/nats-io/nats-server) | Anchored + Mapped | async messaging, fan-out, backpressure, JetStream | Capstone agent/stream and provider queue |

## Architecture Template Source

| Source | Status | Concepts | Local target |
|---|---|---|---|
| [study8677/awesome-architecture](https://github.com/study8677/awesome-architecture) | Mapped + Implemented | AI gateway, agent platform, RAG, inference, realtime chat, notification | `docs/architecture-to-go`, `architecture_labs`, Capstone package map |
