package tool

import (
	"context"
	"strings"
	"testing"
)

func TestRAGToolReturnsCitedHits(t *testing.T) {
	rag := NewRAGTool([]Document{
		{ID: "doc-1", Title: "Gateway fallback", Content: "Provider timeout should fallback"},
		{ID: "doc-2", Title: "Agent events", Content: "Tool calls become events"},
	}, 2)

	result, err := rag.Invoke(context.Background(), Call{Name: "rag", Input: "fallback"})
	if err != nil {
		t.Fatalf("rag: %v", err)
	}
	if !strings.Contains(result.Content, "[doc-1] Gateway fallback") {
		t.Fatalf("content: %q", result.Content)
	}
}

func TestRAGFiltersCrossTenantAndUnreadableChunks(t *testing.T) {
	rag := NewSecureRAGTool([]Document{
		{
			ID:       "doc-1",
			TenantID: "tenant-a",
			Title:    "Gateway fallback",
			Content:  "provider fallback policy",
			ACL:      map[string]bool{"user-1": true},
		},
		{
			ID:       "doc-2",
			TenantID: "tenant-b",
			Title:    "Gateway fallback",
			Content:  "provider fallback policy",
			ACL:      map[string]bool{"user-1": true},
		},
		{
			ID:       "doc-3",
			TenantID: "tenant-a",
			Title:    "Gateway fallback",
			Content:  "provider fallback policy",
			ACL:      map[string]bool{"user-2": true},
		},
	}, 3, Principal{TenantID: "tenant-a", UserID: "user-1"})

	result, err := rag.Invoke(context.Background(), Call{Name: "rag", Input: "fallback"})
	if err != nil {
		t.Fatalf("rag: %v", err)
	}
	if !strings.Contains(result.Content, "[doc-1] Gateway fallback") {
		t.Fatalf("missing readable doc: %q", result.Content)
	}
	if strings.Contains(result.Content, "doc-2") || strings.Contains(result.Content, "doc-3") {
		t.Fatalf("leaked unreadable doc: %q", result.Content)
	}
}
