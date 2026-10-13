package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"example.com/go-learning-api/internal/resource"
)

func TestHandlerReportsHealth(t *testing.T) {
	handler := newTestHandler()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	handler.ServeHTTP(response, request)

	assertStatus(t, response.Code, http.StatusOK)

	var body map[string]string
	decodeJSON(t, response.Body.Bytes(), &body)
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %q", body["status"])
	}
}

func TestHandlerCreatesListsCompletesAndReportsProgress(t *testing.T) {
	handler := newTestHandler()

	createBody := []byte(`{"title":"Learn Go with Tests","url":"https://github.com/quii/learn-go-with-tests","category":"language"}`)
	createResponse := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/resources", bytes.NewReader(createBody))
	handler.ServeHTTP(createResponse, createRequest)

	assertStatus(t, createResponse.Code, http.StatusCreated)

	var created resource.Resource
	decodeJSON(t, createResponse.Body.Bytes(), &created)
	if created.ID != "res-1" {
		t.Fatalf("expected generated id res-1, got %q", created.ID)
	}
	if created.Completed {
		t.Fatal("new resources should not be completed")
	}

	listResponse := httptest.NewRecorder()
	listRequest := httptest.NewRequest(http.MethodGet, "/resources", nil)
	handler.ServeHTTP(listResponse, listRequest)

	assertStatus(t, listResponse.Code, http.StatusOK)

	var listBody struct {
		Items []resource.Resource `json:"items"`
	}
	decodeJSON(t, listResponse.Body.Bytes(), &listBody)
	if len(listBody.Items) != 1 {
		t.Fatalf("expected 1 resource, got %d", len(listBody.Items))
	}
	if listBody.Items[0].Title != "Learn Go with Tests" {
		t.Fatalf("expected listed title to match created resource, got %q", listBody.Items[0].Title)
	}

	completeResponse := httptest.NewRecorder()
	completeRequest := httptest.NewRequest(http.MethodPatch, "/resources/res-1/complete", nil)
	handler.ServeHTTP(completeResponse, completeRequest)

	assertStatus(t, completeResponse.Code, http.StatusOK)

	var completed resource.Resource
	decodeJSON(t, completeResponse.Body.Bytes(), &completed)
	if !completed.Completed {
		t.Fatal("expected completed resource")
	}

	progressResponse := httptest.NewRecorder()
	progressRequest := httptest.NewRequest(http.MethodGet, "/progress", nil)
	handler.ServeHTTP(progressResponse, progressRequest)

	assertStatus(t, progressResponse.Code, http.StatusOK)

	var progress resource.Progress
	decodeJSON(t, progressResponse.Body.Bytes(), &progress)
	if progress.Total != 1 || progress.Completed != 1 || progress.Percent != 100 {
		t.Fatalf("unexpected progress: %+v", progress)
	}
}

func TestHandlerRejectsInvalidCreateRequests(t *testing.T) {
	handler := newTestHandler()

	tests := []struct {
		name string
		body string
	}{
		{name: "malformed json", body: `{"title":`},
		{name: "empty title", body: `{"title":"   "}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, "/resources", bytes.NewReader([]byte(tt.body)))
			handler.ServeHTTP(response, request)

			assertStatus(t, response.Code, http.StatusBadRequest)

			var body map[string]string
			decodeJSON(t, response.Body.Bytes(), &body)
			if body["error"] == "" {
				t.Fatal("expected error message")
			}
		})
	}
}

func TestHandlerReturnsNotFoundForMissingResource(t *testing.T) {
	handler := newTestHandler()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/resources/res-missing/complete", nil)
	handler.ServeHTTP(response, request)

	assertStatus(t, response.Code, http.StatusNotFound)
}

func newTestHandler() http.Handler {
	repo := resource.NewMemoryRepository()
	service := resource.NewService(repo, func() time.Time {
		return time.Date(2026, 7, 5, 10, 0, 0, 0, time.UTC)
	})
	return NewHandler(service)
}

func assertStatus(t *testing.T, got int, want int) {
	t.Helper()
	if got != want {
		t.Fatalf("expected status %d, got %d", want, got)
	}
}

func decodeJSON(t *testing.T, data []byte, target any) {
	t.Helper()
	if err := json.Unmarshal(data, target); err != nil {
		t.Fatalf("decode json: %v\nbody: %s", err, string(data))
	}
}
