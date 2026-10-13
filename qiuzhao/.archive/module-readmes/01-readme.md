# 01 Language Basics

目标：先把 Go 的语法、测试、错误处理、并发和标准库用顺手。

## 推荐材料

- [Go by Example](https://github.com/mmcgrana/gobyexample)：用短例子扫 Go 常见语法和标准库用法。
- [Learn Go with Tests](https://github.com/quii/learn-go-with-tests)：用测试驱动学习 Go，适合建立“先定义行为，再写实现”的习惯。
- [Go 101](https://github.com/go101/go101)：系统补 Go 语义、类型、泛型、内存和运行时细节。
- [golang/example](https://github.com/golang/example)：Go 官方示例，适合看小型完整程序。
- [learngo](https://github.com/inancgumus/learngo)：大量练习、示例和 quiz，适合刷熟练度。

## GitHub 材料手册

本阶段所有 GitHub 材料已经接入知识手册：

- 本目录详细分析：[`github-project-analysis.md`](github-project-analysis.md)
- 分段剖析入口：[`../docs/github-materials/language-basics.md`](../docs/github-materials/language-basics.md)
- 真实源码锚点：[`../docs/knowledge-handbook/source-code-anchors-foundations.md#01-language-basics`](../docs/knowledge-handbook/source-code-anchors-foundations.md#01-language-basics)
- 来源到 Capstone 知识网络：[`../docs/knowledge-handbook/source-to-capstone-crosswalk.md#phase-01-language-sources-to-runtime-safe-code`](../docs/knowledge-handbook/source-to-capstone-crosswalk.md#phase-01-language-sources-to-runtime-safe-code)
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

- [`Concurrency And Backpressure`](../docs/knowledge-handbook/concepts/concurrency-backpressure.md)：goroutine、channel、worker pool、rate limit、context。
- [`Architecture Boundaries`](../docs/knowledge-handbook/concepts/architecture-boundaries.md)：从函数和接口开始理解后续项目边界。

## 阅读顺序

1. 用 Go by Example 快速扫：变量、函数、结构体、接口、错误、goroutine、channel。
2. 用 Learn Go with Tests 写：整数、数组、切片、map、依赖注入、并发、context、HTTP。
3. 读 golang/example 中的 `hello`、`helloserver`、`outyet`。
4. 遇到语义疑问时查 Go 101，不需要从第一页啃到最后。

读的时候按 `Source -> Segment -> Concept -> Go Lab` 记录：例如 Go by Example 的 worker pool 段落，要反链到并发背压概念，再落到 [`../architecture_labs/inference`](../architecture_labs/inference)。

最终要能把这些语言基础读成 Capstone 里的代码能力：`context` 负责取消和超时，interface 负责 provider/model/tool 的可替换性，table test 负责证明 fallback、queue full、tool failure 等规则。

## 输出物

每学完一组主题，在这个目录补一份短笔记：

- 学到的 Go idiom。
- 写错过的点。
- 和其他语言不同的地方。
- 可以迁移到 `api_service` 的实践。
- 反链到哪个知识手册概念。
