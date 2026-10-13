# Architecture Labs

这个 Go module 把架构模板拆成小型代码实验。每个 package 只练一个核心机制，方便从架构图走到可测试代码。

## Packages

| Package | Architecture | What it practices |
|---|---|---|
| `gateway` | AI Gateway | Provider health selection and fallback |
| `agent` | AI Agent / Workflow | Session event flow and tool call lifecycle |
| `rag` | RAG Knowledge Base | Chunk, keyword retrieval, rerank, citation |
| `inference` | Inference Serving | Bounded batch queue and overload rejection |
| `realtime` | Realtime Chat | Conversation sequence and idempotent client IDs |
| `notification` | Notification System | Dedupe, per-user limit, priority delivery |

## Run

Install Go 1.22 or newer, then:

```bash
cd architecture_labs
go test ./...
```

Current environment note: Go is installed locally and `go test ./...` passes for this module.

## How To Study

Read in this order:

1. [`../docs/architecture-to-go/README.md`](../docs/architecture-to-go/README.md)
2. One design template under [`../docs/architecture-to-go/templates`](../docs/architecture-to-go/templates)
3. The matching package test file.
4. The matching package implementation.
5. The matching walkthrough under [`../docs/knowledge-handbook/local-labs`](../docs/knowledge-handbook/local-labs/README.md).

The test tells you the intended behavior. The implementation stays intentionally small so the architecture idea is visible.

## Walkthroughs

- [`gateway`](../docs/knowledge-handbook/local-labs/gateway-lab.md)
- [`agent`](../docs/knowledge-handbook/local-labs/agent-lab.md)
- [`rag`](../docs/knowledge-handbook/local-labs/rag-lab.md)
- [`inference`](../docs/knowledge-handbook/local-labs/inference-lab.md)
- [`realtime`](../docs/knowledge-handbook/local-labs/realtime-lab.md)
- [`notification`](../docs/knowledge-handbook/local-labs/notification-lab.md)

下一阶段代码路线见 [`../docs/knowledge-handbook/implementation-roadmap.md`](../docs/knowledge-handbook/implementation-roadmap.md)。
