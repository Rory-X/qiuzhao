# GoNB 实践工作台

这个目录提供 JupyterLab + GoNB。Notebook 与三个现有 Go module 挂载到同一容器，适合逐 cell 实验、运行测试和保留学习记录。

## 启动

```bash
cd workbench
docker compose up --build
```

Linux 上如果宿主 UID/GID 不是 1000，可避免生成 root/异主文件：

```bash
LOCAL_UID="$(id -u)" LOCAL_GID="$(id -g)" docker compose up --build
```

打开 <http://localhost:8888>，选择 `Go (gonb)` kernel。当前配置仅用于本机学习，关闭了 Jupyter token；不要直接暴露到公网。

停止并清理容器：

```bash
docker compose down
```

### 没有 Docker 时

macOS/Linux 可使用仓库内的隔离环境，不修改系统 Python：

```bash
cd workbench
./start-local.sh
```

首次启动会在本目录安装 `.venv`、`.bin/gonb` 和隔离的 Jupyter kernel，之后仍访问 <http://localhost:8888>。
Ubuntu/Debian 如果缺少 venv，请先安装 `python3-venv`。

### macOS 常驻运行

项目根目录的 `services/install.sh` 可以将工作台和文档站安装为登录自动启动、异常自动拉起的 `launchd` 用户服务。管理命令见 `services/README.md`。

## 挂载目录

| 容器路径 | 来源 | 用途 |
|---|---|---|
| `/workspace/notebooks` | `workbench/notebooks` | 保存学习记录 |
| `/workspace/examples` | `01_language_basics/examples` | 语言示例索引 |
| `/workspace/api_service` | `02_project_structure/api_service` | HTTP 服务实验 |
| `/workspace/labs` | `03_architecture_patterns/labs` | 架构实验 |
| `/workspace/capstone` | `05_large_systems/capstone` | 网关与 Agent 实验 |

Notebook 中可以使用 GoNB shell magic：

```text
!*cd /workspace/capstone && go test ./...
```

## Lab 案例

先打开 `notebooks/00-start-here.ipynb`，再从语言基础、后端工程或大型系统路线进入。每节都包含前端心智模型映射、运行前预测、可执行实验、动手挑战和复盘问题。

三个代码目录是独立 module。需要导入其 `internal` 包时，应在对应 module 内编写/运行测试；从 `/workspace/notebooks` 直接 import 会被 Go 的 `internal/` 访问规则拒绝。

## 版本选择

- 基础镜像：Go 1.24.4 Bookworm
- GoNB：v0.11.4
- goimports：v0.34.0
- gopls：v0.19.1
- JupyterLab：4.6.1

GoNB v0.11.4 要求 Go 1.24.4，因此工作台使用 Go 1.24；它可以向后构建本仓库声明 Go 1.22 的 module。

容器内的 `/workspace/go.work` 将 notebook、API Service、Labs 和 Capstone 组成临时 workspace；宿主机对应配置是本目录的 `go.work`。Notebook module 可以直接 import Labs 这类公开包；Go 的 `internal/` 包仍只能由所属 module 树内代码导入。
