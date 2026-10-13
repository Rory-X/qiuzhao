# Go Learning 文档站

`5173` 在当前机器上被其他项目占用，因此本学习站固定使用 `5174`：

```bash
cd site
npm install
npm run dev:5174
```

访问 `http://localhost:5174`。如果 `5173` 空闲，也可以运行 `npm run dev` 使用 VitePress 默认端口。

五个章节目录均为符号链接，Markdown 仍只维护上级 `01_language_basics/` 到 `05_large_systems/` 中的原文件。

## macOS 常驻运行

项目根目录的 `services/install.sh` 可以将文档站和 GoNB 工作台安装为登录自动启动、异常自动拉起的 `launchd` 用户服务。管理命令见 `services/README.md`。
