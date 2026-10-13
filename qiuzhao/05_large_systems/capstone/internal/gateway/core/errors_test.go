package core

import (
	"context"
	"fmt"
	"testing"
)

func TestErrorClassOfFindsWrappedGatewayError(t *testing.T) {
	err := fmt.Errorf("provider openai chat: %w", GatewayError{
		Class: ErrorTimeout,
		Route: Route{Provider: "openai", Model: "gpt-demo"},
		Err:   context.DeadlineExceeded,
	})

	if got := ErrorClassOf(err); got != ErrorTimeout {
		t.Fatalf("error class: want %s got %s", ErrorTimeout, got)
	}
}

func TestCanFallbackByErrorClass(t *testing.T) {
	tests := []struct {
		name  string
		class ErrorClass
		want  bool
	}{
		{name: "timeout", class: ErrorTimeout, want: true},
		{name: "rate limited", class: ErrorRateLimited, want: true},
		{name: "provider unavailable", class: ErrorProviderUnavailable, want: true},
		{name: "overloaded", class: ErrorOverloaded, want: true},
		{name: "invalid input", class: ErrorInvalidInput, want: false},
		{name: "unauthorized", class: ErrorUnauthorized, want: false},
		{name: "quota exceeded", class: ErrorQuotaExceeded, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := GatewayError{Class: tt.class, Err: context.Canceled}
			if got := CanFallback(err); got != tt.want {
				t.Fatalf("fallback: want %v got %v", tt.want, got)
			}
		})
	}
}
