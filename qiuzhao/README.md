# Go 学习项目

面向 TypeScript / Node.js 开发者的 Go 学习材料与实践项目。

## 目录

| 目录 | 内容 |
|---|---|
| `01_language_basics/` | 类型、接口、错误处理、并发与测试 |
| `02_project_structure/` | Go module、项目布局与 HTTP API 示例 |
| `03_architecture_patterns/` | 架构模式与可运行的 Labs |
| `04_real_projects/` | 真实项目阅读与模式提炼 |
| `05_large_systems/` | AI Gateway、Agent Runtime 与 Capstone |
| [`site/`](site/README.md) | VitePress 文档站 |
| [`workbench/`](workbench/README.md) | JupyterLab + GoNB 实践工作台 |
| [`services/`](services/README.md) | macOS 常驻服务脚本 |
| `.archive/` | 历史资料与设计记录 |

以下命令均从本目录（仓库根目录下的 `qiuzhao/`）执行。

## 文档站

```bash
npm --prefix site ci
npm --prefix site run dev:5174
```

访问 <http://localhost:5174>。检查链接并构建：

```bash
npm --prefix site run build
```

## 实践工作台

```bash
./workbench/start-local.sh
```

访问 <http://localhost:8888/lab>。Docker 启动方式见 [工作台说明](workbench/README.md)。

## Go 测试

```bash
(cd 02_project_structure/api_service && go test ./...)
(cd 03_architecture_patterns/labs && go test ./...)
(cd 05_large_systems/capstone && go test ./...)
```

## macOS 常驻服务

```bash
./services/install.sh
./services/status.sh
```

移动项目目录后，重新运行 `install.sh` 以更新 LaunchAgent 中的绝对路径。
