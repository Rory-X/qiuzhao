# Local Go Labs Walkthrough

这个目录把本地 `architecture_labs` 读成知识手册。目标是让外部 GitHub 材料和本地 Go 代码实验闭环：

```text
GitHub architecture/source
  -> knowledge-handbook/source-segments
  -> local architecture_labs package
  -> capstone_ai_gateway_agent_runtime package
  -> test first
  -> implementation
  -> production expansion
```

## Labs

| Local lab | Architecture idea | Walkthrough |
|---|---|---|
| `architecture_labs/gateway` | AI Gateway provider fallback | [`gateway-lab.md`](gateway-lab.md) |
| `architecture_labs/agent` | Agent event flow and tool lifecycle | [`agent-lab.md`](agent-lab.md) |
| `architecture_labs/rag` | Chunk, retrieve, rerank, citation | [`rag-lab.md`](rag-lab.md) |
| `architecture_labs/inference` | Bounded queue and overload rejection | [`inference-lab.md`](inference-lab.md) |
| `architecture_labs/realtime` | Sequence and idempotency | [`realtime-lab.md`](realtime-lab.md) |
| `architecture_labs/notification` | Dedupe, limit, priority | [`notification-lab.md`](notification-lab.md) |
| `capstone_ai_gateway_agent_runtime` | Integrated gateway, agent, telemetry and lifecycle | [`capstone-lab.md`](capstone-lab.md) |

## How To Study A Lab

1. Read the matching architecture template under [`../../architecture-to-go/templates`](../../architecture-to-go/templates).
2. Read the lab test first.
3. Read the implementation.
4. Compare with GitHub source segment cards.
5. Write the next production-grade test before expanding code.

## Run

```bash
cd architecture_labs
go test ./...

cd ../capstone_ai_gateway_agent_runtime
go test ./...
```

配套练习见 [`../practice-workbook.md`](../practice-workbook.md)。
本地 lab 与外部 source 的覆盖关系见 [`../traceability-matrix.md`](../traceability-matrix.md)。
