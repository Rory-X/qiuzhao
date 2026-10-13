# GitHub Materials Reading Index

这些文档把前面列出的 GitHub 材料“读出来”：不复制整份源码，而是按仓库拆成学习目标、关键文件、关键片段、迁移到最终系统的方式。

## Reading Batches

1. [`language-basics.md`](language-basics.md)：Go 语言、测试、并发、官方小项目。
2. [`project-structure-style.md`](project-structure-style.md)：目录结构、包边界、代码风格。
3. [`architecture-patterns.md`](architecture-patterns.md)：Clean Architecture、DDD、CQRS、微服务边界。
4. [`real-projects.md`](real-projects.md)：真实产品和长期运行系统。
5. [`advanced-systems.md`](advanced-systems.md)：AI gateway、agent runtime、高并发、高可用、可观测。

## Knowledge Network

这些批量阅读笔记会继续沉淀到 [`../knowledge-handbook`](../knowledge-handbook/README.md)：

- [`source-map.md`](../knowledge-handbook/source-map.md)：所有 GitHub 材料总图。
- [`closed-learning-loop.md`](../knowledge-handbook/closed-learning-loop.md)：GitHub source 到本地 Go lab 的学习闭环。
- [`project-deep-dive-index.md`](../knowledge-handbook/project-deep-dive-index.md)：所有项目的深读总表。
- [`source-to-capstone-crosswalk.md`](../knowledge-handbook/source-to-capstone-crosswalk.md)：所有 GitHub 来源到 Capstone 包、接口、代码块和验收测试的知识网络。
- [`source-segments/README.md`](../knowledge-handbook/source-segments/README.md)：每个项目的逐段知识卡片。
- [`source-code-anchors-foundations.md`](../knowledge-handbook/source-code-anchors-foundations.md)：01-04 仓库真实源码锚点和学习版 Go 翻译。
- [`source-code-anchors-advanced.md`](../knowledge-handbook/source-code-anchors-advanced.md)：高级仓库真实源码锚点和学习版 Go 翻译。
- [`local-labs/README.md`](../knowledge-handbook/local-labs/README.md)：本地 Go lab 逐段讲解。
- [`practice-workbook.md`](../knowledge-handbook/practice-workbook.md)：从资料到测试/实现的练习题。
- [`traceability-matrix.md`](../knowledge-handbook/traceability-matrix.md)：每个 GitHub source 的本地落点。
- [`go-code-patterns.md`](../knowledge-handbook/go-code-patterns.md)：可复制的 Go 架构代码模式库。
- [`reference-implementations.md`](../knowledge-handbook/reference-implementations.md)：可直接改造的 Go 参考实现代码块。
- [`system-blueprints.md`](../knowledge-handbook/system-blueprints.md)：大系统关键链路蓝图。
- [`mental-models-glossary.md`](../knowledge-handbook/mental-models-glossary.md)：术语、心智模型和概念反查。
- [`implementation-roadmap.md`](../knowledge-handbook/implementation-roadmap.md)：下一阶段实现路线。
- [`architecture-experience-lessons.md`](../knowledge-handbook/architecture-experience-lessons.md)：跨项目沉淀经验。
- [`architecture-anti-patterns.md`](../knowledge-handbook/architecture-anti-patterns.md)：反模式和修正。
- [`production-readiness-checklist.md`](../knowledge-handbook/production-readiness-checklist.md)：生产就绪检查。
- [`ai-gateway-agent-runtime-playbook.md`](../knowledge-handbook/ai-gateway-agent-runtime-playbook.md)：最终 AI Gateway + Agent Runtime 手册。
- [`capstone-implementation-manual.md`](../knowledge-handbook/capstone-implementation-manual.md)：最终 Capstone 的包级 Go 代码模板、E2E 测试和验收表。
- [`backlink-index.md`](../knowledge-handbook/backlink-index.md)：从概念反查来源和本地 Go lab。
- [`reading-protocol.md`](../knowledge-handbook/reading-protocol.md)：段落级、代码级剖析格式。

## Source Snapshot

我在 2026-07-05 创建第一版快照，并在 2026-07-06 重新核验了 01-05 工作目录中使用的仓库 HEAD：

