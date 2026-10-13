# RAG Knowledge Base -> Go Design Template

Source architecture: [awesome-architecture/templates/rag-knowledge-base](https://github.com/study8677/awesome-architecture/blob/609e0cd64d6af89549112379cbdd0f0e6cf63a3a/templates/rag-knowledge-base/README.md)

## Architecture Problem

RAG 让模型基于外部资料作答。真正的架构重点不是“有向量库”，而是文档入库、切块、召回、重排、引用、权限和评测。

第一阶段 Go 实验只练一个文本版 RAG pipeline：chunk -> keyword retrieve -> rerank -> citations。

## Go Package Boundary

```text
rag/
  document.go      Document, Chunk, Citation
  pipeline.go      Chunk/retrieve/rerank
  pipeline_test.go Behavior tests
```

未来完整项目可以扩展为：

```text
internal/rag/ingest
internal/rag/chunk
internal/rag/retrieve
internal/rag/rerank
internal/rag/citation
internal/rag/eval
```

## Core Types

```go
type Document struct {
    ID   string
    Text string
}

type Chunk struct {
    DocumentID string
    Text       string
    Score      int
}
```

## Minimum Lab

给两篇文档：

- 一篇包含 `gateway fallback provider`。
- 一篇包含 `agent tool session`。

查询 `provider fallback` 时，应返回第一篇文档的 chunk，并生成 citation。

## Production Expansion

- Embedding provider abstraction。
- Vector database adapter。
- Hybrid search：BM25 + vector。
- Reranker。
- 权限过滤。
- 引用真实性检查。
- RAG eval dataset。
