# Source Segment Cards

这个目录把 GitHub 材料进一步拆成“逐段知识卡”。它补足 `github-project-analysis.md` 的下一层粒度：

```text
Repository
  -> Read anchor
  -> Segment card
  -> Go learning translation
  -> Local proof
```

## Files

- [`language-segments.md`](language-segments.md)：Go 语言、测试、并发、标准库。
- [`github-repo-reading-cards.md`](github-repo-reading-cards.md)：所有已纳入 GitHub 仓库的仓库级阅读卡，包含读法、抽象、Go 翻译和本地证明。
- [`structure-segments.md`](structure-segments.md)：目录结构、代码风格、生产启动面。
- [`architecture-segments.md`](architecture-segments.md)：DDD、Clean Architecture、endpoint/transport。
- [`real-project-segments.md`](real-project-segments.md)：产品型 Go 项目、插件、协议、生命周期。
- [`../source-code-anchors-foundations.md`](../source-code-anchors-foundations.md)：01-04 仓库真实源码锚点补充层。
- [`large-system-segments.md`](large-system-segments.md)：AI gateway、agent runtime、网关、可观测、工作流、消息。
- [`../source-code-anchors-advanced.md`](../source-code-anchors-advanced.md)：高级仓库真实源码锚点补充层。

## Segment Card Format

```text
Segment:
Anchor:
What to read:
Design extraction:
Go translation:
Local proof:
Backlinks:
```

代码块尽量使用“学习版翻译”，避免把第三方源码原样搬入本地仓库。
