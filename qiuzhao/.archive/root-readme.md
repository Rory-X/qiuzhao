# Go Learning Workspace

这个工作区用于快速建立两件事的直觉：

- Go 语言本身怎么组织代码、测试、并发和错误处理。
- Go 后端项目怎么分层，最后落地一个可运行的 API 服务。

建议按顺序阅读和实践：

1. [`01_language_basics`](01_language_basics/README.md)：语言基础、测试、并发、官方示例。
2. [`02_project_structure`](02_project_structure/README.md)：目录结构、包边界、代码风格。
3. [`03_architecture_patterns`](03_architecture_patterns/README.md)：Clean Architecture、DDD、CQRS、微服务边界。
4. [`04_real_projects`](04_real_projects/README.md)：从真实项目里观察长期演进的结构。
5. [`05_large_systems`](05_large_systems/README.md)：AI 网关、agent runtime、高并发、高可用和可观测系统。
6. [`api_service`](api_service/README.md)：先落地一个小型学习任务 API。
7. [`architecture_labs`](architecture_labs/README.md)：把架构模板转成 Go 代码实验。
8. [`capstone_ai_gateway_agent_runtime`](capstone_ai_gateway_agent_runtime/README.md)：把 gateway、agent、telemetry、lifecycle 组合成最终可测试骨架。

## 最终项目

第一阶段的 `api_service` 是一个标准库优先的 Go API 服务，主题是“学习资源进度管理”：

- 创建学习资源。
- 列出学习资源。
- 标记资源完成。
- 查看整体学习进度。

它刻意不引入 Web 框架和数据库，先把 Go 后端最核心的边界讲清楚：handler、service、repository、model、DTO、错误处理和测试。

最终方向会升级为 `AI Gateway + Agent Runtime Lab`：统一模型入口、provider fallback、agent session/event/tool flow、RAG、批处理、实时消息、通知队列和可观测。

## 文档索引

- 教程：[`docs/tutorial-first-api.md`](docs/tutorial-first-api.md)
- 操作指南：[`docs/how-to-run-api.md`](docs/how-to-run-api.md)
- API 参考：[`docs/reference-api.md`](docs/reference-api.md)
- 架构解释：[`docs/explanation-architecture.md`](docs/explanation-architecture.md)
- 知识手册系统：[`docs/knowledge-handbook/README.md`](docs/knowledge-handbook/README.md)
  - 闭环学习路线：[`docs/knowledge-handbook/closed-learning-loop.md`](docs/knowledge-handbook/closed-learning-loop.md)
  - GitHub 项目深读总表：[`docs/knowledge-handbook/project-deep-dive-index.md`](docs/knowledge-handbook/project-deep-dive-index.md)
  - GitHub 来源到 Capstone 知识网络：[`docs/knowledge-handbook/source-to-capstone-crosswalk.md`](docs/knowledge-handbook/source-to-capstone-crosswalk.md)
  - 逐段知识卡片：[`docs/knowledge-handbook/source-segments/README.md`](docs/knowledge-handbook/source-segments/README.md)
  - 01-04 源码锚点：[`docs/knowledge-handbook/source-code-anchors-foundations.md`](docs/knowledge-handbook/source-code-anchors-foundations.md)
  - 高级仓库源码锚点：[`docs/knowledge-handbook/source-code-anchors-advanced.md`](docs/knowledge-handbook/source-code-anchors-advanced.md)
  - 本地 Go lab 逐段讲解：[`docs/knowledge-handbook/local-labs/README.md`](docs/knowledge-handbook/local-labs/README.md)
  - 实战练习 Workbook：[`docs/knowledge-handbook/practice-workbook.md`](docs/knowledge-handbook/practice-workbook.md)
  - 覆盖矩阵：[`docs/knowledge-handbook/traceability-matrix.md`](docs/knowledge-handbook/traceability-matrix.md)
  - Go 架构代码模式库：[`docs/knowledge-handbook/go-code-patterns.md`](docs/knowledge-handbook/go-code-patterns.md)
  - Go 参考实现代码块：[`docs/knowledge-handbook/reference-implementations.md`](docs/knowledge-handbook/reference-implementations.md)
  - 大系统关键链路蓝图：[`docs/knowledge-handbook/system-blueprints.md`](docs/knowledge-handbook/system-blueprints.md)
  - 术语和心智模型反查：[`docs/knowledge-handbook/mental-models-glossary.md`](docs/knowledge-handbook/mental-models-glossary.md)
  - 下一阶段实现路线：[`docs/knowledge-handbook/implementation-roadmap.md`](docs/knowledge-handbook/implementation-roadmap.md)
  - 跨项目架构经验：[`docs/knowledge-handbook/architecture-experience-lessons.md`](docs/knowledge-handbook/architecture-experience-lessons.md)
  - 架构反模式：[`docs/knowledge-handbook/architecture-anti-patterns.md`](docs/knowledge-handbook/architecture-anti-patterns.md)
  - 生产就绪清单：[`docs/knowledge-handbook/production-readiness-checklist.md`](docs/knowledge-handbook/production-readiness-checklist.md)
  - AI Gateway + Agent Runtime 手册：[`docs/knowledge-handbook/ai-gateway-agent-runtime-playbook.md`](docs/knowledge-handbook/ai-gateway-agent-runtime-playbook.md)
  - Capstone 包级实施手册：[`docs/knowledge-handbook/capstone-implementation-manual.md`](docs/knowledge-handbook/capstone-implementation-manual.md)
- 架构模板转 Go：[`docs/architecture-to-go/README.md`](docs/architecture-to-go/README.md)
- 最终系统蓝图：[`docs/target-ai-gateway-agent-platform.md`](docs/target-ai-gateway-agent-platform.md)
- Go 架构实验：[`architecture_labs/README.md`](architecture_labs/README.md)
- Capstone 可运行骨架：[`capstone_ai_gateway_agent_runtime/README.md`](capstone_ai_gateway_agent_runtime/README.md)
- 设计稿：[`docs/superpowers/specs/2026-07-05-go-learning-api-design.md`](docs/superpowers/specs/2026-07-05-go-learning-api-design.md)
- 实现计划：[`docs/superpowers/plans/2026-07-05-go-learning-api.md`](docs/superpowers/plans/2026-07-05-go-learning-api.md)

## 常用命令

当前机器已经安装 Go。可以运行：

```bash
cd api_service
go test ./...
go run ./cmd/api
```

服务默认监听 `:8080`。

架构实验：

```bash
cd architecture_labs
go test ./...
```

Capstone 综合实验：

```bash
cd capstone_ai_gateway_agent_runtime
go test ./...
```
