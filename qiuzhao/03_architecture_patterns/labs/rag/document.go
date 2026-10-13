package rag

type Document struct {
	ID   string
	Text string
}

type Chunk struct {
	DocumentID string
	Text       string
	Score      int
}

type Citation struct {
	DocumentID string
	Text       string
	Score      int
}

type Result struct {
	Citations []Citation
}
