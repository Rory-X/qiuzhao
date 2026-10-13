package core

import (
	"errors"
	"fmt"
)

type ErrorClass string

const (
	ErrorUnknown             ErrorClass = "unknown"
	ErrorTimeout             ErrorClass = "timeout"
	ErrorRateLimited         ErrorClass = "rate_limited"
	ErrorInvalidInput        ErrorClass = "invalid_input"
	ErrorUnauthorized        ErrorClass = "unauthorized"
	ErrorQuotaExceeded       ErrorClass = "quota_exceeded"
	ErrorProviderUnavailable ErrorClass = "provider_unavailable"
	ErrorProviderError       ErrorClass = "provider_error"
	ErrorOverloaded          ErrorClass = "overloaded"
	ErrorRetryBudget         ErrorClass = "retry_budget"
)

var (
	ErrNoProvider          = errors.New("no provider available")
	ErrProviderQueueFull   = errors.New("provider queue full")
	ErrTenantNotAllowed    = errors.New("tenant not allowed")
	ErrModelNotAllowed     = errors.New("model not allowed")
	ErrProviderNotAllowed  = errors.New("provider not allowed")
	ErrTokenBudgetExceeded = errors.New("token budget exceeded")
	ErrRetryBudgetExceeded = errors.New("retry budget exhausted")
)

type GatewayError struct {
	Class ErrorClass
	Route Route
	Err   error
}

func (e GatewayError) Error() string {
	if e.Route.Provider == "" {
		return fmt.Sprintf("%s: %v", e.Class, e.Err)
	}
	return fmt.Sprintf("%s %s/%s: %v", e.Class, e.Route.Provider, e.Route.Model, e.Err)
}

func (e GatewayError) Unwrap() error {
	return e.Err
}

func ErrorClassOf(err error) ErrorClass {
	if err == nil {
		return ""
	}
	var gatewayErr GatewayError
	if errors.As(err, &gatewayErr) {
		return gatewayErr.Class
	}
	return ErrorUnknown
}

func CanFallback(err error) bool {
	switch ErrorClassOf(err) {
	case ErrorTimeout, ErrorRateLimited, ErrorProviderUnavailable, ErrorProviderError, ErrorOverloaded:
		return true
	default:
		return false
	}
}
