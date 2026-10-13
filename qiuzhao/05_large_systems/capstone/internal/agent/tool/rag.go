package tool

import (
	"context"
	"sort"
	"strings"
)

type Document struct {
	ID       string
	Title    string
	Content  string
	TenantID string
	ACL      map[string]bool
}

type RAGTool struct {
	docs       []Document
	limit      int
	principal  Principal
	enforceACL bool
}

type Principal struct {
	TenantID string
	UserID   string
	Roles    []string
}

func NewRAGTool(docs []Document, limit int) RAGTool {
	if limit < 1 {
		limit = 1
	}
	copied := make([]Document, len(docs))
	copy(copied, docs)
	return RAGTool{docs: copied, limit: limit}
}

func NewSecureRAGTool(docs []Document, limit int, principal Principal) RAGTool {
	tool := NewRAGTool(docs, limit)
	tool.principal = principal
	tool.enforceACL = true
	return tool
}

func CanRead(principal Principal, doc Document) bool {
	if doc.TenantID != "" && principal.TenantID != doc.TenantID {
		return false
	}
	if len(doc.ACL) == 0 {
		return true
	}
	if doc.ACL[principal.UserID] {
		return true
	}
	for _, role := range principal.Roles {
		if doc.ACL["role:"+role] {
			return true
		}
	}
	return false
}

func (t RAGTool) Invoke(ctx context.Context, call Call) (Result, error) {
	select {
	case <-ctx.Done():
		return Result{}, ctx.Err()
	default:
	}

	query := strings.ToLower(call.Input)
	type hit struct {
		doc   Document
		score int
	}
	var hits []hit
	for _, doc := range t.docs {
		if t.enforceACL && !CanRead(t.principal, doc) {
			continue
		}
		score := strings.Count(strings.ToLower(doc.Title), query) +
			strings.Count(strings.ToLower(doc.Content), query)
		if score > 0 {
			hits = append(hits, hit{doc: doc, score: score})
		}
	}
	sort.SliceStable(hits, func(i, j int) bool {
		return hits[i].score > hits[j].score
	})
	if len(hits) > t.limit {
		hits = hits[:t.limit]
	}

	var builder strings.Builder
	for i, hit := range hits {
		if i > 0 {
			builder.WriteString("\n")
		}
		builder.WriteString("[")
		builder.WriteString(hit.doc.ID)
		builder.WriteString("] ")
		builder.WriteString(hit.doc.Title)
	}
	return Result{Content: builder.String()}, nil
}
