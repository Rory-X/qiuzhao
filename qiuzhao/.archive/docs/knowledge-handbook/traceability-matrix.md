# Traceability Matrix

这份矩阵证明知识手册不是散文：每个 GitHub source 都应该至少映射到本地文档、概念、代码模式或 lab。

## Legend

| Column | Meaning |
|---|---|
| Phase doc | `01-05/*/github-project-analysis.md` |
| Segment card | `docs/knowledge-handbook/source-segments/*` |
| Concept | `docs/knowledge-handbook/concepts/*` |
| Code pattern | `docs/knowledge-handbook/go-code-patterns.md`, `source-to-capstone-crosswalk.md`, `reference-implementations.md`, `system-blueprints.md`, `capstone-implementation-manual.md`, `source-code-anchors-foundations.md`, `source-code-anchors-advanced.md` or related handbooks |
| Local proof | local lab, API service, or future lab target |

## Language Sources

| Source | Phase doc | Segment card | Concept | Code pattern | Local proof |
|---|---|---|---|---|---|
| go101/go101 | `01_language_basics/github-project-analysis.md` | `language-segments.md` | Architecture Boundaries, AI Gateway | Small Interface, Defined Type | provider interface exercise |
| quii/learn-go-with-tests | `01_language_basics/github-project-analysis.md` | `language-segments.md` | Agent Runtime, AI Gateway | Table Test, Fake Dependency | `architecture_labs/*_test.go` |
| mmcgrana/gobyexample | `01_language_basics/github-project-analysis.md` | `language-segments.md` | Concurrency And Backpressure | Worker Pool, Rate Limiter | `architecture_labs/inference` |
| golang/example | `01_language_basics/github-project-analysis.md` | `language-segments.md` | Architecture Boundaries | Standard HTTP Handler | `api_service` |
| inancgumus/learngo | `01_language_basics/github-project-analysis.md` | `language-segments.md` | Agent Runtime | Defined Event Type | `architecture_labs/agent` |

## Structure And Style Sources

| Source | Phase doc | Segment card | Concept | Code pattern | Local proof |
|---|---|---|---|---|---|
| project-layout | `02_project_structure/github-project-analysis.md` | `structure-segments.md` | Architecture Boundaries | `cmd/internal/pkg` map | `api_service` structure |
| Uber Go Guide | `02_project_structure/github-project-analysis.md` | `structure-segments.md` | Backpressure, AI Gateway | Error Wrap, Queue, Copy | `Events()`, `Messages()`, `Drain()` |
| Google Go Styleguide | `02_project_structure/github-project-analysis.md` | `structure-segments.md` | Architecture Boundaries | Small Consumer Interface | provider/event store interfaces |
| modern-go-application | `02_project_structure/github-project-analysis.md` | `structure-segments.md` | Observability | App Composition | Capstone `cmd/gateway` and lifecycle |

## Architecture Pattern Sources

| Source | Phase doc | Segment card | Concept | Code pattern | Local proof |
|---|---|---|---|---|---|
| Wild Workouts | `03_architecture_patterns/github-project-analysis.md` | `architecture-segments.md` | Agent Runtime, Durable Workflow | Domain State Machine, Repository Closure | Capstone agent runner/event flow |
| go-backend-clean-architecture | `03_architecture_patterns/github-project-analysis.md` | `architecture-segments.md` | Architecture Boundaries | Usecase Timeout | `api_service` |
| go-clean-template | `03_architecture_patterns/github-project-analysis.md` | `architecture-segments.md` | Agent Runtime | Multi Transport, State Machine | Capstone graph state tests |
| go-kit/examples | `03_architecture_patterns/github-project-analysis.md` | `architecture-segments.md` | AI Gateway, Observability | Endpoint Middleware | Capstone `core/endpoint.go` |

## Real Project Sources

| Source | Phase doc | Segment card | Concept | Code pattern | Local proof |
|---|---|---|---|---|---|
| PocketBase | `04_real_projects/github-project-analysis.md` | `real-project-segments.md` | AI Gateway | Hook/Plugin Point | Capstone demo composition and fallback audit hook point |
| Memos | `04_real_projects/github-project-analysis.md` | `real-project-segments.md` | Agent Runtime, Durable Workflow | Best-Effort Side Effect, Server Lifecycle | Capstone stream bus and outbox |
| Caddy | `04_real_projects/github-project-analysis.md` | `real-project-segments.md` | AI Gateway, Architecture Boundaries | Module Lifecycle, Dynamic Config | Capstone `internal/app/config.go`, `platform/lifecycle` |
| Syncthing | `04_real_projects/github-project-analysis.md` | `real-project-segments.md` | Durable Workflow, Agent Runtime | Protocol Boundary, Goals First | agent event protocol |

## Large System Sources

