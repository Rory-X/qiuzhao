# 钱嘉豪秋招工作台

基于 Vite、React 和 TypeScript 的本地秋招工作台，把机会发现、岗位决策、人工投递、自主面试训练和材料复盘放在同一张桌上。

视觉语言参考 xixicc2027：米白纸张、墨黑双线、朱砂强调和手绘贴纸卡片。基础组件采用 shadcn 的组合方式定制，图标来自 Lucide。

## 启动

开发模式：

```bash
cd workbench
npm ci
npm run dev
```

打开 http://127.0.0.1:5173。Vite 会把 `/api` 代理到只监听本机的状态服务 `127.0.0.1:8765`。

生产构建及本地运行：

```bash
npm run build
npm start
```

打开 http://127.0.0.1:8765。换端口：`PORT=8766 npm start`。

## macOS 保活服务

原工作区本机通过用户级 LaunchAgent 运行，登录后自动启动，异常退出后自动拉起。下面的服务名和路径是原机器配置；克隆仓库不会自动安装服务：

```bash
# 查看状态
launchctl print gui/$(id -u)/com.jiahaoqian.qiuzhao-workbench

# 重启服务
launchctl kickstart -k gui/$(id -u)/com.jiahaoqian.qiuzhao-workbench

# 停止并移除当前登录会话中的服务
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.jiahaoqian.qiuzhao-workbench.plist
```

服务定义：`~/Library/LaunchAgents/com.jiahaoqian.qiuzhao-workbench.plist`

日志目录：`workbench/logs/`

## 能做什么

- **今日作战台**：创建并完成真实任务、查看实时指标、维护周节奏与作战备注
- **岗位雷达**：读取 `qiuzhao-live` 的活跃数据源，搜索/筛选后核验并带入个人机会池
- **机会与投递**：岗位完整增删改查、筛选、官网核验、简历版本与下一步
- **投递流水线**：从机会池到 Offer 的可拖动看板，并保存每周漏斗复盘
- **面试训练室**：安排训练、完成真实问题自练、记录答案证据与能力评分
- **真实面经**：242 道真实问题，支持搜索、分类与折叠参考答案
- **材料与清单**：阅读本地手册，逐项完成并保存投递/面试检查单
- **全局能力**：⌘/Ctrl + K 搜索岗位、材料和面经；首次进入提供可跳过引导

## 数据

状态保存在 `data/state.json`。仓库默认是干净空数据，不会注入演示公司、虚构进度或训练分数。所有页面操作都会写回本地文件。不要把个人求职数据提交到远程。

岗位雷达的数据由同仓库的 [../qiuzhao-live](../qiuzhao-live/) 生产，默认按代码所在目录定位，无需配置原机器的绝对路径。可通过环境变量 `QIUZHAO_LIVE_DIR` 指定其它目录；例如 `QIUZHAO_LIVE_DIR=/absolute/path/to/qiuzhao-live npm start`。`.env.example` 仅作配置参考，启动脚本不会自动加载 `.env`。

- 归一化岗位：`qiuzhao-live/data/jobs.json`
- 每日同步摘要：`data/radar-sync.json`
- 可读更新报告：`data/radar-latest.md`
- 差异计算基线：`data/radar-known.json`

数据源刷新时还会同步可验证的公司 Logo 到 `qiuzhao-live/data/logos/`：
优先使用 Simple Icons，其次读取人工确认的公司官网 favicon；无法确认的公司
在 UI 中显示轻量双字简称。已有机会池记录会按公司名自动补全 Logo，无需重新录入。

手动更新：

```bash
./scripts/refresh_job_radar.py
```

原机器的 LaunchAgent `com.jiahaoqian.qiuzhao-radar` 在登录时检查，并于每天 09:00 再检查；`--if-due` 保证成功同步后当天不重复抓取。原机器另有“秋招岗位雷达每日更新”任务，在每天 09:10 推送详细摘要；这些调度配置不随仓库自动启用。

## 校验

```bash
npm run check
npm run build
curl http://127.0.0.1:8765/api/health
```
