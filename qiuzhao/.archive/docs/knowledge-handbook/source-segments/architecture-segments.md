# Architecture Segment Cards

These cards turn architecture repositories into Go implementation patterns.

## ThreeDotsLabs/wild-workouts-go-ddd-example

### Segment: Domain Object Protects Invariants

Anchor: `internal/trainer/domain/hour/hour.go`.

Design extraction: domain methods should protect valid state transitions.

Go translation:

```go
func (s *Session) AppendAssistantMessage(content string) error {
	if s.status == SessionClosed {
		return ErrSessionClosed
	}
	s.events = append(s.events, Event{Type: EventAssistantMessage, Content: content})
	return nil
}
```

Local proof: `architecture_labs/agent` records ordered tool-call events, and Capstone agent runner replays tool flow in [`../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner_test.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/runner/runner_test.go).

Backlinks: [Agent Runtime](../concepts/agent-runtime.md).

### Segment: Repository Update Closure

Anchor: `internal/trainer/domain/hour/repository.go`.

Design extraction: repository owns read-modify-write transaction; domain owns mutation rules.

Go translation:

```go
type SessionRepository interface {
	Update(ctx context.Context, id string, fn func(*Session) error) error
}
```

Local proof: Capstone event store append/list/replay in [`../../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go`](../../../capstone_ai_gateway_agent_runtime/internal/agent/event/store.go) and runner replay tests.

Backlinks: [Durable Workflow](../concepts/durable-workflow.md).

## amitshekhariitbhu/go-backend-clean-architecture

### Segment: Usecase Timeout

Anchor: `usecase/task_usecase.go`.

Design extraction: application operations set deadlines around dependencies.

Go translation:

```go
func (u Usecase) Execute(ctx context.Context, req Request) (Response, error) {
	ctx, cancel := context.WithTimeout(ctx, u.timeout)
	defer cancel()
	return u.repo.Execute(ctx, req)
}
```

Local proof: Capstone HTTP handler passes request context to gateway service, and provider queue honors canceled context.

Backlinks: [Concurrency And Backpressure](../concepts/concurrency-backpressure.md).

### Segment: Controller Binding Only

Anchor: `api/controller/task_controller.go`.

Design extraction: controllers should decode/validate/encode, not route providers or mutate domain internals.

Go translation:

```go
func (h Handler) Create(w http.ResponseWriter, r *http.Request) {
	cmd, err := DecodeCreateCommand(r)
	if err != nil {
		WriteError(w, err)
		return
	}
	result, err := h.usecase.Create(r.Context(), cmd)
	WriteResult(w, result, err)
}
```

Backlinks: [Architecture Boundaries](../concepts/architecture-boundaries.md).

## evrone/go-clean-template

### Segment: Multi Transport

Anchor: `internal/controller/*`.

Design extraction: REST, gRPC, AMQP, NATS can call the same usecase.

Go translation:

```go
type AgentUsecase interface {
	SendMessage(ctx context.Context, cmd SendMessage) (MessageResult, error)
}

type HTTPController struct{ usecase AgentUsecase }
type WorkerController struct{ usecase AgentUsecase }
```

Local proof: Capstone keeps HTTP adapter, gateway service, agent runner and outbox worker as separate packages.

Backlinks: [Agent Runtime](../concepts/agent-runtime.md).

### Segment: Entity State Transition

Anchor: `internal/entity/task.go`.

Design extraction: state machines belong near entity/domain.

Go translation:

```go
func (r *Run) Fail(reason string) error {
	if r.Status == RunCompleted {
		return ErrInvalidTransition
	}
	r.Status = RunFailed
	r.Error = reason
	return nil
}
```

Backlinks: [Durable Workflow](../concepts/durable-workflow.md).

## go-kit/examples

### Segment: Service Endpoint Transport

Anchor: `addsvc/pkg/addservice`, `addendpoint`, `addtransport`.

Design extraction: transport should be replaceable; endpoint is where middleware composes.

Go translation:

```go
type ChatService interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
}

type ChatEndpoint func(context.Context, ChatRequest) (ChatResponse, error)

func MakeChatEndpoint(s ChatService) ChatEndpoint {
	return s.Chat
}
```

Local proof: [`../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint.go`](../../../capstone_ai_gateway_agent_runtime/internal/gateway/core/endpoint.go) and `TestEndpointMiddlewareWrapsServiceBoundary`.

Backlinks: [AI Gateway](../concepts/ai-gateway.md).

### Segment: Endpoint Middleware

Anchor: endpoint packages.

Design extraction: rate limit, metrics, trace, retry budget should wrap endpoint, not pollute service.

Go translation:

```go
func WithRateLimit(next ChatEndpoint, limiter Limiter) ChatEndpoint {
	return func(ctx context.Context, req ChatRequest) (ChatResponse, error) {
		if err := limiter.Allow(ctx, req.APIKey); err != nil {
			return ChatResponse{}, err
		}
		return next(ctx, req)
	}
}
```

Backlinks: [Observability](../concepts/observability.md).
