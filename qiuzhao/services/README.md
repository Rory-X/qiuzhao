# macOS 常驻服务

`launchd` 负责在登录时启动 VitePress 与 JupyterLab，并在进程异常退出后自动拉起。两个服务只监听本机回环地址，不对局域网或公网开放。

## 安装或重新安装

```bash
./services/install.sh
```

安装过程会先验证文档站构建，然后生成两个用户级 LaunchAgent：

- `com.jiahaoqian.go-learning.site`：<http://127.0.0.1:5174>
- `com.jiahaoqian.go-learning.workbench`：<http://127.0.0.1:8888/lab>

## 管理

```bash
./services/status.sh    # 查看进程并执行 HTTP/GoNB 健康检查
./services/restart.sh   # 重启两个服务
./services/uninstall.sh # 停止服务并取消登录自启
```

日志保存在 `~/Library/Logs/go-learning/`。LaunchAgent 配置保存在 `~/Library/LaunchAgents/`。

这是用户级服务：退出登录时服务停止，下次登录会自动恢复；不需要管理员权限。
