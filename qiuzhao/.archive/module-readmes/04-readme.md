# 04 Real Projects

目标：从真实项目里观察 Go 代码如何支撑长期演进。

## 推荐项目

- [PocketBase](https://github.com/pocketbase/pocketbase)：单 binary、SQLite、实时订阅、用户和文件管理，适合观察产品型后端。
- [Memos](https://github.com/usememos/memos)：自托管笔记应用，适合看 Go 后端和前端产品如何组合。
- [Caddy](https://github.com/caddyserver/caddy)：高质量 Web server，适合研究模块化和插件系统。
- [Syncthing](https://github.com/syncthing/syncthing)：大型文件同步项目，适合进阶观察并发、网络和协议。

## GitHub 材料手册

本阶段对应的手册入口：

- 本目录详细分析：[`github-project-analysis.md`](github-project-analysis.md)
- 分段剖析入口：[`../docs/github-materials/real-projects.md`](../docs/github-materials/real-projects.md)
- 真实源码锚点：[`../docs/knowledge-handbook/source-code-anchors-foundations.md#04-real-projects`](../docs/knowledge-handbook/source-code-anchors-foundations.md#04-real-projects)
- 来源到 Capstone 知识网络：[`../docs/knowledge-handbook/source-to-capstone-crosswalk.md#phase-04-real-project-sources-to-long-running-product-shape`](../docs/knowledge-handbook/source-to-capstone-crosswalk.md#phase-04-real-project-sources-to-long-running-product-shape)
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

- [`Architecture Boundaries`](../docs/knowledge-handbook/concepts/architecture-boundaries.md)：产品型 Go 服务如何组织入口、模块和生命周期。
- [`AI Gateway`](../docs/knowledge-handbook/concepts/ai-gateway.md)：Caddy 的模块系统、PocketBase 的 hook/admin API 如何启发 provider/plugin。
- [`Agent Runtime`](../docs/knowledge-handbook/concepts/agent-runtime.md)：Memos 的 SSE broadcast 和副作用链路如何启发 agent event stream。
- [`Durable Workflow`](../docs/knowledge-handbook/concepts/durable-workflow.md)：Syncthing 的安全目标、协议边界和长期状态如何启发可靠执行。

## 阅读方法

不要从最大文件开始读。每个项目先找：

1. README 里的启动方式。
2. `go.mod` 里的核心依赖。
3. `cmd` 或主入口。
4. 最小的一条请求链路。
5. 测试如何组织。

## 记录模板

```markdown
# 项目名

## 它解决什么问题

## 程序入口

## 核心目录

## 一条请求或任务链路

## 我想迁移到 api_service 的做法
```

真实项目读完后，不只写项目摘要，还要写反链：这个设计对应哪个概念节点、能落到哪个本地 Go lab、未来会进入 `gateway_lab` 还是 `agent_runtime_lab`。

最终要把真实项目里的长期演进经验转进 Capstone：Caddy 的 lifecycle 进入 `internal/platform/lifecycle`，Memos 的 SSE/side effect 思路进入 agent stream，PocketBase 的 hook 思路进入 provider/tool 扩展点，Syncthing 的协议边界进入事件和状态恢复。
