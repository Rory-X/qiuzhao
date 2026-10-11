# xuu 缓存攻克与验证方案

基线：44a00fe2edab0a966dd62f7e3b23271bf3ce0136。以下是历史实现分析，未运行真实模型实验；不推定全部改动为个人贡献。

## 缓存边界：稳定历史与易变提醒分开

问题：把缓存标记放在每次变化的提醒之后，后续请求难以复用；隐藏上下文也不应被误认成用户新一轮输入。

方案：区分 stable prefix 与 turn prefix；在 Anthropic 适配层映射消息时跟踪最后一个非易变内容块，将滑动缓存标记放在易变尾部之前。

取舍：这是请求布局与适配器策略，服务端是否命中仍需真实 usage 验证。稳定的 key 也不能让变化的请求内容自动命中。

[提交](https://github.com/Rory-X/xuu/commit/c6a56c3545861fe73f57f698a706172f931b2728) · [代码](https://github.com/Rory-X/xuu/blob/c6a56c3545861fe73f57f698a706172f931b2728/internal/providers/anthropic/client.go)

## 跨轮连续性：用量重置不再清掉上下文保留状态

问题：工具循环内部前缀稳定，但桌面每轮入口重置 usage 时同时清掉保留上下文，导致进入下一轮就丢失连续性。

方案：拆开 usage 基线与上下文生命周期；用持久历史指纹判断保留状态能否复用，并在新轮的真实入口与最新上下文对账。

取舍：历史被编辑、重写或分叉时允许失效。不能为了命中率，把上一轮已失效的目标或工具策略带入新任务。

[提交](https://github.com/Rory-X/xuu/commit/830d02f3f86dc9b39e28f851fa18dd4961c6f23b) · [代码](https://github.com/Rory-X/xuu/blob/830d02f3f86dc9b39e28f851fa18dd4961c6f23b/internal/appserver/retained_context_turn_entry_test.go)

## 动态上下文：追加更新，显式表达失效

问题：每轮原地替换状态会破坏前缀；永久保留旧状态又会让模型使用过期信息。

方案：类型化上下文以稳定 key 表示更新流：相同快照不重复发送，变化追加在尾部，以 latest-wins 规则覆盖旧版本；消失时追加 inactive，重新出现时再激活。

取舍：旧版本仍占上下文空间，语义上也需要模型遵守覆盖规则。前缀连续性测试不能证明模型一定忽略旧指令，必须另评测任务正确性。

[提交](https://github.com/Rory-X/xuu/commit/59c5c8a9adae756056e9b36f0c52df97e7367e9b) · [代码](https://github.com/Rory-X/xuu/blob/59c5c8a9adae756056e9b36f0c52df97e7367e9b/internal/agent/request_assembler.go)

## 工具定义：从运行中扩容转向稳定工具面

问题：本地渐进加载会在后续轮次改变顶层 tools 数组，打断已建立的请求前缀，长循环的重复输入成本难以预测。

方案：移除该本地渐进模式：提供方与模型支持原生工具发现时走 native，否则使用 flat；旧配置兼容映射并给出提示，运行期间固定工具面以减少异步目录变化。

取舍：flat 多带固定 Schema，换取更稳定的前缀。提交说明中的约 7.8KB 是当时新增 Schema 体积，不是 Token 数，也不是实测节省金额。

[提交](https://github.com/Rory-X/xuu/commit/e81af507d1d8baf87da9cf3d0ef8a07a2769ead0) · [代码](https://github.com/Rory-X/xuu/blob/e81af507d1d8baf87da9cf3d0ef8a07a2769ead0/internal/runtime/session.go)

## 协作提醒：减少无效变化，不主动打断执行

问题：未读消息频繁变化，若每次都重建上下文或唤醒模型，会增加请求抖动与不必要调用。

方案：在正常模型请求中按约 3 秒间隔采样收件箱摘要，复用相同快照并将变化追加尾部；新轮先清空采样状态，避免房间切换带入旧信息。

取舍：提醒允许短暂滞后，采样本身不读取正文、不触发新 turn，也不代表消息已经处理。

[提交](https://github.com/Rory-X/xuu/commit/a40072e1ab6ce44681abd1ae14ce657ff48644f7) · [代码](https://github.com/Rory-X/xuu/blob/a40072e1ab6ce44681abd1ae14ce657ff48644f7/internal/appserver/named_agent_inbox_context.go)

## 搜索缓存：新查询保新鲜，分页保一致

问题：工作空间摘要只能尽力反映文件变化，用它判定持久搜索结果新鲜度可能返回旧内容。

方案：offset 为零时重新查询当前文件，后续分页继续校验结果快照；将缓存复用范围收窄到可验证的连续读取。

取舍：牺牲部分首屏查询复用，保护结果正确性。它是工具结果缓存，不能与模型 Prompt Cache 的命中率混为一谈。

[提交](https://github.com/Rory-X/xuu/commit/580a61deecc4e8eca20d39ea34b097ee3dc45ad2) · [代码](https://github.com/Rory-X/xuu/blob/580a61deecc4e8eca20d39ea34b097ee3dc45ad2/internal/tools/tool_search.go)

## 缓存诊断与验证

`internal/agent/loop_prefix_experiment_test.go` 使用模拟模型驱动多轮工具会话，比较相邻请求的消息前缀，覆盖稳定快照、动态变化、上下文消失和重新激活、历史编辑以及压缩后恢复连续性。它证明客户端请求组装契约，不等于实际提供方 KV Cache 命中。

`internal/providers/anthropic/prefix_stability_test.go` 检查适配器映射后的前缀，比较时剥离按设计移动的 cache_control 标记。7 月 3 日的修复还纠正了 Go map 无序遍历导致的诊断误报。

需要注意：当前基线的 `cacheStablePrefixFingerprint` 虽然排序了顶层 Schema key，却未完整编码 Schema 的值，不能视为严格的工具定义等价判断。若继续优化，可对完整规范化工具 Schema 和顺序做指纹，并补“键不变、类型/枚举变了”的反例测试；此处为代码阅读发现的诊断覆盖缺口，不等于已证明线上缓存错误。

### 建议实验

1. 固定模型/提供方、工具定义、任务、代码 SHA、会话历史和执行间隔；每组记录冷启动与后续热请求，注意提供方缓存保留与计费策略。
2. 分别比较：稳定上下文；频繁替换快照；追加更新；上下文失效；工具面改变；压缩/历史编辑。一次只改一个因素。
3. 代码层记录：相邻请求公共前缀长度、分歧位置、上下文更新数量、工具 Schema 指纹、输入增长量。
4. 提供方层记录：真实 cache-read/cache-write usage、首 Token 延迟、总延迟、重试与总体成本。各提供方 input/cache usage 口径先核对，不能统一套同一个命中率公式；缺失数据记未知。
5. 业务层检查：旧目标和权限撤销后是否仍被执行、inactive 后是否采用旧状态、任务成功率是否下降。Prompt 文本中的 latest-wins 不是权限执行保障。
6. 给追加式上下文设置容量观察指标。缓存命中增加但历史膨胀、成本上升或正确率下降，都不能算优化成功。

第一份报告只需两个配置、少量固定任务和多次重复，保留原始请求摘要、usage、环境与失败样例；本专题不预填收益百分比。
