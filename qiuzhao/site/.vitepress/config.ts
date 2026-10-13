import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type DefaultTheme } from 'vitepress'

const siteRoot = fileURLToPath(new URL('..', import.meta.url))

const chapters = [
  { dir: '01_language_basics', text: '01 语言基础' },
  { dir: '02_project_structure', text: '02 项目结构' },
  { dir: '03_architecture_patterns', text: '03 架构模式' },
  { dir: '04_real_projects', text: '04 真实项目' },
  { dir: '05_large_systems', text: '05 大型系统' },
]

function compareNaturally(a: string, b: string) {
  return a.localeCompare(b, 'zh-CN', { numeric: true })
}

function titleFromMarkdown(file: string) {
  const heading = readFileSync(file, 'utf8').match(/^#\s+(.+)$/m)?.[1]
  return heading ?? basename(file, extname(file))
}

function collectMarkdown(
  directory: string,
  urlPrefix: string,
): DefaultTheme.SidebarItem[] {
  const items: DefaultTheme.SidebarItem[] = []

  for (const entry of readdirSync(directory).sort(compareNaturally)) {
    if (entry.startsWith('.')) continue

    const absolute = resolve(directory, entry)
    if (statSync(absolute).isDirectory()) {
      const children = collectMarkdown(absolute, `${urlPrefix}/${entry}`)
      if (children.length > 0) {
        items.push({
          text: entry === 'examples' ? '1.6 可运行示例' : entry,
          collapsed: false,
          items: children,
        })
      }
      continue
    }

    if (extname(entry) !== '.md') continue

    const slug = entry === 'README.md' ? '' : `/${basename(entry, '.md')}`
    items.push({
      text: titleFromMarkdown(absolute),
      link: `${urlPrefix}${slug || '/'}`,
    })
  }

  return items
}

const sidebar: DefaultTheme.SidebarItem[] = chapters.map(({ dir, text }) => ({
  text,
  collapsed: false,
  items: collectMarkdown(resolve(siteRoot, dir), `/${dir}`),
}))

export default defineConfig({
  lang: 'zh-CN',
  title: 'Go Learning',
  description: '面向 TypeScript / Node.js 开发者的 Go 全栈学习路径',
  cleanUrls: true,
  lastUpdated: true,
  // Code anchors and package-directory links are not VitePress pages. All
  // filesystem targets are still checked by `npm run check:links`.
  ignoreDeadLinks: [/\.go$/, /go\.mod$/, /\/index$/],
  markdown: {
    lineNumbers: true,
  },
  vite: {
    resolve: {
      preserveSymlinks: true,
    },
    server: {
      host: '127.0.0.1',
      strictPort: true,
    },
    preview: {
      host: '127.0.0.1',
      strictPort: true,
    },
  },
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      ...chapters.map(({ dir, text }) => ({
        text,
        link: collectMarkdown(resolve(siteRoot, dir), `/${dir}`)[0]?.link ?? '/',
      })),
    ],
    sidebar,
    outline: {
      level: [2, 3],
      label: '本页目录',
    },
    search: {
      provider: 'local',
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },
    lastUpdated: {
      text: '最后更新',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    },
    returnToTopLabel: '返回顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '外观',
  },
})
