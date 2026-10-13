# Architecture Lab Code Anchors

这个文件把 [study8677/awesome-architecture](https://github.com/study8677/awesome-architecture/tree/609e0cd64d6af89549112379cbdd0f0e6cf63a3a) 的第一批架构模板落到本地 `architecture_labs` 真实 Go 代码。它不是模板目录的重复说明，而是“架构图 -> Go 类型 -> 行为测试 -> Capstone 扩展”的代码锚点。

Backlinks:

- Template map: [`README.md`](README.md)
- Source snapshot: [`source-awesome-architecture.md`](source-awesome-architecture.md)
- Phase matrix: [`phase-1-matrix.md`](phase-1-matrix.md)
- Knowledge network: [`../knowledge-handbook/source-to-capstone-crosswalk.md`](../knowledge-handbook/source-to-capstone-crosswalk.md)
- Capstone key code: [`../knowledge-handbook/key-code-index.md`](../knowledge-handbook/key-code-index.md)

## 1. AI Gateway

Architecture source:

- [`templates/ai-gateway.md`](templates/ai-gateway.md)
- Local code: [`../../architecture_labs/gateway/router.go`](../../architecture_labs/gateway/router.go)
- Local test: [`../../architecture_labs/gateway/router_test.go`](../../architecture_labs/gateway/router_test.go)
- Capstone expansion: [`../../capstone_ai_gateway_agent_runtime/internal/gateway/router/planner.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/router/planner.go)

最小实验只证明 provider selection 和 fallback。这个代码故意简单，因为第一阶段要先抓住路由骨架。

```go
type Router struct {
	providers []Provider
}

func NewRouter(providers []Provider) Router {
	copied := make([]Provider, len(providers))
	copy(copied, providers)
	return Router{providers: copied}
}

func (r Router) Select(preferred string) (Provider, error) {
	for _, provider := range r.providers {
		if provider.Name == preferred && provider.Healthy {
			return provider, nil
		}
	}

	for _, provider := range r.providers {
		if provider.Healthy {
			return provider, nil
		}
	}

	return Provider{}, ErrNoHealthyProvider
}
```

测试应该表达业务行为：

```go
func TestRouterSkipsUnhealthyPreferredProvider(t *testing.T) {
	router := NewRouter([]Provider{
		{Name: "openai", Healthy: true},
		{Name: "anthropic", Healthy: false},
		{Name: "mock", Healthy: true},
	})

	got, err := router.Select("anthropic")
	if err != nil {
		t.Fatalf("select: %v", err)
	}
	if got.Name != "openai" {
		t.Fatalf("provider: want openai got %s", got.Name)
	}
}
```

Capstone 扩展点：

- `Provider` 从简单 health 扩展到 model capability、cost、latency、error rate。
- `Router.Select` 扩展成 `Planner.Plan`，返回多次 fallback attempts。
- provider queue、breaker、telemetry 和 audit 挂在执行层，而不是塞进 router。

## 2. AI Agent Platform

Architecture source:

- [`templates/ai-agent-platform.md`](templates/ai-agent-platform.md)
- Local code: [`../../architecture_labs/agent/session.go`](../../architecture_labs/agent/session.go)
- Local test: [`../../architecture_labs/agent/session_test.go`](../../architecture_labs/agent/session_test.go)
- Capstone expansion: [`../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner.go)

Agent 的第一性原理：一次运行不是一个返回值，而是一串事件。

```go
type Session struct {
	id     string
	events []Event
}

func NewSession(id string) *Session {
	return &Session{id: id}
}

func (s *Session) AddUserMessage(content string) {
	s.events = append(s.events, Event{
		Type:    EventUserMessage,
		Content: content,
	})
}

func (s *Session) StartToolCall(id string, name string) {
	s.events = append(s.events, Event{
		Type:       EventToolCallStarted,
		ToolCallID: id,
		ToolName:   name,
	})
}

func (s *Session) FinishToolCall(id string, result string) {
	s.events = append(s.events, Event{
		Type:       EventToolCallFinished,
		ToolCallID: id,
		Content:    result,
	})
}

func (s *Session) AddAssistantMessage(content string) {
	s.events = append(s.events, Event{
		Type:    EventAssistantMessage,
		Content: content,
	})
}
```

测试目标：

```go
func TestSessionRecordsAgentTimeline(t *testing.T) {
	session := NewSession("s1")
	session.AddUserMessage("search docs")
	session.StartToolCall("tool-1", "search")
	session.FinishToolCall("tool-1", `{"title":"doc"}`)
	session.AddAssistantMessage("found it")

	events := session.Events()
	if len(events) != 4 {
		t.Fatalf("events: %d", len(events))
	}
	if events[1].ToolCallID != "tool-1" {
		t.Fatalf("tool call id: %s", events[1].ToolCallID)
	}
}
```

Capstone 扩展点：

- `Session` 变成 event store + replay。
- `StartToolCall`/`FinishToolCall` 由 runner 根据 model command 触发。
- graph agent 增加 node transition、interrupt、step budget。

## 3. RAG Knowledge Base

Architecture source:

- [`templates/rag-knowledge-base.md`](templates/rag-knowledge-base.md)
- Local code: [`../../architecture_labs/rag/pipeline.go`](../../architecture_labs/rag/pipeline.go)
- Local test: [`../../architecture_labs/rag/pipeline_test.go`](../../architecture_labs/rag/pipeline_test.go)
- Capstone expansion: [`../../capstone_ai_gateway_agent_runtime/internal/agent/tool/rag.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/tool/rag.go)

第一阶段不用向量数据库，先用文本 pipeline 把 chunk、retrieve、rerank、citation 的边界写出来。

```go
type Pipeline struct {
	chunkWords int
}

func NewPipeline(chunkWords int) Pipeline {
	if chunkWords <= 0 {
		chunkWords = 64
	}
	return Pipeline{chunkWords: chunkWords}
}

func (p Pipeline) Query(docs []Document, query string, limit int) Result {
	if limit <= 0 {
		limit = 3
	}

	terms := strings.Fields(strings.ToLower(query))
	chunks := p.chunk(docs)
	for i := range chunks {
		chunks[i].Score = score(chunks[i].Text, terms)
	}

	sort.SliceStable(chunks, func(i, j int) bool {
		return chunks[i].Score > chunks[j].Score
	})

	citations := make([]Citation, 0, limit)
	for _, chunk := range chunks {
		if chunk.Score == 0 {
			continue
		}
		citations = append(citations, Citation{
			DocumentID: chunk.DocumentID,
			Text:       chunk.Text,
			Score:      chunk.Score,
		})
		if len(citations) == limit {
			break
		}
	}

	return Result{Citations: citations}
}
```

核心评分函数：

```go
func score(text string, terms []string) int {
	lower := strings.ToLower(text)
	total := 0
	for _, term := range terms {
		if strings.Contains(lower, term) {
			total++
		}
	}
	return total
}
```

Capstone 扩展点：

- `score` 替换成 BM25/vector/hybrid retriever。
- citation 保留 document ID、chunk ID、offset 和权限信息。
- RAG tool 作为 agent tool 被 runner 调用，结果进入 event history。

## 4. Inference Serving

Architecture source:

- [`templates/inference-serving.md`](templates/inference-serving.md)
- Local code: [`../../architecture_labs/inference/batch_queue.go`](../../architecture_labs/inference/batch_queue.go)
- Local test: [`../../architecture_labs/inference/batch_queue_test.go`](../../architecture_labs/inference/batch_queue_test.go)
- Capstone expansion: [`../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go`](../../capstone_ai_gateway_agent_runtime/internal/gateway/provider/queue.go)

推理服务第一阶段先练 bounded queue，目标是明确 overload 语义。

```go
type BatchQueue struct {
	capacity int
	items    []Request
}

func NewBatchQueue(capacity int) *BatchQueue {
	if capacity < 1 {
		capacity = 1
	}
	return &BatchQueue{capacity: capacity}
}

func (q *BatchQueue) Enqueue(request Request) error {
	if len(q.items) >= q.capacity {
		return ErrQueueFull
	}
	q.items = append(q.items, request)
	return nil
}

func (q *BatchQueue) Drain() Batch {
	requests := make([]Request, len(q.items))
	copy(requests, q.items)
	q.items = q.items[:0]
	return Batch{Requests: requests}
}
```

测试目标：

```go
func TestBatchQueueRejectsWhenFull(t *testing.T) {
	queue := NewBatchQueue(2)
	_ = queue.Enqueue(Request{ID: "r1"})
	_ = queue.Enqueue(Request{ID: "r2"})

	if err := queue.Enqueue(Request{ID: "r3"}); !errors.Is(err, ErrQueueFull) {
		t.Fatalf("want queue full, got %v", err)
	}
}
```

Capstone 扩展点：

- provider queue 加 `context.Context` 和 typed overload error。
- batch queue 扩展为按 token、deadline、priority 调度。
- overload 指标进入 telemetry，帮助判断扩容或降级。

## 5. Realtime Chat

Architecture source:

- [`templates/realtime-chat.md`](templates/realtime-chat.md)
- Local code: [`../../architecture_labs/realtime/conversation.go`](../../architecture_labs/realtime/conversation.go)
- Local test: [`../../architecture_labs/realtime/conversation_test.go`](../../architecture_labs/realtime/conversation_test.go)
- Capstone expansion: [`../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go`](../../capstone_ai_gateway_agent_runtime/internal/agent/stream/bus.go)

实时系统先解决局部有序和幂等，不急着追求全局有序。

```go
type Conversation struct {
	id       string
	nextSeq  int64
	messages []Message
	seen     map[string]Message
}

func NewConversation(id string) *Conversation {
	return &Conversation{
		id:      id,
		nextSeq: 1,
		seen:    make(map[string]Message),
	}
}

func (c *Conversation) Accept(clientID string, body string) Message {
	if message, ok := c.seen[clientID]; ok {
		return message
	}

	message := Message{
		ClientID: clientID,
		Seq:      c.nextSeq,
		Body:     body,
	}
	c.nextSeq++
	c.messages = append(c.messages, message)
	c.seen[clientID] = message
	return message
}
```

Capstone 扩展点：

- `clientID` 对应幂等键。
- `Seq` 对应 session 内 event offset。
- agent stream 使用 slow consumer drop policy，durable event store 负责补齐。

## 6. Notification System

Architecture source:

- [`templates/notification-system.md`](templates/notification-system.md)
- Local code: [`../../architecture_labs/notification/pipeline.go`](../../architecture_labs/notification/pipeline.go)
- Local test: [`../../architecture_labs/notification/pipeline_test.go`](../../architecture_labs/notification/pipeline_test.go)
- Capstone expansion: [`../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store.go`](../../capstone_ai_gateway_agent_runtime/internal/platform/idempotency/store.go)

通知系统第一阶段训练三件事：dedupe、per-user limit、priority drain。

```go
type Pipeline struct {
	perUserLimit int
	seen         map[string]struct{}
	userCounts   map[string]int
	queue        []Notification
}

func NewPipeline(perUserLimit int) *Pipeline {
	if perUserLimit < 1 {
		perUserLimit = 1
	}
	return &Pipeline{
		perUserLimit: perUserLimit,
		seen:         make(map[string]struct{}),
		userCounts:   make(map[string]int),
	}
}

func (p *Pipeline) Accept(notification Notification) bool {
	if _, ok := p.seen[notification.ID]; ok {
		return false
	}
	if p.userCounts[notification.UserID] >= p.perUserLimit {
		return false
	}

	p.seen[notification.ID] = struct{}{}
	p.userCounts[notification.UserID]++
	p.queue = append(p.queue, notification)
	return true
}

func (p *Pipeline) Drain() []Notification {
	delivered := make([]Notification, len(p.queue))
	copy(delivered, p.queue)
	sort.SliceStable(delivered, func(i, j int) bool {
		return delivered[i].Priority > delivered[j].Priority
	})
	p.queue = p.queue[:0]
	return delivered
}
```

Capstone 扩展点：

- dedupe 进入 idempotency store，用于 tool side effect 和 message send。
- limit 进入 tenant/user quota。
- priority drain 进入 async task queue 或 provider fallback queue。

## Run All Labs

```bash
cd /Users/jiahaoqian/proj/go_learning/architecture_labs
go test ./...
```

这些 lab 的学习顺序：

```text
gateway router
  -> inference queue
  -> notification idempotency/priority
  -> realtime sequence/dedupe
  -> agent event timeline
  -> rag citation pipeline
  -> capstone_ai_gateway_agent_runtime
```
