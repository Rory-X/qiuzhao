# RAG Lab Walkthrough

Local package: [`../../../architecture_labs/rag`](../../../architecture_labs/rag)

Architecture source:

- [RAG Knowledge Base template](../../architecture-to-go/templates/rag-knowledge-base.md)
- [AI Gateway + Agent Runtime Playbook](../ai-gateway-agent-runtime-playbook.md)

## What This Lab Practices

The lab practices a text-only RAG pipeline:

```text
documents
  -> chunk
  -> keyword score
  -> stable sort rerank
  -> citations
```

## Test First Reading

```go
func TestPipelineReturnsRankedCitations(t *testing.T) {
	pipeline := NewPipeline(12)
	docs := []Document{
		{ID: "doc-gateway", Text: "gateway fallback provider routing health check"},
		{ID: "doc-agent", Text: "agent tool session event graph runner"},
	}

	result := pipeline.Query(docs, "provider fallback", 1)

	if result.Citations[0].DocumentID != "doc-gateway" {
		t.Fatalf("expected gateway citation, got %q", result.Citations[0].DocumentID)
	}
}
```

Why this matters:

- RAG output must include citations.
- Retrieval behavior should be testable without a vector DB.
- This gives a local foundation before embeddings/rerankers.

## Implementation Reading

Chunking:

```go
func (p Pipeline) chunk(docs []Document) []Chunk {
	var chunks []Chunk
	for _, doc := range docs {
		words := strings.Fields(doc.Text)
		for start := 0; start < len(words); start += p.chunkWords {
			end := start + p.chunkWords
			if end > len(words) {
				end = len(words)
			}
			chunks = append(chunks, Chunk{
				DocumentID: doc.ID,
				Text:       strings.Join(words[start:end], " "),
			})
		}
	}
	return chunks
}
```

Scoring:

```go
func score(text string, terms []string) int {
	lower := strings.ToLower(text)
	total := 0
	for _, term := range terms {
		if strings.Contains(lower, term) {
			total++
		}
	}
	return total
}
```

## What Is Missing For Production

- embedding provider abstraction.
- vector database adapter.
- hybrid search.
- reranker.
- permission filtering.
- citation verification.
- eval dataset.

## Next Tests

Permission filter:

```go
func TestQueryFiltersUnauthorizedDocuments(t *testing.T) {
	result := pipeline.QueryWithPolicy(docs, "provider fallback", Policy{AllowedDocumentIDs: map[string]bool{
		"doc-agent": true,
	}})
	if len(result.Citations) != 0 {
		t.Fatal("gateway doc should be filtered out")
	}
}
```

Hybrid scoring:

```go
type Retriever interface {
	Retrieve(ctx context.Context, query string, limit int) ([]Chunk, error)
}

type Reranker interface {
	Rerank(ctx context.Context, query string, chunks []Chunk) ([]Chunk, error)
}
```

## Production Translation

```go
type Pipeline struct {
	chunker   Chunker
	retriever Retriever
	reranker  Reranker
	policy    DocumentPolicy
}

func (p Pipeline) Query(ctx context.Context, user User, query string) (Result, error) {
	chunks, err := p.retriever.Retrieve(ctx, query, 20)
	if err != nil {
		return Result{}, err
	}
	chunks = p.policy.Filter(user, chunks)
	chunks, err = p.reranker.Rerank(ctx, query, chunks)
	if err != nil {
		return Result{}, err
	}
	return BuildCitations(chunks), nil
}
```

## Knowledge Backlinks

- [Architecture template: RAG](../../architecture-to-go/templates/rag-knowledge-base.md)
- [Production readiness: Security And Cost](../production-readiness-checklist.md#security-and-cost)
