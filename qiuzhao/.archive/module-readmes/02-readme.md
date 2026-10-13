# 02 Project Structure

目标：理解 Go 项目为什么常见 `cmd`、`internal`、`pkg`、`api`、`docs` 这些目录，以及什么时候不需要它们。

## 推荐材料

- [golang-standards/project-layout](https://github.com/golang-standards/project-layout)：常见目录名地图。注意它不是官方标准，小项目不要照单全收。
- [Uber Go Style Guide](https://github.com/uber-go/guide)：团队级 Go 风格指南。
- [Google Go Style Guide](https://github.com/google/styleguide/blob/gh-pages/go/guide.md)：强调清晰、简单、可维护和一致性。
- [modern-go-application](https://github.com/sagikazarmark/modern-go-application)：现代 Go 应用模板，覆盖配置、构建、测试、Docker 和遥测。

## GitHub 材料手册

本阶段对应的手册入口：

- 本目录详细分析：[`github-project-analysis.md`](github-project-analysis.md)
- 分段剖析入口：[`../docs/github-materials/project-structure-style.md`](../docs/github-materials/project-structure-style.md)
- 真实源码锚点：[`../docs/knowledge-handbook/source-code-anchors-foundations.md#02-project-structure-and-style`](../docs/knowledge-handbook/source-code-anchors-foundations.md#02-project-structure-and-style)
- 来源到 Capstone 知识网络：[`../docs/knowledge-handbook/source-to-capstone-crosswalk.md#phase-02-structure-and-style-sources-to-package-discipline`](../docs/knowledge-handbook/source-to-capstone-crosswalk.md#phase-02-structure-and-style-sources-to-package-discipline)
- 全局来源地图：[`../docs/knowledge-handbook/source-map.md`](../docs/knowledge-handbook/source-map.md)
- 闭环学习路线：[`../docs/knowledge-handbook/closed-learning-loop.md`](../docs/knowledge-handbook/closed-learning-loop.md)
- Go 代码模式库：[`../docs/knowledge-handbook/go-code-patterns.md`](../docs/knowledge-handbook/go-code-patterns.md)
- Go 参考实现代码块：[`../docs/knowledge-handbook/reference-implementations.md`](../docs/knowledge-handbook/reference-implementations.md)
- Capstone 关键代码块索引：[`../docs/knowledge-handbook/key-code-index.md`](../docs/knowledge-handbook/key-code-index.md)
- Capstone 包级代码模板：[`../docs/knowledge-handbook/capstone-implementation-manual.md`](../docs/knowledge-handbook/capstone-implementation-manual.md)
- 大系统关键链路蓝图：[`../docs/knowledge-handbook/system-blueprints.md`](../docs/knowledge-handbook/system-blueprints.md)
- 术语/心智模型反查：[`../docs/knowledge-handbook/mental-models-glossary.md`](../docs/knowledge-handbook/mental-models-glossary.md)
- 概念索引：[`../docs/knowledge-handbook/concepts/README.md`](../docs/knowledge-handbook/concepts/README.md)
- 反向索引：[`../docs/knowledge-handbook/backlink-index.md`](../docs/knowledge-handbook/backlink-index.md)

本阶段重点反链概念：

- [`Architecture Boundaries`](../docs/knowledge-handbook/concepts/architecture-boundaries.md)：`cmd`、`internal`、接口归属、包边界。
- [`Observability`](../docs/knowledge-handbook/concepts/observability.md)：现代 Go 应用里的 health、metrics、tracing、logging 启动面。
- [`Concurrency And Backpressure`](../docs/knowledge-handbook/concepts/concurrency-backpressure.md)：channel buffer、goroutine 生命周期和关闭策略。

## 本工作区采用的结构

```text
api_service/
  cmd/api/              程序入口，只负责组装依赖和启动 HTTP server
  internal/resource/    学习资源领域模型、服务和仓储
  internal/httpapi/     HTTP 路由、请求解析、响应编码
  docs/                 API 服务内部文档
```

核心判断：

- `cmd` 放入口，避免业务逻辑塞进 `main.go`。
- `internal` 表示只给本模块使用，外部项目不能直接 import。
- 先不创建 `pkg`，因为当前没有对外复用的库。
- 先不用框架，避免一开始把精力花在框架约定上。

## 观察清单

读任何 Go 项目时先回答：

1. 程序入口在哪里？
2. 路由层和业务层是否分开？
3. 数据访问是否被接口隔离？
4. `context.Context` 从哪里进入，传到哪里停止？
5. 测试更偏端到端、单元测试，还是混合？

每观察一个项目，都把目录选择写回手册：它属于 `Architecture Boundaries`、`Observability` 还是 `Concurrency And Backpressure`。

最终落点是 Capstone 的 `cmd/gateway`、`internal/gateway/*`、`internal/agent/*` 和 `internal/platform/*`。读 project-layout、Uber、Google、modern-go-application 时，都要反问：这个目录或风格约束会落到 Capstone 的哪个包、哪个接口、哪个测试。
