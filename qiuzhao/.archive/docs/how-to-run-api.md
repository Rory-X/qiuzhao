# How to Run and Test the API

这份指南用于启动、测试和手动调用 `api_service`。

## Prerequisites

- Go 1.22 或更新版本。
- 当前目录位于 `/Users/jiahaoqian/proj/go_learning`。

## Steps

1. 进入 API 模块。

   ```bash
   cd api_service
   ```

2. 运行测试。

   ```bash
   go test ./...
   ```

   预期结果是所有 package 测试通过。

3. 启动服务。

   ```bash
   go run ./cmd/api
   ```

   默认监听 `:8080`。

4. 创建资源。

   ```bash
   curl -s -X POST http://localhost:8080/resources \
     -H 'Content-Type: application/json' \
     -d '{"title":"Go by Example","url":"https://github.com/mmcgrana/gobyexample","category":"language"}'
   ```

5. 查看列表。

   ```bash
   curl -s http://localhost:8080/resources
   ```

6. 标记完成。

   ```bash
   curl -s -X PATCH http://localhost:8080/resources/res-1/complete
   ```

7. 查看进度。

   ```bash
   curl -s http://localhost:8080/progress
   ```

## Verification

创建一个资源并完成后，`GET /progress` 应返回：

```json
{"total":1,"completed":1,"percent":100}
```

## Troubleshooting

- `go: command not found`：先安装 Go，并确认 `go version` 能正常输出。
- `listen tcp :8080: bind: address already in use`：换端口运行，例如 `ADDR=:9090 go run ./cmd/api`。
- `{"error":"title is required"}`：创建资源时 `title` 不能为空或全空格。
- `{"error":"resource not found"}`：确认完成接口里的 ID 存在，例如 `/resources/res-1/complete`。
