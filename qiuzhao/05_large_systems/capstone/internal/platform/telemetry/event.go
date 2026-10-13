package telemetry

import "context"

type Event struct {
	Name          string
	RequestID     string
	TenantID      string
	Model         string
	Provider      string
	ErrorClass    string
	FallbackIndex int
	LatencyMS     int64
}

type Sink interface {
	Record(ctx context.Context, event Event) error
}
