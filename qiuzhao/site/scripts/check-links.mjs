import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const siteRoot = fileURLToPath(new URL('..', import.meta.url))
const chapterDirectories = [
  '01_language_basics',
  '02_project_structure',
  '03_architecture_patterns',
  '04_real_projects',
  '05_large_systems',
]

function markdownFiles(directory) {
  const files = []

  for (const entry of readdirSync(directory)) {
    if (entry.startsWith('.')) continue
    const absolute = resolve(directory, entry)

    if (statSync(absolute).isDirectory()) {
      files.push(...markdownFiles(absolute))
    } else if (extname(entry) === '.md') {
      files.push(absolute)
    }
  }

  return files
}

const sourceFiles = [resolve(siteRoot, 'index.md')]
for (const chapter of chapterDirectories) {
  sourceFiles.push(...markdownFiles(resolve(siteRoot, chapter)))
}

const missing = []
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g

for (const file of sourceFiles) {
  const lines = readFileSync(file, 'utf8').split('\n')
  let inFence = false

  lines.forEach((line, index) => {
    if (line.startsWith('```')) {
      inFence = !inFence
      return
    }
    if (inFence) return

    for (const match of line.matchAll(linkPattern)) {
      let target = match[1].replace(/^<|>$/g, '')
      if (/^(https?:\/\/|mailto:|#)/.test(target)) continue

      target = decodeURIComponent(target.split('#')[0])
      if (!target) continue

      const absoluteTarget = resolve(dirname(file), target)
      if (!existsSync(absoluteTarget)) {
        missing.push(`${file}:${index + 1} -> ${target}`)
      }
    }
  })
}

if (missing.length > 0) {
  console.error(`Found ${missing.length} missing local link(s):`)
  console.error(missing.join('\n'))
  process.exit(1)
}

console.log('All local Markdown links resolve.')
