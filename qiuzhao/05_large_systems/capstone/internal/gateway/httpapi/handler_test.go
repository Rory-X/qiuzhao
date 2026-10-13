package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type fakeChatService struct{}

func (fakeChatService) Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error) {
	return core.ChatResponse{
		RequestID: req.RequestID,
		Provider:  "fake",
		Model:     req.Model,
		Content:   "ok",
	}, nil
}

func TestChatHandlerReturnsServiceResponse(t *testing.T) {
	handler := NewHandler(fakeChatService{})
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{
		"request_id": "req-1",
		"tenant_id": "demo",
		"model": "gpt-demo",
		"messages": [{"role":"user","content":"hi"}]
	}`))
	rec := httptest.NewRecorder()

	handler.Chat(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"content":"ok"`) {
		t.Fatalf("body: %s", rec.Body.String())
	}
}
