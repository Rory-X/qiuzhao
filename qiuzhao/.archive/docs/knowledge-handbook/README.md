# Go Architecture Knowledge Handbook

这个目录是本工作区的“知识手册系统”。它不只是收藏 GitHub 链接，而是把每个开源材料拆成可反查的知识节点：

- **Source**：一个 GitHub 仓库、README、代码文件或架构模板。
- **Segment**：一段 README、一段代码、一个接口、一个请求链路。
- **Concept**：可以迁移的架构概念，例如 provider fallback、agent event、bounded queue。
- **Go Lab**：本地可运行的最小 Go 代码实验。

## 读法

先读闭环和代码模式，再进入具体 source：

- [`closed-learning-loop.md`](closed-learning-loop.md)：从 GitHub source 到本地 Go lab 的完整学习闭环。
- [`project-deep-dive-index.md`](project-deep-dive-index.md)：所有 GitHub 项目的深读总表。
- [`source-deep-dives.md`](source-deep-dives.md)：把 01-05 所有 GitHub 来源逐一拆成源码段落、设计压力、Go 翻译代码和本地 proof。
- [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md)：所有 GitHub 来源到最终 Capstone 包、接口、代码块和验收测试的知识网络。
- [`source-to-test-proof.md`](source-to-test-proof.md)：所有 GitHub 来源到本地 Go 测试证明和下一步测试缺口的验收矩阵。
- [`source-segments/README.md`](source-segments/README.md)：按 GitHub 项目拆出的逐段知识卡片。
- [`source-segments/github-repo-reading-cards.md`](source-segments/github-repo-reading-cards.md)：所有 GitHub 仓库的仓库级阅读卡，逐一落到 Go 代码骨架和本地证明。
- [`source-code-anchors-foundations.md`](source-code-anchors-foundations.md)：01-04 基础、结构、架构、真实项目的真实源码锚点和学习版 Go 翻译。
- [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)：Bifrost、trpc-agent-go、Tyk、Hertz、OTel、Temporal、NATS、awesome-architecture 的真实源码锚点和学习版 Go 翻译。
- [`local-labs/README.md`](local-labs/README.md)：本地 `architecture_labs` 和 Capstone 逐段代码讲解。
- [`practice-workbook.md`](practice-workbook.md)：可直接动手的测试骨架和实现练习。
- [`traceability-matrix.md`](traceability-matrix.md)：GitHub source 到本地文档/概念/code/lab 的覆盖矩阵。
- [`key-code-index.md`](key-code-index.md)：当前 Capstone 最关键 Go 代码块索引，按 gateway、agent、stream、telemetry、lifecycle 分组。
- [`go-code-patterns.md`](go-code-patterns.md)：可复制的 Go 架构代码模式库。
- [`reference-implementations.md`](reference-implementations.md)：AI Gateway、Agent Runtime、Telemetry、Lifecycle 的 Go 参考实现代码块。
- [`system-blueprints.md`](system-blueprints.md)：chat、fallback、streaming、agent、tool、RAG、observability、HA 的关键链路蓝图。
- [`../architecture-to-go/lab-code-anchors.md`](../architecture-to-go/lab-code-anchors.md)：`awesome-architecture` 六个模板到本地 `architecture_labs` 真实源码和测试的锚点。
- [`mental-models-glossary.md`](mental-models-glossary.md)：provider、route plan、fallback、event store、replay、DLQ 等术语和反查索引。
- [`implementation-roadmap.md`](implementation-roadmap.md)：从当前 labs 走向 gateway/agent/observability 的实现路线。
- [`architecture-experience-lessons.md`](architecture-experience-lessons.md)：跨项目沉淀出来的 Go 大系统经验。
- [`architecture-anti-patterns.md`](architecture-anti-patterns.md)：常见架构反模式和修正代码。
- [`production-patterns-cookbook.md`](production-patterns-cookbook.md)：面向 AI Gateway、Agent Runtime、高并发、高可用和可观测的 Go 生产模式代码手册。
- [`production-readiness-checklist.md`](production-readiness-checklist.md)：AI Gateway + Agent Runtime 生产就绪检查清单。
- [`ai-gateway-agent-runtime-playbook.md`](ai-gateway-agent-runtime-playbook.md)：最终 AI Gateway + Agent Runtime 系统手册。
- [`capstone-implementation-manual.md`](capstone-implementation-manual.md)：最终 Capstone 的包级目录、接口、关键代码块、E2E 测试和验收表。

再从 [`source-map.md`](source-map.md) 看所有 GitHub 材料，进入批量材料页：

- [`../github-materials/language-basics.md`](../github-materials/language-basics.md)
- [`../github-materials/project-structure-style.md`](../github-materials/project-structure-style.md)
- [`../github-materials/architecture-patterns.md`](../github-materials/architecture-patterns.md)
- [`../github-materials/real-projects.md`](../github-materials/real-projects.md)
- [`../github-materials/advanced-systems.md`](../github-materials/advanced-systems.md)