| Source | Phase doc | Segment card | Concept | Code pattern | Local proof |
|---|---|---|---|---|---|
| Bifrost | `05_large_systems/github-project-analysis.md` | `large-system-segments.md` | AI Gateway, Backpressure | Provider Queue, Fallback Loop | `architecture_labs/gateway`, Capstone gateway/provider/fallback |
| trpc-agent-go | `05_large_systems/github-project-analysis.md` | `large-system-segments.md` | Agent Runtime | Event Store, Tool Executor, Graph | `architecture_labs/agent`, Capstone agent/runner/tool/graph |
| Tyk | `05_large_systems/github-project-analysis.md` | `large-system-segments.md` | AI Gateway | Middleware, Tenant Policy, Analytics | Capstone gateway/policy/httpapi |
| Hertz | `05_large_systems/github-project-analysis.md` | `large-system-segments.md` | Architecture Boundaries, Observability | HTTP Adapter, Provider Endpoint Middleware | Capstone gateway/httpapi |
| OpenTelemetry Collector | `05_large_systems/github-project-analysis.md` | `large-system-segments.md` | Observability | Receiver/Processor/Exporter, Async Exporter | Capstone platform/telemetry |
| Temporal | `05_large_systems/github-project-analysis.md` | `large-system-segments.md` | Durable Workflow | Event History, Task Queue, Command Validation | Capstone agent/event/replay |
| NATS | `05_large_systems/github-project-analysis.md` | `large-system-segments.md` | Backpressure, Durable Workflow | Pub/Sub, Stream, Slow Consumer | Capstone agent/stream and provider queue |
| awesome-architecture | `05_large_systems/github-project-analysis.md` | `large-system-segments.md` | AI Gateway, Agent Runtime, RAG, Inference | Package Templates | `architecture_labs`, Capstone package map |

## Local Lab Traceability

| Local lab | External inspirations | Concept | Walkthrough | Next proof |
|---|---|---|---|---|
| `gateway` | Bifrost, Tyk, go-kit | AI Gateway | `local-labs/gateway-lab.md` | route plan, error taxonomy |
| `agent` | trpc-agent-go, Temporal, Wild Workouts | Agent Runtime, Durable Workflow | `local-labs/agent-lab.md` | failure event, replay |
| `rag` | awesome-architecture RAG | RAG | `local-labs/rag-lab.md` | permission filter, retriever/reranker |
| `inference` | Go by Example, Bifrost, OTel queue | Backpressure | `local-labs/inference-lab.md` | token queue, context enqueue |
| `realtime` | NATS, Realtime Chat template | Backpressure | `local-labs/realtime-lab.md` | ack, replay after seq |
| `notification` | Memos, Notification template | Durable Workflow | `local-labs/notification-lab.md` | idempotency key, retry/DLQ |
| `capstone_ai_gateway_agent_runtime` | Bifrost, trpc-agent-go, Tyk, Hertz, OTel, Temporal, NATS, Caddy, Memos, Syncthing, awesome-architecture | AI Gateway, Agent Runtime, Observability, Durable Workflow, RAG | `local-labs/capstone-lab.md` | E2E HTTP demo, gateway fallback, retry budget, audit log, idempotency, breaker, queue full, RAG tool, graph transition/interrupt, stream slow consumer, async telemetry, agent replay, config hot swap, lifecycle drain |

## Requirement Coverage

Objective requirement: “所有 github 或其他沉淀经验和知识总结都要落到本地文档。”

Evidence:

- All named GitHub sources are listed in [`source-map.md`](source-map.md).
- All source groups have phase docs under `01-05`.
- All source groups have paragraph-level deep dives in [`source-deep-dives.md`](source-deep-dives.md).
- All source groups are mapped into the Capstone package map in [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md).
- All source groups are mapped into local test proof in [`source-to-test-proof.md`](source-to-test-proof.md).
- All source groups have segment cards under [`source-segments`](source-segments/README.md).
- Cross-project experience is captured in [`architecture-experience-lessons.md`](architecture-experience-lessons.md).
- Anti-patterns are captured in [`architecture-anti-patterns.md`](architecture-anti-patterns.md).
- Production checks are captured in [`production-readiness-checklist.md`](production-readiness-checklist.md).
- Local code labs are explained in [`local-labs`](local-labs/README.md).
- The integrated Capstone module is implemented under [`../../capstone_ai_gateway_agent_runtime`](../../capstone_ai_gateway_agent_runtime/README.md).
- Hands-on exercises are captured in [`practice-workbook.md`](practice-workbook.md).
- Final package-level implementation and E2E acceptance are captured in [`capstone-implementation-manual.md`](capstone-implementation-manual.md).

Objective requirement: “最好能附上关键代码块，越多代码呈现越好。”

Evidence:

- Code patterns are centralized in [`go-code-patterns.md`](go-code-patterns.md).
- Source-to-Capstone translations with many code blocks are centralized in [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md).
- Larger Go reference skeletons are centralized in [`reference-implementations.md`](reference-implementations.md).
- Full request/agent/telemetry/HA flows are mapped in [`system-blueprints.md`](system-blueprints.md).
- Terms and mental models are indexed in [`mental-models-glossary.md`](mental-models-glossary.md).
- Foundation source-level anchors are captured in [`source-code-anchors-foundations.md`](source-code-anchors-foundations.md).
- Advanced source-level anchors are captured in [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md).
- Capstone-level package code and acceptance-test snippets are captured in [`capstone-implementation-manual.md`](capstone-implementation-manual.md).
- Phase docs contain code blocks.
- Segment cards contain code translations.
- Local lab walkthroughs contain test and implementation snippets.
- Practice workbook contains test and implementation skeletons.
