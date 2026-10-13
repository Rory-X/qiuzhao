package core

import (
	"context"
	"errors"
	"testing"
)

func TestEndpointMiddlewareWrapsServiceBoundary(t *testing.T) {
	var order []string
	base := Endpoint(func(ctx context.Context, req ChatRequest) (ChatResponse, error) {
		order = append(order, "service")
		return ChatResponse{RequestID: req.RequestID, Provider: "primary", Content: "ok"}, nil
	})
	named := func(name string) EndpointMiddleware {
		return func(next Endpoint) Endpoint {
			return func(ctx context.Context, req ChatRequest) (ChatResponse, error) {
				order = append(order, "before:"+name)
				resp, err := next(ctx, req)
				order = append(order, "after:"+name)
				return resp, err
			}
		}
	}

	endpoint := ChainEndpoint(base, named("trace"), named("rate-limit"))
	resp, err := endpoint(context.Background(), ChatRequest{RequestID: "req-1"})
	if err != nil {
		t.Fatalf("endpoint: %v", err)
	}
	if resp.Content != "ok" {
		t.Fatalf("response: %+v", resp)
	}

	want := []string{
		"before:trace",
		"before:rate-limit",
		"service",
		"after:rate-limit",
		"after:trace",
	}
	if len(order) != len(want) {
		t.Fatalf("order: want %v got %v", want, order)
	}
	for i := range want {
		if order[i] != want[i] {
			t.Fatalf("order: want %v got %v", want, order)
		}
	}
}

func TestEndpointMiddlewareCanShortCircuitBeforeProviderCall(t *testing.T) {
	called := false
	base := Endpoint(func(ctx context.Context, req ChatRequest) (ChatResponse, error) {
		called = true
		return ChatResponse{}, nil
	})
	deny := func(next Endpoint) Endpoint {
		return func(ctx context.Context, req ChatRequest) (ChatResponse, error) {
			return ChatResponse{}, GatewayError{Class: ErrorUnauthorized, Err: errors.New("missing api key")}
		}
	}

	endpoint := ChainEndpoint(base, deny)
	_, err := endpoint(context.Background(), ChatRequest{RequestID: "req-2"})
	if ErrorClassOf(err) != ErrorUnauthorized {
		t.Fatalf("error class: want unauthorized got %s err=%v", ErrorClassOf(err), err)
	}
	if called {
		t.Fatal("provider/service should not be called after auth middleware rejects")
	}
}
