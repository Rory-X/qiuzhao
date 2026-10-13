# Phase 1 Matrix

| Architecture template | Go package | Core interface or type | Test behavior | Later expansion |
|---|---|---|---|---|
| AI Gateway | `gateway` | `Router`, `Provider` | healthy primary wins, unhealthy primary falls back | weighted routing, rate limit, circuit breaker, streaming proxy |
| AI Agent / Workflow | `agent` | `Session`, `Event`, `ToolCall` | events are appended in order with tool lifecycle | graph routing, persistence, human approval |
| RAG Knowledge Base | `rag` | `Pipeline`, `Chunk`, `Citation` | keyword retrieval returns cited chunks in ranked order | vector search, hybrid search, reranker, permission filtering |
| Inference Serving | `inference` | `BatchQueue` | bounded queue rejects overflow and drains batches | continuous batching, priority queue, GPU replica routing |
| Realtime Chat | `realtime` | `Conversation` | per-conversation sequence is monotonic and idempotent | websocket gateway, ack/retry, offline inbox |
| Notification System | `notification` | `Pipeline`, `Notification` | dedupe suppresses repeats and priority orders delivery | channel adapters, retry, user preference, provider fallback |

## Milestone Output

After this phase, you should be able to explain and code:

- 为什么 AI 网关必须把 provider 差异藏在 adapter 后面。
- 为什么 agent runtime 的核心是 event stream，而不是一次 HTTP response。
- 为什么 RAG 不是“向量库 = 全部”，还需要 chunk、rerank、citation 和权限。
- 为什么推理服务要关注 batch queue 和尾延迟。
- 为什么实时系统只在最小必要范围内保序。
- 为什么通知系统必须异步、去重、限频。
