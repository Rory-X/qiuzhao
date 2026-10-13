# Why the API Uses Handler, Service, and Repository

这个项目的目标不是展示最多技术，而是让你看清 Go 后端最常见的业务边界。

## The problem

新手 API 项目很容易把所有逻辑写进 `main.go` 或 handler：

```text
HTTP parsing + validation + business rule + storage + response
```

短期看很快，长期会出现三个问题：

- HTTP 测试必须理解所有细节。
- 换数据库会影响路由层。
- 业务规则没法脱离 HTTP 复用。

## The approach

本项目拆成三层：

```text
HTTP request
  -> internal/httpapi.Handler
  -> internal/resource.Service
  -> internal/resource.Repository
```

每层职责：

- Handler：处理路径、方法、JSON、状态码。
- Service：处理业务规则，例如标题必填、完成状态、进度计算。
- Repository：隐藏存储方式，现在是内存 map，以后可以换成 SQLite 或 Postgres。

`cmd/api/main.go` 只负责组装这些对象：

```text
memory repository -> service -> handler -> http server
```

## Trade-offs

这个设计比把代码全放进一个文件更啰嗦，但换来清晰边界和更容易测试的行为。

它也没有上完整 Clean Architecture。当前项目规模还小，不需要 usecase、adapter、entity、presenter 等更多层。等接入数据库、认证或多个业务模块后，再扩展结构会更自然。

## Alternatives considered

- 使用 Gin 或 Echo：更接近真实业务，但会把注意力转到框架 API 上。
- 直接写数据库：能练持久化，但会掩盖最基本的分层。
- 单文件 API：上手最快，但不适合学习常见业务结构。

当前选择是标准库加三层结构。它足够小，可以读完；也足够真实，可以继续演进。