再按概念反向回读：

- [`concepts/architecture-boundaries.md`](concepts/architecture-boundaries.md)
- [`concepts/ai-gateway.md`](concepts/ai-gateway.md)
- [`concepts/agent-runtime.md`](concepts/agent-runtime.md)
- [`concepts/concurrency-backpressure.md`](concepts/concurrency-backpressure.md)
- [`concepts/observability.md`](concepts/observability.md)
- [`concepts/durable-workflow.md`](concepts/durable-workflow.md)

## 反链规则

每个 Source Segment 必须包含：

```text
Source -> Segment -> Concept -> Go Lab
```

每个 Concept 必须包含反向索引：

```text
Concept <- Sources
Concept -> Local Go labs
Concept -> Next production expansion
```

这让学习形成网络：你可以从 `Bifrost` 读到 `AI Gateway`，再跳到 `architecture_labs/gateway`，再回到 `go-kit endpoint` 或 `Tyk policy pipeline`。

## 本地闭环

这套手册最终要落到本地代码：

```text
GitHub project
  -> github-project-analysis.md
  -> knowledge-handbook concept
  -> go-code-patterns.md
  -> capstone-implementation-manual.md
  -> architecture_labs or capstone_ai_gateway_agent_runtime
  -> go test ./...
```

当前最重要的手册页：

| Need | Local document |
|---|---|
| 学习顺序和验收 | [`closed-learning-loop.md`](closed-learning-loop.md) |
| 所有项目读法总表 | [`project-deep-dive-index.md`](project-deep-dive-index.md) |
| 全部 GitHub 来源源码段落深读 | [`source-deep-dives.md`](source-deep-dives.md) |
| 来源到 Capstone 的知识网络 | [`source-to-capstone-crosswalk.md`](source-to-capstone-crosswalk.md) |
| 来源到测试证明 | [`source-to-test-proof.md`](source-to-test-proof.md) |
| 逐段源码/文档卡片 | [`source-segments/README.md`](source-segments/README.md) |
| 01-04 真实源码锚点 | [`source-code-anchors-foundations.md`](source-code-anchors-foundations.md) |
| 高级仓库真实源码锚点 | [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md) |
| 本地 Go lab 讲解 | [`local-labs/README.md`](local-labs/README.md) |
| Capstone 真实代码 walkthrough | [`local-labs/capstone-lab.md`](local-labs/capstone-lab.md) |
| 动手练习题 | [`practice-workbook.md`](practice-workbook.md) |
| 覆盖证明矩阵 | [`traceability-matrix.md`](traceability-matrix.md) |
| Capstone 关键代码块索引 | [`key-code-index.md`](key-code-index.md) |
| 大量 Go 代码模板 | [`go-code-patterns.md`](go-code-patterns.md) |
| 可改造成项目的参考实现 | [`reference-implementations.md`](reference-implementations.md) |
| 大系统关键链路蓝图 | [`system-blueprints.md`](system-blueprints.md) |
| 术语/心智模型反查 | [`mental-models-glossary.md`](mental-models-glossary.md) |
| 下一阶段实现路线 | [`implementation-roadmap.md`](implementation-roadmap.md) |
| 跨项目工程经验 | [`architecture-experience-lessons.md`](architecture-experience-lessons.md) |
| 反模式修正 | [`architecture-anti-patterns.md`](architecture-anti-patterns.md) |
| 生产模式 Go cookbook | [`production-patterns-cookbook.md`](production-patterns-cookbook.md) |
| 生产就绪检查 | [`production-readiness-checklist.md`](production-readiness-checklist.md) |
| 最终系统设计 | [`ai-gateway-agent-runtime-playbook.md`](ai-gateway-agent-runtime-playbook.md) |
| 最终包级代码模板和 E2E 验收 | [`capstone-implementation-manual.md`](capstone-implementation-manual.md) |

## 状态标记

为了不把“计划阅读”和“已读剖析”混在一起，所有材料使用四种状态：

| Status | Meaning |
|---|---|
| `Anchored` | 已记录仓库、提交、入口和待读文件。 |
| `Segmented` | 已按 README/代码/链路拆成段落卡片。 |
| `Mapped` | 已映射到概念节点和本地 Go lab。 |
| `Implemented` | 已有对应 Go 代码实验或模板。 |

当前手册把 GitHub 材料分成三层：`Anchored` 记录来源和提交，`Mapped` 映射到概念和本地 lab，`Implemented` 给出可运行实验或学习版 Go 参考实现。源码级细读集中在 [`source-deep-dives.md`](source-deep-dives.md)、[`source-code-anchors-foundations.md`](source-code-anchors-foundations.md) 和 [`source-code-anchors-advanced.md`](source-code-anchors-advanced.md)，后续继续按 [`reading-protocol.md`](reading-protocol.md) 逐段补充。
