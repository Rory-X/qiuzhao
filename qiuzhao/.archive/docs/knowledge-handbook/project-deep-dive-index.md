# Project Deep Dive Index

这个文件把所有 GitHub 项目沉淀成统一格式：读什么、抽什么、落到哪里。详细阶段分析见 `01-05` 的 `github-project-analysis.md`。

逐段卡片入口：

- [`source-deep-dives.md`](source-deep-dives.md)：所有已纳入 GitHub 来源的源码段落、设计压力、Go 翻译代码和本地 proof。
- [`source-segments/language-segments.md`](source-segments/language-segments.md)
- [`source-segments/github-repo-reading-cards.md`](source-segments/github-repo-reading-cards.md)
- [`source-segments/structure-segments.md`](source-segments/structure-segments.md)
- [`source-segments/architecture-segments.md`](source-segments/architecture-segments.md)
- [`source-segments/real-project-segments.md`](source-segments/real-project-segments.md)
- [`source-code-anchors-foundations.md`](source-code-anchors-foundations.md)：01-04 仓库真实源码锚点、符号、行号和学习版 Go 翻译。
- [`source-segments/large-system-segments.md`](source-segments/large-system-segments.md)
- [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)：高级仓库真实源码锚点、符号、行号和学习版 Go 翻译。

覆盖矩阵见 [`traceability-matrix.md`](traceability-matrix.md)。
动手练习见 [`practice-workbook.md`](practice-workbook.md)。
来源到 Capstone 的知识网络见 [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)。
最终包级代码模板和 E2E 验收见 [`capstone-implementation-manual.md`](capstone-implementation-manual.md)。

## Language Sources

| Project | Core extraction | Code pattern | Local proof |
|---|---|---|---|
| Go 101 | interface/method set, memory, generics, concurrency semantics | small interface, typed event, generic state | provider interface, event type |
| Learn Go with Tests | behavior-first API, fake dependency, context testing | table test, fake provider, HTTP handler test | all `architecture_labs/*_test.go` |
| Go by Example | worker pool, rate limit, context, channel direction | bounded worker pool, limiter, read-only/write-only channel | inference queue, Capstone provider queue/bounded client |
| golang/example | standard library HTTP, background goroutine, expvar | `net/http` service, health check, background poller | `api_service` |
| learngo | syntax drills, type system, interfaces | defined type, receiver, basic concurrency | language notes and small exercises |

Source-level anchors for language sources are captured in [`source-code-anchors-foundations.md#01-language-basics`](source-code-anchors-foundations.md#01-language-basics).

## Structure And Style Sources

| Project | Core extraction | Code pattern | Local proof |
|---|---|---|---|
| project-layout | `cmd`, `internal`, `pkg`, `api` as intent | executable entry + private package | explain `api_service` tree |
| Uber Go Guide | error wrapping, channel size, container copy | `%w`, `TryEnqueue`, copied slices | `Events()`, `Drain()` copy checks |
| Google Go Styleguide | clarity, small interfaces, consumer-side interface | `ChatCaller` instead of huge `Provider` | provider interface exercise |
| modern-go-application | production startup, platform composition | app runner with HTTP + workers + telemetry | Capstone `cmd/gateway` and lifecycle |

Source-level anchors for structure/style sources are captured in [`source-code-anchors-foundations.md#02-project-structure-and-style`](source-code-anchors-foundations.md#02-project-structure-and-style).

## Architecture Pattern Sources

| Project | Core extraction | Code pattern | Local proof |
|---|---|---|---|
| Wild Workouts | domain object, command handler, repository closure | `Update(ctx,id,fn)` | agent session state transition |
| go-backend-clean-architecture | controller/usecase/repository and context timeout | usecase with deadline | API service context propagation |
| go-clean-template | multi transport and entity state machine | tool call transition | notification/tool status machine |
| go-kit examples | service/endpoint/transport and middleware | endpoint wrapper | Capstone `internal/gateway/core/endpoint.go` |

Source-level anchors for architecture sources are captured in [`source-code-anchors-foundations.md#03-architecture-patterns`](source-code-anchors-foundations.md#03-architecture-patterns).

## Real Project Sources

| Project | Core extraction | Code pattern | Local proof |
|---|---|---|---|
| PocketBase | single binary, hooks, admin API, realtime | request hook and plugin point | provider response hook |
| Memos | server lifecycle, background runner, SSE, side effects | main path + best-effort event | Capstone stream bus and outbox |
| Caddy | module registry, config lifecycle, admin update | `Module` lifecycle | Capstone config store and lifecycle |
| Syncthing | goals, protocol, model, long-running state | stable event protocol | Capstone event upcaster |

Source-level anchors for real project sources are captured in [`source-code-anchors-foundations.md#04-real-projects`](source-code-anchors-foundations.md#04-real-projects).

## Large System Sources

| Project | Core extraction | Code pattern | Local proof |
|---|---|---|---|
| Bifrost | provider queue, fallback, load balancing, observability | `ProviderQueue`, fallback loop | gateway lab |
| trpc-agent-go | Agent, Runner, Event, Tool, GraphAgent | event stream + tool executor + graph | agent runtime lab |
| Tyk | gateway middleware, policy, rate limit, analytics | auth/policy/quota middleware chain | gateway policy tests |
| Hertz | high-performance HTTP, request context, client middleware | adapter from HTTP context to business context | HTTP boundary |
| OpenTelemetry Collector | receiver/processor/exporter, exporter queue | telemetry pipeline | observability lab |
| Temporal | workflow history, matching, workers | replayable event history | durable agent event store |
| NATS | subject/subscription, route, JetStream, slow consumer | pub/sub bus with slow consumer policy | event bus / notification lab |
| awesome-architecture | system templates | package boundary and lab map | architecture_labs |

Source-level anchors for these large-system sources are captured in [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md).

## Deep Dive Template

Use this for every future project addition:

```markdown
## Project

Source:
Commit:
Read anchors:

### What problem

### Entry

### Core abstraction

### Critical path

### Code pattern

```go
// learning translation
```

### Local proof

### Backlinks
```

## Coverage Audit

Every project currently has at least:

- A source entry in [`source-map.md`](source-map.md).
- A phase analysis in `01-05/*/github-project-analysis.md`.
- A source paragraph deep dive in [`source-deep-dives.md`](source-deep-dives.md).
- A cross-source Capstone landing entry in [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md).
- A concept backlink in [`backlink-index.md`](backlink-index.md) or a phase document.
- At least one local code pattern or exercise.
- For 01-04 sources, at least one concrete source file/symbol anchor in [`source-code-anchors-foundations.md`](source-code-anchors-foundations.md).
- For advanced systems, at least one concrete source file/symbol anchor in [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md).
- For final system implementation, a package-level template and acceptance-test map in [`capstone-implementation-manual.md`](capstone-implementation-manual.md).
