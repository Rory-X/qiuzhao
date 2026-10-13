# API Reference

`api_service` 暴露一个 JSON HTTP API，用于管理学习资源。

## Base URL

本地开发默认：

```text
http://localhost:8080
```

## Resource

```json
{
  "id": "res-1",
  "title": "Learn Go with Tests",
  "url": "https://github.com/quii/learn-go-with-tests",
  "category": "language",
  "completed": false,
  "created_at": "2026-07-05T10:00:00Z"
}
```

字段：

- `id`：字符串，服务端生成。
- `title`：字符串，必填。
- `url`：字符串，可选。
- `category`：字符串，可选。
- `completed`：布尔值。
- `created_at`：RFC3339 时间，由服务端生成。

## Endpoints

### GET /healthz

返回服务状态。

响应：

```json
{"status":"ok"}
```

### POST /resources

创建学习资源。

请求：

```json
{
  "title": "Go by Example",
  "url": "https://github.com/mmcgrana/gobyexample",
  "category": "language"
}
```

状态码：

- `201`：创建成功。
- `400`：JSON 非法或 `title` 为空。

### GET /resources

按创建顺序返回资源列表。

响应：

```json
{
  "items": [
    {
      "id": "res-1",
      "title": "Go by Example",
      "url": "https://github.com/mmcgrana/gobyexample",
      "category": "language",
      "completed": false,
      "created_at": "2026-07-05T10:00:00Z"
    }
  ]
}
```

### PATCH /resources/{id}/complete

标记资源完成。

状态码：

- `200`：成功，返回更新后的资源。
- `404`：资源不存在。

### GET /progress

返回学习进度。

响应：

```json
{"total":1,"completed":1,"percent":100}
```

`percent` 使用整数百分比。没有资源时返回 `0`。

## Error Response

```json
{"error":"message"}
```

常见错误：

- `invalid json body`
- `title is required`
- `resource not found`
- `method not allowed`
- `not found`

## Related

- 教程：[`tutorial-first-api.md`](tutorial-first-api.md)
- 操作指南：[`how-to-run-api.md`](how-to-run-api.md)
- 架构解释：[`explanation-architecture.md`](explanation-architecture.md)
