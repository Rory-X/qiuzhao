# Build and Try the First Go API

这个教程带你从零跑起 `api_service`，创建一个学习资源，再标记完成。完成后你会看到 Go 后端的一条完整请求链路。

## What you'll need

- Go 1.22 或更新版本。
- 一个可以执行 `curl` 的终端。

## Step 1: Run the tests

```bash
cd api_service
go test ./...
```

你应该看到所有测试通过。测试覆盖健康检查、创建、列表、完成和进度。

## Step 2: Start the server

```bash
go run ./cmd/api
```

默认监听 `:8080`。看到 `go learning api listening on :8080` 后，另开一个终端继续下一步。

## Step 3: Check health

```bash
curl -s http://localhost:8080/healthz
```

预期输出：

```json
{"status":"ok"}
```

## Step 4: Create a learning resource

```bash
curl -s -X POST http://localhost:8080/resources \
  -H 'Content-Type: application/json' \
  -d '{"title":"Learn Go with Tests","url":"https://github.com/quii/learn-go-with-tests","category":"language"}'
```

预期会得到 `res-1`，并且 `completed` 是 `false`。

## Step 5: Mark it complete

```bash
curl -s -X PATCH http://localhost:8080/resources/res-1/complete
```

预期响应里的 `completed` 是 `true`。

## Step 6: View progress

```bash
curl -s http://localhost:8080/progress
```

预期输出：

```json
{"total":1,"completed":1,"percent":100}
```

## What you built

你现在有了一个小型 Go API：HTTP handler 接收请求，service 执行业务规则，repository 管理数据。继续看 [`reference-api.md`](reference-api.md) 和 [`explanation-architecture.md`](explanation-architecture.md) 可以理解每个边界为什么存在。
