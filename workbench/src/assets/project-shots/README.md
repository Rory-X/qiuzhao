# 项目截图

将真实截图放进此目录即可自动填入详情页。不需要改组件。

命名：`<项目 slug>-<两位序号>.png`，也支持 `.webp`、`.jpg`、`.jpeg`。

项目 slug：`e-pi`、`dsh-desktop`、`fogot`、`intro-builder`、`r-api`、`xuu`。

例如：`e-pi-01.png` 对应 E-Pi 主图，`e-pi-02.png`、`e-pi-03.png` 对应两个细节图。
同一个槽位只保留一个文件；如有多种格式，优先 png、webp、jpg、jpeg。

主图建议 1600×900，细节图建议 1440×900。图片等比例完整显示，不裁掉界面。
点击图片可在新标签页查看原图。缺图时保留占位，不加载虚构截图。

开发模式会发现新文件；生产服务需要在 workbench 目录重新执行 `npm run build`。

具体拍摄建议见工作区根目录 `project-screenshot-guide.md`。
