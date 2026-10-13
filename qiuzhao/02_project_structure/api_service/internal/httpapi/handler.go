package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"example.com/go-learning-api/internal/resource"
)

type Handler struct {
	service *resource.Service
}

func NewHandler(service *resource.Service) http.Handler {
	return &Handler{service: service}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch {
	case r.URL.Path == "/healthz":
		h.handleHealth(w, r)
	case r.URL.Path == "/resources":
		h.handleResources(w, r)
	case strings.HasPrefix(r.URL.Path, "/resources/") && strings.HasSuffix(r.URL.Path, "/complete"):
		h.handleComplete(w, r)
	case r.URL.Path == "/progress":
		h.handleProgress(w, r)
	default:
		writeError(w, http.StatusNotFound, "not found")
	}
}

func (h *Handler) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w, http.MethodGet)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) handleResources(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := h.service.List(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "list resources")
			return
		}
		writeJSON(w, http.StatusOK, map[string][]resource.Resource{"items": items})
	case http.MethodPost:
		h.handleCreate(w, r)
	default:
		writeMethodNotAllowed(w, http.MethodGet, http.MethodPost)
	}
}

func (h *Handler) handleCreate(w http.ResponseWriter, r *http.Request) {
	var input resource.CreateInput
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	item, err := h.service.Create(r.Context(), input)
	if err != nil {
		writeResourceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, item)
}

func (h *Handler) handleComplete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		writeMethodNotAllowed(w, http.MethodPatch)
		return
	}

	id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/resources/"), "/complete")
	id = strings.Trim(id, "/")
	if id == "" || strings.Contains(id, "/") {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	item, err := h.service.Complete(r.Context(), id)
	if err != nil {
		writeResourceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, item)
}

func (h *Handler) handleProgress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w, http.MethodGet)
		return
	}

	progress, err := h.service.Progress(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "calculate progress")
		return
	}

	writeJSON(w, http.StatusOK, progress)
}

func writeResourceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, resource.ErrInvalidTitle):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, resource.ErrNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal server error")
	}
}

func writeMethodNotAllowed(w http.ResponseWriter, allowed ...string) {
	w.Header().Set("Allow", strings.Join(allowed, ", "))
	writeError(w, http.StatusMethodNotAllowed, "method not allowed")
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