| Area | Repository | Commit |
|---|---|---|
| Language | [go101/go101](https://github.com/go101/go101) | `c13b00435002a00f574430b61eb65ec5a268acfe` |
| Language | [quii/learn-go-with-tests](https://github.com/quii/learn-go-with-tests) | `dc00c650f66695f7b8cc2e8c8234be177d7b28c6` |
| Language | [mmcgrana/gobyexample](https://github.com/mmcgrana/gobyexample) | `c437a3d5f6814b1141b822ab19a685c3672cec94` |
| Language | [golang/example](https://github.com/golang/example) | `7f05d217867b2af52b0a28c6d1c91df97e1b5b39` |
| Language | [inancgumus/learngo](https://github.com/inancgumus/learngo) | `3c475a78e54336c6255e925ff66b8ef4da6a2ae7` |
| Structure | [golang-standards/project-layout](https://github.com/golang-standards/project-layout) | `a9d6fae7015527b10550ebb6d6b71a71b1ef5ea7` |
| Style | [uber-go/guide](https://github.com/uber-go/guide) | `1d60a91aa5e87d443002e23c21903c49489dbde5` |
| Style | [google/styleguide](https://github.com/google/styleguide/tree/gh-pages/go) | `1809c769de31ba388c755ad15dd057a9ba8531fd` |
| Structure | [sagikazarmark/modern-go-application](https://github.com/sagikazarmark/modern-go-application) | `468a20bc42f96ffebae693a51b006b263b4a497e` |
| Architecture | [ThreeDotsLabs/wild-workouts-go-ddd-example](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example) | `f264c714c5d643bf207d72335f02d3be858d9a84` |
| Architecture | [amitshekhariitbhu/go-backend-clean-architecture](https://github.com/amitshekhariitbhu/go-backend-clean-architecture) | `8a8bf00d4936b325baed89ceb631faae3122d1b5` |
| Architecture | [evrone/go-clean-template](https://github.com/evrone/go-clean-template) | `caa9e35d8ed7c438070954f3355973be9e6ae313` |
| Architecture | [go-kit/examples](https://github.com/go-kit/examples) | `e18c82edc2f9c7de3aff9748751d63270c052c1b` |
| Real project | [pocketbase/pocketbase](https://github.com/pocketbase/pocketbase) | `667a765070bc4554696acb1c96e8a484697008fd` |
| Real project | [usememos/memos](https://github.com/usememos/memos) | `d1cef7a9ab23e8c93f76b2f32661c720c733536d` |
| Real project | [caddyserver/caddy](https://github.com/caddyserver/caddy) | `13a4c3f43c79ca04064457ab9cf95b376c294141` |
| Real project | [syncthing/syncthing](https://github.com/syncthing/syncthing) | `ef4629ea56021d0941017f30ec53be45d2836e24` |
| Advanced | [maximhq/bifrost](https://github.com/maximhq/bifrost) | `4be1d6d3eafcb39f6af49d33c1a7f4dd9285535c` |
| Advanced | [trpc-group/trpc-agent-go](https://github.com/trpc-group/trpc-agent-go) | `9a515687538be3519405d40bb7db19a27efb3800` |
| Advanced | [TykTechnologies/tyk](https://github.com/TykTechnologies/tyk) | `f20ba226415b6ffd37e1872c4e6d92bd83c002f0` |
| Advanced | [cloudwego/hertz](https://github.com/cloudwego/hertz) | `8eec17d4e8b972075cdfa6d6b78822c3db086379` |
| Advanced | [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector) | `00f6354e6f8b7daf031908f7bb0637c6aeb1201d` |
| Advanced | [temporalio/temporal](https://github.com/temporalio/temporal) | `a31f476255b2c7c00176f683cdce84710daaba44` |
| Advanced | [nats-io/nats-server](https://github.com/nats-io/nats-server) | `dd0f12d479de19df97e3c6275ab087f8e3b91891` |
| Architecture template | [study8677/awesome-architecture](https://github.com/study8677/awesome-architecture) | `609e0cd64d6af89549112379cbdd0f0e6cf63a3a` |

## Reading Rule

每个仓库按同一套问题读：

1. 它解决什么系统问题？
2. 程序入口或文档入口在哪里？
3. 关键抽象是什么？
4. 一条请求、任务或事件链路怎么走？
5. 哪个设计能迁移到 AI gateway 或 agent runtime？

每个段落或代码片段继续按 `Source -> Segment -> Concept -> Go Lab` 记录，避免资料只停留在链接收藏。
