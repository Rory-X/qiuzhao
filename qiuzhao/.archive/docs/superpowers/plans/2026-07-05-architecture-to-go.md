# Architecture To Go Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate the first batch of awesome-architecture templates into Go design templates and small test-driven code labs.

**Architecture:** Documentation explains the architecture-to-Go mapping. `architecture_labs` is a standalone Go module with one package per architecture mechanism.

**Tech Stack:** Go standard library, table-driven tests, no external dependencies.

---

## File Structure

- Create `docs/architecture-to-go/README.md`: landing page for the architecture-to-Go track.
- Create `docs/architecture-to-go/source-awesome-architecture.md`: source snapshot and reading method.
- Create `docs/architecture-to-go/phase-1-matrix.md`: six-template mapping matrix.
- Create `docs/architecture-to-go/templates/*.md`: one Go design template per architecture.
- Create `architecture_labs/go.mod`: standalone module.
- Create `architecture_labs/{gateway,agent,rag,inference,realtime,notification}`: code labs.

## Task 1: Documentation Skeleton

- [ ] **Step 1: Create architecture-to-Go index**

Create `docs/architecture-to-go/README.md` with the first-batch roadmap, source links, and links to every template.

- [ ] **Step 2: Create phase matrix**

Create `docs/architecture-to-go/phase-1-matrix.md` mapping each architecture template to Go packages, interfaces, tests, and extension tasks.

## Task 2: Test-First Code Labs

- [ ] **Step 1: Write gateway routing test**

Test provider selection prefers healthy providers and falls back when the primary is unhealthy.

- [ ] **Step 2: Write agent session test**

Test a session records user message, tool call, tool result, and assistant message in order.

- [ ] **Step 3: Write RAG pipeline test**

Test documents are chunked, retrieved by keyword score, reranked, and exposed as citations.

- [ ] **Step 4: Write inference batch test**

Test bounded batch queue accepts up to capacity and rejects overflow.

- [ ] **Step 5: Write realtime sequence test**

Test conversation messages get monotonic sequence numbers and duplicate client IDs are ignored.

- [ ] **Step 6: Write notification pipeline test**

Test duplicate notifications are suppressed and higher-priority notifications are delivered first.

Run:

```bash
cd architecture_labs
go test ./...
```

Expected before implementation: tests fail because production code is missing. On this machine, current expected environment result is `go: command not found`.

## Task 3: Minimal Implementations

- [ ] **Step 1: Implement `gateway` package**

Add provider structs, health state, and fallback selection.

- [ ] **Step 2: Implement `agent` package**

Add session, events, tool call states, and append methods.

- [ ] **Step 3: Implement `rag` package**

Add chunker, keyword retriever, reranker, and answer citations.

- [ ] **Step 4: Implement `inference` package**

Add bounded batch queue and drain method.

- [ ] **Step 5: Implement `realtime` package**

Add conversation sequencing and idempotent client IDs.

- [ ] **Step 6: Implement `notification` package**

Add dedupe store, per-user limit, and priority queue.

## Task 4: README Updates

- [ ] **Step 1: Update root README**

Link `docs/architecture-to-go` and `architecture_labs`.

- [ ] **Step 2: Update `05_large_systems/README.md`**

Add the awesome-architecture mapping and phase-1 labs.

## Self-Review Notes

- Spec coverage: covers docs, six code labs, root links, and source mapping.
- Placeholder scan: no TBD or unresolved file names.
- Type consistency: package names match spec and intended directory names.
