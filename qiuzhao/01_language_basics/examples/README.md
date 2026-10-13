# 1.6 可运行示例索引

> 用已有 Go 模块运行语言、HTTP、并发和测试示例，同时保持本次整改不新增或修改代码文件。

## 前置知识

安装 Go 1.22 或更新版本，并读完 01 章。本文是导航文档，不增加新的 `.go`/`go.mod`；这是为了遵守整改目标“代码文件零改动，只动文档和目录结构”。

## 正文

### 从 TypeScript 测试习惯开始

把 Jest/Vitest 的“运行单个 spec”映射为 `go test -run`。三个现有 module 都能独立运行：

```bash
cd ../../02_project_structure/api_service
go test ./...

cd ../../03_architecture_patterns/labs
go test ./...

cd ../../05_large_systems/capstone
go test ./...
```

### 类型、错误与接口

从 [`core/types.go`](../../05_large_systems/capstone/internal/gateway/core/types.go) 看 defined type/value method；从 [`core/errors_test.go`](../../05_large_systems/capstone/internal/gateway/core/errors_test.go) 运行错误链测试：

```bash
cd ../../05_large_systems/capstone
go test ./internal/gateway/core -run 'TestErrorClassOf|TestCanFallback' -v
```

### 并发与运行时

前端 async queue 对应有界 channel/并发限制。以下测试覆盖 queue full、context 取消和 race-safe state：

```bash
cd ../../05_large_systems/capstone
go test -race ./internal/gateway/provider -run 'TestQueue|TestBounded' -v
go test -race ./internal/agent/stream -v
```

### HTTP 与表格测试

`httptest` 对应 Supertest 的常见用途。运行现有 API handler 测试：

```bash
cd ../../02_project_structure/api_service
go test ./internal/httpapi -v
```

### 前端人容易踩的坑

- 在仓库根运行 `go test ./...`；本仓库是三个独立 module，应分别进入 module 根。
- 只运行成功路径，忽略 `-race`、取消、满队列和错误包装测试。
- 为了“凑示例目录”复制一份代码，造成文档示例与真实实现分叉。

## 对比前端

这里的三个 module 类似 monorepo 中三个独立 package workspace，但当前没有顶层 `go.work`。`go test -run` 类似 Vitest/Jest 的 test name filter，`-race` 则提供 JS 单线程测试通常不涉及的数据竞争检查。

## 关键代码

- [`api_service/internal/httpapi/handler_test.go`](../../02_project_structure/api_service/internal/httpapi/handler_test.go)：HTTP 边界。
- [`labs/gateway/router_test.go`](../../03_architecture_patterns/labs/gateway/router_test.go)：表格化路由行为。
- [`capstone/internal/gateway/provider/timed_breaker_test.go`](../../05_large_systems/capstone/internal/gateway/provider/timed_breaker_test.go)：注入时钟。
- [`capstone/internal/agent/runner/runner_test.go`](../../05_large_systems/capstone/internal/agent/runner/runner_test.go)：事件与工具流。

## 检验标准

1. 为什么要在三个 module 根分别运行 `go test ./...`？
2. `-race` 能发现哪类普通断言看不到的问题？
3. `go test -run` 如何帮助阅读一个陌生行为？
4. 为什么本次没有在 examples 下复制或新建 Go 代码？
