---
layout: home

hero:
  name: Go Learning
  text: 从 TypeScript 到 Go 全栈
  tagline: 语言基础、项目结构、架构模式、真实项目与大型系统，一条路径读完并动手验证。
  actions:
    - theme: brand
      text: 从 1.1 开始
      link: /01_language_basics/1.1-types-and-interfaces
    - theme: alt
      text: 打开实践索引
      link: /01_language_basics/examples/

features:
  - title: 前端心智迁移
    details: 每篇先建立 TypeScript / Node.js 类比，再解释 Go 的语义、边界和常见坑。
  - title: 真实代码锚点
    details: 文档链接到 API Service、Architecture Labs 与 Capstone 的可运行实现和测试。
  - title: 从语法到生产
    details: 从类型、并发和测试一路推进到 AI Gateway、Agent Runtime、可观测与高可用。
---

## 推荐学习方式

1. 从左侧目录按 01 → 05 顺序阅读，使用右侧目录定位当前知识点。
2. 遇到代码锚点时，在 GoNB 工作台或终端运行对应测试。
3. 用页面顶部的本地搜索回查术语、模式和项目名称。

## 本地启动

```bash
cd site
npm install
npm run dev:5174
```

当前访问地址为 `http://localhost:5174`；`5173` 已被本机其他项目占用。修改上级五个章节目录中的 Markdown，浏览器会自动热更新。
