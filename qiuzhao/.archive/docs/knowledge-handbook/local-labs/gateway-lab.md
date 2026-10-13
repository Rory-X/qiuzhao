# Gateway Lab Walkthrough

Local package: [`../../../architecture_labs/gateway`](../../../architecture_labs/gateway)

Architecture source:

- [AI Gateway template](../../architecture-to-go/templates/ai-gateway.md)
- [Bifrost segment cards](../source-segments/large-system-segments.md#maximhqbifrost)
- [Tyk segment cards](../source-segments/large-system-segments.md#tyktechnologiestyk)
- [AI Gateway concept](../concepts/ai-gateway.md)

## What This Lab Practices

The current lab focuses on the smallest useful AI gateway behavior: provider selection and fallback.

```text
preferred provider healthy
  -> use preferred

preferred provider unhealthy
  -> choose next healthy provider

no healthy provider
  -> return stable error
```

## Test First Reading

The tests define behavior:

```go
func TestRouterFallsBackWhenPreferredProviderIsUnhealthy(t *testing.T) {
	router := NewRouter([]Provider{
		{Name: "anthropic", Healthy: false},
		{Name: "openai", Healthy: true},
		{Name: "mock", Healthy: true},
	})

	selected, err := router.Select("anthropic")
	if err != nil {
		t.Fatalf("select provider: %v", err)
	}

	if selected.Name != "openai" {
		t.Fatalf("expected fallback openai, got %q", selected.Name)
	}
}
```

Learning point: fallback order is a policy. The lab currently uses list order.

## Implementation Reading

The router copies providers on construction:

```go
func NewRouter(providers []Provider) Router {
	copied := make([]Provider, len(providers))
	copy(copied, providers)
	return Router{providers: copied}
}
```

Why it matters:

- It avoids external mutation after router creation.
- It follows the slice-copy boundary from Uber/Google style guidance.
- It prepares the mental model for immutable route snapshots.

Selection has two passes:

```go
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

Why two passes:

- Pass 1 preserves explicit user/provider preference.
- Pass 2 applies fallback to any healthy provider.
- Error is stable and testable.

## What Is Missing For Production

Current lab does not yet model:

- model capability, for example chat vs embedding.
- tenant policy.
- fallback error taxonomy.
- provider queue and concurrency.
- latency/cost weighting.
- telemetry.

## Next Tests

Add route planning:

```go
func TestPlanIncludesPrimaryAndFallbacks(t *testing.T) {
	router := NewPolicyRouter([]Provider{
		{Name: "openai", Healthy: true},
		{Name: "anthropic", Healthy: true},
	})

	plan := router.Plan(RouteRequest{
		Preferred: "openai",
		Fallbacks: []string{"anthropic"},
	})

	if len(plan) != 2 {
		t.Fatalf("expected primary + fallback, got %d", len(plan))
	}
}
```

Add retryable error taxonomy:

```go
func TestInvalidInputDoesNotFallback(t *testing.T) {
	err := GatewayError{Class: ErrorInvalidInput, Err: errors.New("bad request")}
	if CanFallback(err) {
		t.Fatal("invalid input must not fallback")
	}
}
```

## Production Translation

```go
type RoutePlan struct {
	Attempts []RouteAttempt
}

type RouteAttempt struct {
	Provider string
	Model    string
	Reason   string
}

type Router interface {
	Plan(ctx context.Context, req ChatRequest, policy TenantPolicy) (RoutePlan, error)
}
```

## Knowledge Backlinks

- [Bifrost provider queue and fallback](../source-segments/large-system-segments.md#segment-provider-queue)
- [Tyk rate limit middleware](../source-segments/large-system-segments.md#segment-rate-limit-middleware)
- [Provider fallback error taxonomy](../go-code-patterns.md#6-provider-fallback-error-taxonomy)
- [Production readiness checklist](../production-readiness-checklist.md#gateway-core)
