# Go Learning API Design

## Goal

建立一个 Go 学习工作区，先按语言、结构、架构、真实项目四段学习，再落地一个小型 API 服务来练习典型业务结构。

## Scope

本轮完成：

- 当前工作区根目录作为 `go_learning`。
- 创建学习路线文档和 API 服务文档。
- 创建 `api_service` Go 模块。
- 实现学习资源 API 的内存版本。
- 用测试覆盖创建、列表、完成、进度和健康检查。

本轮不做：

- 数据库持久化。
- 用户认证。
- Web 前端。
- Docker 和部署脚本。

## API Theme

API 主题是学习资源进度管理。资源代表一篇文章、一个仓库、一个章节或一个练习。

字段：

- `id`：服务端生成，形如 `res-1`。
- `title`：必填。
- `url`：可选。
- `category`：可选，例如 `language`、`architecture`。
- `completed`：是否完成。
- `created_at`：创建时间。

## Architecture

```text
cmd/api/main.go
  -> httpapi.Handler
  -> resource.Service
  -> resource.Repository
  -> memoryRepository
```

边界：

- `cmd/api` 只组装依赖和启动服务。
- `internal/httpapi` 只处理 HTTP 语义。
- `internal/resource` 保存领域模型、业务规则和仓储接口。
- 内存仓储用 mutex 保护 map，方便之后替换成数据库。

## Error Handling

- JSON 格式错误返回 `400`。
- 标题为空返回 `400`。
- 资源不存在返回 `404`。
- 未匹配路由返回 `404`。
- 非法方法返回 `405`。

错误响应格式：

```json
{"error":"message"}
```

## Testing

测试优先覆盖 HTTP 行为，因为这是学习者最容易验证的公共边界：

- `GET /healthz`
- `POST /resources`
- `GET /resources`
- `PATCH /resources/{id}/complete`
- `GET /progress`

Service 和 Repository 保持足够小，暂时通过 handler 测试间接覆盖。
