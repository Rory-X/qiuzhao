# Go Learning API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small Go learning workspace and a runnable learning-resource API.

**Architecture:** Documentation lives at the workspace root. The API is a nested Go module under `api_service`, using standard library HTTP, a resource service, and an in-memory repository.

**Tech Stack:** Go standard library, `net/http`, `httptest`, in-memory storage.

---

## File Structure

- `README.md`: workspace entry point and command index.
- `01_language_basics/README.md`: language learning route.
- `02_project_structure/README.md`: Go project structure notes.
- `03_architecture_patterns/README.md`: architecture-pattern study notes.
- `04_real_projects/README.md`: real-project reading guide.
- `api_service/go.mod`: nested Go module.
- `api_service/cmd/api/main.go`: executable entry point.
- `api_service/internal/resource/*.go`: model, service, repository.
- `api_service/internal/httpapi/*.go`: HTTP routes and tests.
- `docs/*.md`: tutorial, how-to, reference, explanation.

### Task 1: API Behavior Tests

**Files:**
- Create: `api_service/go.mod`
- Create: `api_service/internal/httpapi/handler_test.go`

- [ ] **Step 1: Write failing HTTP behavior tests**

```go
func TestHandlerCreatesListsCompletesAndReportsProgress(t *testing.T) {
    // POST /resources creates res-1.
    // GET /resources returns the item.
    // PATCH /resources/res-1/complete marks it complete.
    // GET /progress reports total=1 completed=1 percent=100.
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd api_service
go test ./...
```

Expected: fail before implementation because `NewHandler` and resource package pieces do not exist.

### Task 2: Resource Domain

**Files:**
- Create: `api_service/internal/resource/model.go`
- Create: `api_service/internal/resource/repository.go`
- Create: `api_service/internal/resource/service.go`

- [ ] **Step 1: Implement resource model**

```go
type Resource struct {
    ID        string    `json:"id"`
    Title     string    `json:"title"`
    URL       string    `json:"url,omitempty"`
    Category  string    `json:"category,omitempty"`
    Completed bool      `json:"completed"`
    CreatedAt time.Time `json:"created_at"`
}
```

- [ ] **Step 2: Implement service operations**

```go
Create(ctx, input)
List(ctx)
Complete(ctx, id)
Progress(ctx)
```

Expected: validation rejects empty titles, missing IDs return not found, progress handles zero resources.

### Task 3: HTTP API

**Files:**
- Create: `api_service/internal/httpapi/handler.go`
- Create: `api_service/cmd/api/main.go`

- [ ] **Step 1: Implement routes**

```text
GET    /healthz
POST   /resources
GET    /resources
PATCH  /resources/{id}/complete
GET    /progress
```

- [ ] **Step 2: Run tests**

```bash
cd api_service
go test ./...
```

Expected: all tests pass.

### Task 4: Documentation

**Files:**
- Create: `docs/tutorial-first-api.md`
- Create: `docs/how-to-run-api.md`
- Create: `docs/reference-api.md`
- Create: `docs/explanation-architecture.md`
- Create: `api_service/README.md`

- [ ] **Step 1: Document how to run and test**

Expected: a reader can install Go, run tests, start the API, and call every endpoint with `curl`.

- [ ] **Step 2: Cross-link docs from README**

Expected: every doc is reachable from the root README within two clicks.
