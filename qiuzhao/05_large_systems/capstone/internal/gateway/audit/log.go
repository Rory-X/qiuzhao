package audit

import (
	"context"
	"sync"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type RequestLog struct {
	RequestID     core.RequestID
	TenantID      core.TenantID
	Provider      core.ProviderName
	Model         core.ModelName
	FallbackIndex int
	InputTokens   int
	OutputTokens  int
	ErrorClass    core.ErrorClass
	CostMicros    int64
}

type Sink interface {
	Record(ctx context.Context, log RequestLog) error
}

type MemoryLog struct {
	mu   sync.Mutex
	logs []RequestLog
}

func NewMemoryLog() *MemoryLog {
	return &MemoryLog{}
}

func (l *MemoryLog) Record(ctx context.Context, log RequestLog) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	l.logs = append(l.logs, log)
	return nil
}

func (l *MemoryLog) Logs() []RequestLog {
	l.mu.Lock()
	defer l.mu.Unlock()

	logs := make([]RequestLog, len(l.logs))
	copy(logs, l.logs)
	return logs
}

func EstimateCostMicros(inputTokens int, outputTokens int) int64 {
	return int64(inputTokens*10 + outputTokens*30)
}
