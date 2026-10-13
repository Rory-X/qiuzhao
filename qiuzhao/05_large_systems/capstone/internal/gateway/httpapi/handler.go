package httpapi

import (
	"context"
	"encoding/json"
	"net/http"

	"example.com/capstone-ai-gateway-agent-runtime/internal/gateway/core"
)

type ChatService interface {
	Chat(ctx context.Context, req core.ChatRequest) (core.ChatResponse, error)
}

type Handler struct {
	service ChatService
}

func NewHandler(service ChatService) Handler {
	return Handler{service: service}
}

func RegisterRoutes(mux *http.ServeMux, handler Handler) {
	mux.HandleFunc("POST /v1/chat/completions", handler.Chat)
	mux.HandleFunc("GET /healthz", handler.Health)
}

func (h Handler) Chat(w http.ResponseWriter, r *http.Request) {
	var req core.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	resp, err := h.service.Chat(r.Context(), req)
	if err != nil {
		writeError(w, statusFor(err), err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h Handler) Health(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func statusFor(err error) int {
	switch core.ErrorClassOf(err) {
	case core.ErrorUnauthorized:
		return http.StatusUnauthorized
	case core.ErrorInvalidInput:
		return http.StatusBadRequest
	case core.ErrorRateLimited, core.ErrorQuotaExceeded:
		return http.StatusTooManyRequests
	case core.ErrorOverloaded, core.ErrorProviderUnavailable, core.ErrorTimeout:
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}
