package rag

import "testing"

func TestPipelineReturnsRankedCitations(t *testing.T) {
	pipeline := NewPipeline(12)
	docs := []Document{
		{ID: "doc-gateway", Text: "gateway fallback provider routing health check"},
		{ID: "doc-agent", Text: "agent tool session event graph runner"},
	}

	result := pipeline.Query(docs, "provider fallback", 1)

	if len(result.Citations) != 1 {
		t.Fatalf("expected 1 citation, got %d", len(result.Citations))
	}
	if result.Citations[0].DocumentID != "doc-gateway" {
		t.Fatalf("expected gateway citation, got %q", result.Citations[0].DocumentID)
	}
	if result.Citations[0].Score == 0 {
		t.Fatal("expected positive score")
	}
}
