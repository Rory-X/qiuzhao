# Reading Protocol

这个协议用于把 GitHub 仓库读成知识手册，而不是读完就忘。

## Source Card

每个仓库先建立 Source Card：

```text
Repository:
Snapshot:
System problem:
Entry docs:
Entry code:
Critical path:
Concept backlinks:
Local Go labs:
Read status:
```

## Segment Card

每个 README 段落、接口文件或关键函数按下面格式拆：

```text
Segment:
Source anchor:
What it says:
Why it matters:
Go design transfer:
Failure mode:
Backlinks:
```

其中 `What it says` 用自己的话概括，不复制整段原文。代码只摘最小必要片段，主要解释结构、边界和取舍。

## 代码剖析层级

大系统代码按四层读，不从最大文件开始：

1. **Entry**：`cmd/.../main.go`、server bootstrap、CLI command。
2. **Boundary**：interface、transport、handler、endpoint、module registry。
3. **Critical path**：一条请求、事件、任务或消息如何穿过系统。
4. **Lifecycle**：startup、health、shutdown、retry、metrics、trace、cleanup。

## 反向链接命名

概念链接统一写成：

```markdown
Backlinks: [AI Gateway](concepts/ai-gateway.md), [Backpressure](concepts/concurrency-backpressure.md)
```

本地代码链接统一指向 package：

```markdown
Local lab: ../../architecture_labs/gateway
```

## 对你的最终系统的过滤器

每段材料都要回答：

- 它能帮 `AI Gateway` 哪个能力？
- 它能帮 `Agent Runtime` 哪个能力？
- 它能帮高并发、高可用或可观测哪个能力？
- 它在 Go 里应该变成 interface、package、middleware、queue、state machine 还是 test case？
