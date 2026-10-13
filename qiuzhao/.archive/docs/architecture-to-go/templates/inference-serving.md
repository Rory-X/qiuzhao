# Inference Serving -> Go Design Template

Source architecture: [awesome-architecture/templates/inference-serving](https://github.com/study8677/awesome-architecture/blob/609e0cd64d6af89549112379cbdd0f0e6cf63a3a/templates/inference-serving/README.md)

## Architecture Problem

模型推理服务关注吞吐、延迟和 GPU 利用率。连续批处理、KV cache、队列和调度会直接影响尾延迟。

第一阶段 Go 实验不碰 GPU，只练 bounded batch queue：请求进入队列，达到容量时拒绝，drain 时形成 batch。

## Go Package Boundary

```text
inference/
  request.go       Request and Batch
  batch_queue.go   Bounded queue
  batch_queue_test.go
```

未来完整项目可以扩展为：

```text
internal/inference/scheduler
internal/inference/batcher
internal/inference/replica
internal/inference/admission
internal/inference/metrics
```

## Core Types

```go
type Request struct {
    ID     string
    Tokens int
}

type BatchQueue struct {
    capacity int
}
```

## Minimum Lab

容量为 2 的 queue：

- 前两个 request 可以入队。
- 第三个 request 返回 queue full。
- drain 返回 2 个 request，并清空队列。

## Production Expansion

- 按 token 数而不是 request 数批处理。
- 优先级队列。
- deadline-aware scheduling。
- replica health routing。
- tail latency metrics。
- overload shedding。
