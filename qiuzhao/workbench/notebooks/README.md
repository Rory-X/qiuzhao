# GoNB Lab 案例目录

先打开 `00-start-here.ipynb`。每个 Notebook 都能独立执行；类型、函数和 import 可跨 cell 使用，`%%` 中的局部变量应留在当前执行 cell。

| Notebook | 主题 | 关键练习 |
|---|---|---|
| `00-start-here.ipynb` | 使用指南 | 环境检查、cell 模型、学习路线 |
| `01-types.ipynb` | 类型与接口 | 值语义、隐式接口、typed nil |
| `01-errors-and-testing.ipynb` | 错误与测试 | `%w`、`errors.Is/As`、表格用例 |
| `01-concurrency.ipynb` | 并发 | worker、channel、context timeout |
| `02-http-api.ipynb` | HTTP API | JSON 边界、状态码、`httptest` |
| `03-middleware.ipynb` | 中间件 | 洋葱模型、真实 module import |
| `03-events-and-cqrs.ipynb` | 事件与 CQRS | replay、expected version、读模型 |
| `04-gateway-fallback.ipynb` | 网关 | provider 路由、fallback、流式边界 |
| `05-resilience.ipynb` | 系统韧性 | timeout budget、retry、熔断状态机 |

## 推荐路线

- 语言基础：`01-types` → `01-errors-and-testing` → `01-concurrency`
- 后端工程：`02-http-api` → `03-middleware` → `03-events-and-cqrs`
- 大型系统：`04-gateway-fallback` → `05-resilience`

每节按“先预测 → 运行 → 修改参数 → 完成挑战 → 回答复盘”的顺序学习。完成后 Restart Kernel，再 Run All 一次，确认案例不依赖隐藏状态。

所有案例由 `../scripts/generate-lab-cases.mjs` 生成。修改内容后执行：

```bash
node workbench/scripts/generate-lab-cases.mjs
```

JupyterLab 常驻地址：<http://127.0.0.1:8888/lab>。
