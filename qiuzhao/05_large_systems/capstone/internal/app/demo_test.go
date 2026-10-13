package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDemoChatCompletionFallsBackAndRecordsProof(t *testing.T) {
	demo := BuildDemo()
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{
		"request_id":"req-1",
		"tenant_id":"demo",
		"model":"gpt-demo",
		"provider":"primary",
		"fallbacks":[{"provider":"backup","model":"gpt-demo"}],
		"messages":[{"role":"user","content":"hello"}]
	}`))
	rec := httptest.NewRecorder()

	demo.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	var body struct {
		Provider string `json:"provider"`
		Content  string `json:"content"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Provider != "backup" || body.Content != "ok from backup" {
		t.Fatalf("body: %+v", body)
	}

	if !demo.Telemetry.Contains("gateway.provider_attempt", map[string]string{
		"provider":       "primary",
		"error_class":    "timeout",
		"fallback_index": "0",
	}) {
		t.Fatalf("missing primary telemetry: %+v", demo.Telemetry.Events())
	}
	if !demo.Telemetry.Contains("gateway.provider_attempt", map[string]string{
		"provider":       "backup",
		"error_class":    "",
		"fallback_index": "1",
	}) {
		t.Fatalf("missing backup telemetry: %+v", demo.Telemetry.Events())
	}

	logs := demo.Audit.Logs()
	if len(logs) != 2 {
		t.Fatalf("audit logs: %+v", logs)
	}
	if logs[0].Provider != "primary" || logs[0].ErrorClass == "" {
		t.Fatalf("primary audit log: %+v", logs[0])
	}
	if logs[1].Provider != "backup" || logs[1].CostMicros == 0 {
		t.Fatalf("backup audit log: %+v", logs[1])
	}
}

func TestDemoRejectsUnknownTenant(t *testing.T) {
	demo := BuildDemo()
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{
		"request_id":"req-2",
		"tenant_id":"unknown",
		"model":"gpt-demo",
		"messages":[{"role":"user","content":"hello"}]
	}`))
	rec := httptest.NewRecorder()

	demo.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status: want 401 got %d body=%s", rec.Code, rec.Body.String())
	}
}
