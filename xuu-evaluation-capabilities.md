# xuu 已有评测与优化能力

核对基线：44a00fe2edab0a966dd62f7e3b23271bf3ce0136（前次读取的仓库快照，不声称最新远程版本）。本次只读源码和测试，未运行真实模型评测。

## 已有三层能力

1. 确定性回归：usage_test.go 验证本地估算不覆盖提供方基线；context_window_recovery_test.go 验证溢出裁剪、持久化失败与原样请求不重试；session/control_test.go 验证接管后旧指令失效；harness_media_test.go 验证媒体交接；AppState.test.ts 覆盖后台事件与排序。
2. 内置 Agent 任务评测：cmd/wuu/eval.go 提供 wuu eval、--list、--task、--json、--output、--replay-trace 等入口。internal/evalharness/tasks.go 包含修复失败测试、多文件价格逻辑、过期文件读取恢复、延迟工具发现、MCP 只读并发和子 Agent 委派等任务。任务可以声明必需/禁止工具、参数和顺序、预期工具错误及独立 Verify；Result 包含结果、用量、耗时与 Observability。
3. 协作对照方案：evals/cases/collaboration-orchestration 定义 single、independent、fan-in、verified fan-in 四组配置与八种场景，要求同模型、fixture、权限与评分条件，成本/性能结论前每个组合至少重复五次。fixture 需要另补可分发材料，并不是现成完整实验成绩。

## 与开发期评测的对应

- 上下文压缩：预算估算及恢复机制属于契约测试；是否保持任务质量仍需真实模型对照。
- 人工接管：revision 拦截迟到指令属于状态正确性；多轮理解用户改口另需任务评测。
- 过期读取：不仅确认工具报错，还要求 Agent 能重新读取后继续完成任务。
- 工具调用：不仅检查最终文本，也有参数、序列和禁止工具断言；评测时审查这些要求是否属于真正业务约束，避免卡死合法解法。
- 后台事件合并：减少 reducer 更新属于实现优化；不能从代码推算帧率或任务速度提升。

## 当前证据边界

该快照下 evals/results 只有 README.md，没有已提交的公开结果记录。不能据此宣称没有做过私有实验，也不能把存在 harness 写成已经证明成功率或成本更优。trace replay 的帮助说明明确不调用模型、不执行工具；它不是一次新的真实模型实验。

## 建议下一步

先阅读和运行内置列表，再选择 test_failure_fix、stale_read_guard、tool_search_deferred 三类任务作为起点。固定版本和模型后保存基线，再改一种机制做对照。结果至少包含失败样例、最终状态断言、trace、Token/耗时及配置清单。不要为了评测先把 xuu 重写为 LangGraph；框架无关的工程问题已能在现有实现里验证。

## 固定版本源码

- [CLI](https://github.com/Rory-X/xuu/blob/44a00fe2edab0a966dd62f7e3b23271bf3ce0136/cmd/wuu/eval.go)
- [任务与评分契约](https://github.com/Rory-X/xuu/blob/44a00fe2edab0a966dd62f7e3b23271bf3ce0136/internal/evalharness/tasks.go)
- [协作对照方案](https://github.com/Rory-X/xuu/blob/44a00fe2edab0a966dd62f7e3b23271bf3ce0136/evals/cases/collaboration-orchestration/README.md)
- [公开结果目录](https://github.com/Rory-X/xuu/tree/44a00fe2edab0a966dd62f7e3b23271bf3ce0136/evals/results)

缓存重点专题见 [xuu 缓存攻克与验证方案](./xuu-cache-design.md)：包含六个提交案例、前缀契约测试与真实缓存实验设计。

按完整 Coding Agent 链路梳理的提交问题与解法见 [xuu Coding Agent 实现模块研究](./xuu-coding-agent-modules.md)。
