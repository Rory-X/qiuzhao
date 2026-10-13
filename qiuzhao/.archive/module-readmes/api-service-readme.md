# Go Learning API Service

这个服务用于练习 Go 后端的常见业务结构。它使用标准库 `net/http`，不引入框架和数据库。

## 功能

- `GET /healthz`：健康检查。
- `POST /resources`：创建学习资源。
- `GET /resources`：列出学习资源。
- `PATCH /resources/{id}/complete`：标记资源完成。
- `GET /progress`：查看完成进度。

## 运行

```bash
cd api_service
go run ./cmd/api
```

设置端口：

```bash
ADDR=:9090 go run ./cmd/api
```

## 测试

```bash
cd api_service
go test ./...
```

## 示例请求

```bash
curl -s http://localhost:8080/healthz

curl -s -X POST http://localhost:8080/resources \
  -H 'Content-Type: application/json' \
  -d '{"title":"Learn Go with Tests","url":"https://github.com/quii/learn-go-with-tests","category":"language"}'

curl -s http://localhost:8080/resources
curl -s -X PATCH http://localhost:8080/resources/res-1/complete
curl -s http://localhost:8080/progress
```

更多说明见：

- [`../docs/tutorial-first-api.md`](../docs/tutorial-first-api.md)
- [`../docs/how-to-run-api.md`](../docs/how-to-run-api.md)
- [`../docs/reference-api.md`](../docs/reference-api.md)
- [`../docs/explanation-architecture.md`](../docs/explanation-architecture.md)
