# 03 Architecture Patterns

目标：理解 Go 后端常见业务结构，而不是背模板。

## 推荐材料

- [wild-workouts-go-ddd-example](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example)：通过重构讲 DDD、Clean Architecture、CQRS，非常适合理解“为什么要分层”。
- [go-backend-clean-architecture](https://github.com/amitshekhariitbhu/go-backend-clean-architecture)：Gin、MongoDB、JWT、Docker 和测试组成的 Clean Architecture API 示例。
- [go-clean-template](https://github.com/evrone/go-clean-template)：更工程化的模板，覆盖 REST、gRPC、消息队列等。
- [go-kit/examples](https://github.com/go-kit/examples)：适合观察 endpoint、transport、service 等微服务分层。

## GitHub 材料手册

本阶段对应的手册入口：

- 本目录详细分析：[`github-project-analysis.md`](github-project-analysis.md)
- 分段剖析入口：[`../docs/github-materials/architecture-patterns.md`](../docs/github-materials/architecture-patterns.md)
- 真实源码锚点：[`../docs/knowledge-handbook/source-code-anchors-foundations.md#03-architecture-patterns`](../docs/knowledge-handbook/source-code-anchors-foundations.md#03-architecture-patterns)
- 来源到 Capstone 知识网络：[`../docs/knowledge-handbook/source-to-capstone-crosswalk.md#phase-03-architecture-pattern-sources-to-business-boundaries`](../docs/knowledge-handbook/source-to-capstone-crosswalk.md#phase-03-architecture-pattern-sources-to-business-boundaries)
- 全局来源地图：[`../docs/knowledge-handbook/source-map.md`](../docs/knowledge-handbook/source-map.md)
- 闭环学习路线：[`../docs/knowledge-handbook/closed-learning-loop.md`](../docs/knowledge-handbook/closed-learning-loop.md)
- Go 代码模式库：[`../docs/knowledge-handbook/go-code-patterns.md`](../docs/knowledge-handbook/go-code-patterns.md)
- Go 参考实现代码块：[`../docs/knowledge-handbook/reference-implementations.md`](../docs/knowledge-handbook/reference-implementations.md)
- Capstone 关键代码块索引：[`../docs/knowledge-handbook/key-code-index.md`](../docs/knowledge-handbook/key-code-index.md)
- Capstone 包级代码模板：[`../docs/knowledge-handbook/capstone-implementation-manual.md`](../docs/knowledge-handbook/capstone-implementation-manual.md)
- 大系统关键链路蓝图：[`../docs/knowledge-handbook/system-blueprints.md`](../docs/knowledge-handbook/system-blueprints.md)
- 术语/心智模型反查：[`../docs/knowledge-handbook/mental-models-glossary.md`](../docs/knowledge-handbook/mental-models-glossary.md)
- 阅读协议：[`../docs/knowledge-handbook/reading-protocol.md`](../docs/knowledge-handbook/reading-protocol.md)
- 反向索引：[`../docs/knowledge-handbook/backlink-index.md`](../docs/knowledge-handbook/backlink-index.md)

本阶段重点反链概念：

- [`Architecture Boundaries`](../docs/knowledge-handbook/concepts/architecture-boundaries.md)：handler/usecase/repository、port、command、endpoint、transport。
- [`AI Gateway`](../docs/knowledge-handbook/concepts/ai-gateway.md)：把 go-kit endpoint、中间件、路由策略迁移到 provider gateway。
- [`Agent Runtime`](../docs/knowledge-handbook/concepts/agent-runtime.md)：把 DDD command、状态机和 repository 思想迁移到 session/event/tool flow。

## 在本项目里的映射

```text
HTTP request
  -> httpapi.Handler       解析请求、写响应、处理 HTTP 状态码
  -> resource.Service      执行业务规则
  -> resource.Repository   隐藏存储细节
  -> resource.Resource     领域数据
```

这不是完整 DDD，也不是重型 Clean Architecture。它只保留最值得新手建立的边界：

- Handler 不直接管理数据。
- Service 不知道 HTTP。
- Repository 可以从内存替换成数据库。
- 测试先覆盖用户可见行为。

## 练习任务

读完推荐项目后，把每个项目的结构画成 4 行：

1. 入口。
2. 路由或 transport。
3. 业务用例。
4. 存储或外部依赖。

每个项目至少补一张 Segment Card：`Source anchor`、`What it says`、`Go design transfer`、`Backlinks`。格式见 [`../docs/knowledge-handbook/reading-protocol.md`](../docs/knowledge-handbook/reading-protocol.md)。

最终要把这些分层模式写进 Capstone：HTTP 只解码和编码，gateway core 只做业务决策，provider/tool/event/telemetry 都通过小接口替换，并用 fake 实现写出失败路径测试。
