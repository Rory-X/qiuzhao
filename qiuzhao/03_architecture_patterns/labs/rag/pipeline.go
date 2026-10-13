package rag

import (
	"sort"
	"strings"
)

type Pipeline struct {
	chunkWords int
}

func NewPipeline(chunkWords int) Pipeline {
	if chunkWords <= 0 {
		chunkWords = 64
	}
	return Pipeline{chunkWords: chunkWords}
}

func (p Pipeline) Query(docs []Document, query string, limit int) Result {
	if limit <= 0 {
		limit = 3
	}

	terms := strings.Fields(strings.ToLower(query))
	chunks := p.chunk(docs)
	for i := range chunks {
		chunks[i].Score = score(chunks[i].Text, terms)
	}

	sort.SliceStable(chunks, func(i, j int) bool {
		return chunks[i].Score > chunks[j].Score
	})

	citations := make([]Citation, 0, limit)
	for _, chunk := range chunks {
		if chunk.Score == 0 {
			continue
		}
		citations = append(citations, Citation{
			DocumentID: chunk.DocumentID,
			Text:       chunk.Text,
			Score:      chunk.Score,
		})
		if len(citations) == limit {
			break
		}
	}

	return Result{Citations: citations}
}

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
