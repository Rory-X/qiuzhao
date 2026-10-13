# Architecture Anti-Patterns

这份手册收集从 GitHub 项目反向学到的反模式。每个反模式都给出症状、后果、修正方向和 Go 代码。

## Anti-Pattern 1: Fat Handler

症状：

```go
func (h Handler) Chat(w http.ResponseWriter, r *http.Request) {
	// decode
	// auth
	// rate limit
	// choose provider
	// call provider
	// fallback
	// write logs
	// update quota
	// encode response
}
```

后果：

- 无法单独测试 provider selection。
- fallback 和 rate limit 很难复用。
- observability 散落。

修正：

```go
func (h Handler) Chat(w http.ResponseWriter, r *http.Request) {
	req, err := DecodeChatRequest(r)
	if err != nil {
		WriteError(w, err)
		return
	}
	resp, err := h.usecase.Chat(r.Context(), req)
	WriteResponse(w, resp, err)
}
```

## Anti-Pattern 2: Giant Provider Interface

症状：

```go
type Provider interface {
	Chat(context.Context, ChatRequest) (ChatResponse, error)
	Embed(context.Context, EmbedRequest) (EmbedResponse, error)
	Rerank(context.Context, RerankRequest) (RerankResponse, error)
	Image(context.Context, ImageRequest) (ImageResponse, error)
	Transcribe(context.Context, AudioRequest) (TextResponse, error)
}
```

修正：

```go
type ChatProvider interface {
	Chat(context.Context, ChatRequest) (ChatResponse, error)
}

type EmbedProvider interface {
	Embed(context.Context, EmbedRequest) (EmbedResponse, error)
}
```

## Anti-Pattern 3: Infinite Retry

症状：

```go
for {
	resp, err := provider.Chat(ctx, req)
	if err == nil {
		return resp, nil
	}
}
```

后果：

- provider 故障时无限放大流量。
- 请求永不返回。
- 成本和延迟失控。

修正：

```go
for attempt := 0; attempt < maxAttempts; attempt++ {
	resp, err := provider.Chat(ctx, req)
	if err == nil {
		return resp, nil
	}
	if !CanRetry(err) {
		return ChatResponse{}, err
	}
}
return ChatResponse{}, ErrRetryBudgetExhausted
```

## Anti-Pattern 4: Unbounded Queue

症状：

```go
var queue []Request

func Enqueue(req Request) {
	queue = append(queue, req)
}
```

修正：

```go
func (q Queue) Enqueue(req Request) error {
	select {
	case q.items <- req:
		return nil
	default:
		return ErrQueueFull
	}
}
```

## Anti-Pattern 5: Goroutine Without Owner

症状：

```go
go func() {
	for {
		checkProviderHealth()
		time.Sleep(time.Second)
	}
}()
```

修正：

```go
func (h HealthChecker) Run(ctx context.Context) error {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			h.check(ctx)
		}
	}
}
```

## Anti-Pattern 6: Event As Log Text

症状：

```go
log.Printf("tool started: %s", toolName)
log.Printf("tool finished: %s", result)
```

后果：

- UI 不能可靠渲染。
- 无法 replay。
- 审计只能靠模糊搜索。

修正：

```go
store.Append(ctx, Event{
	Type:       EventToolCallStarted,
	ToolCallID: call.ID,
	ToolName:   call.Name,
})
```

## Anti-Pattern 7: Observability Without Business Dimensions

症状：

```go
httpRequestsTotal.WithLabelValues(status).Inc()
```

修正：

```go
gatewayRequestsTotal.WithLabelValues(
	tenantID,
	model,
	provider,
	errorClass,
).Inc()
```

## Anti-Pattern 8: Dynamic Config Without Validation

症状：

```go
currentConfig = newConfig
```

修正：

```go
func ApplyConfig(next Config) error {
	if err := next.Validate(); err != nil {
		return err
	}
	provisioned, err := Provision(next)
	if err != nil {
		return err
	}
	current.Store(provisioned)
	return nil
}
```

## Anti-Pattern 9: Tool Call Without Stable ID

症状：

```go
events.Append(Event{Type: "tool_started", ToolName: "search"})
events.Append(Event{Type: "tool_finished", Content: result})
```

修正：

```go
callID := uuid.NewString()
events.Append(Event{Type: EventToolCallStarted, ToolCallID: callID, ToolName: "search"})
events.Append(Event{Type: EventToolCallFinished, ToolCallID: callID, Content: result})
```

## Anti-Pattern 10: Synchronous Analytics In Hot Path

症状：

```go
func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	resp := h.callProvider(r.Context(), req)
	h.analyticsDB.Insert(r.Context(), AnalyticsRecord{...})
	WriteJSON(w, resp)
}
```

修正：

```go
h.telemetry.Record(TelemetryEvent{Provider: provider, Model: model, Latency: latency})
WriteJSON(w, resp)
```

where:

```go
func (s Sink) Record(event TelemetryEvent) {
	select {
	case s.queue <- event:
	default:
		s.dropped.Add(1)
	}
}
```

## Anti-Pattern 11: State In Prompt Only

症状：

```text
Prompt contains:
"You already called search and got result X."
```

后果：

- 系统无法恢复。
- 工具结果不可审计。
- 上下文裁剪会丢事实。

修正：

```go
type AgentState struct {
	Messages  []Message
	ToolCalls map[string]ToolCallState
}

func BuildPrompt(state AgentState) Prompt {
	return PromptFromState(state)
}
```

## Anti-Pattern 12: No Idempotency For External Side Effects

症状：

```go
func SendNotification(n Notification) error {
	return email.Send(n.UserEmail, n.Body)
}
```

修正：

```go
func SendNotification(ctx context.Context, n Notification) error {
	if sent, _ := store.WasSent(ctx, n.IdempotencyKey); sent {
		return nil
	}
	if err := email.Send(n.UserEmail, n.Body); err != nil {
		return err
	}
	return store.MarkSent(ctx, n.IdempotencyKey)
}
```
