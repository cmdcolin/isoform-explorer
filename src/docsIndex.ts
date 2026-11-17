import { readFileSync, writeFileSync } from 'node:fs'
import { glob } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'

import { ROOT } from './paths.ts'

const DOCS = join(ROOT, 'agent-docs')
export const BEGIN = '<!-- BEGIN GENERATED INDEX -->'
export const END = '<!-- END GENERATED INDEX -->'

export interface Doc {
  path: string
  name: string
  description: string
}

/**
 * The `name:` and `description:` of a doc. A value may continue on the
 * following indented lines, which are joined into one line.
 */
export function frontmatter(text: string) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  const fields = new Map<string, string[]>()
  let key = ''
  for (const line of (match?.[1] ?? '').split('\n')) {
    const started = /^([A-Za-z][\w-]*):[ \t]*(.*)$/.exec(line)
    if (started) {
      key = started[1] ?? ''
      fields.set(key, started[2] ? [started[2]] : [])
    } else if (key && /^\s+\S/.test(line)) {
      fields.get(key)?.push(line.trim())
    }
  }
  const value = (name: string) =>
    fields
      .get(name)
      ?.join(' ')
      .replace(/^["'](.*)["']$/s, '$1')
  return { name: value('name'), description: value('description') }
}

export function indexTable(docs: Doc[], heading: string) {
  const rows = docs
    .toSorted((a, b) => a.path.localeCompare(b.path))
    .map(
      doc =>
        `| [${doc.name}](${doc.path}) | ${doc.description.replace(/\|/g, '\\|')} |`,
    )
  return rows.length === 0
    ? '_None right now._'
    : [`| Doc | ${heading} |`, '| --- | --- |', ...rows].join('\n')
}

export function withTable(readme: string, table: string) {
  const begin = readme.indexOf(BEGIN)
  const end = readme.indexOf(END)
  return begin === -1 || end === -1
    ? undefined
    : `${readme.slice(0, begin + BEGIN.length)}\n\n${table}\n\n${readme.slice(end)}`
}

const HEADINGS: Record<string, string> = {
  handoffs: 'What it is waiting on',
  ideas: 'What it proposes',
  reference: 'What it settles',
}

/**
 * Rewrites the index block of every `<dir>/README.md` under `root` from the
 * frontmatter of the docs beside it, and returns the ones that were stale. A
 * nested README is never a row and never gets a table of its own.
 */
export async function rewriteIndexes(root: string, check = false) {
  const stale: string[] = []
  for await (const entry of glob('*/README.md', { cwd: root })) {
    const dir = dirname(entry)
    const docs: Doc[] = []
    for await (const found of glob('**/*.md', { cwd: join(root, dir) })) {
      if (basename(found) !== 'README.md') {
        const path = join(root, dir, found)
        const { name, description } = frontmatter(readFileSync(path, 'utf8'))
        if (!name || !description) {
          throw new Error(
            `${relative(root, path)} needs name: and description: frontmatter`,
          )
        }
        docs.push({ path: found, name, description })
      }
    }
    const readme = join(root, entry)
    const current = readFileSync(readme, 'utf8')
    const next = withTable(current, indexTable(docs, HEADINGS[dir] ?? 'What'))
    if (!next) {
      throw new Error(`${entry} has no ${BEGIN} block`)
    }
    if (next !== current) {
      stale.push(entry)
      if (!check) {
        writeFileSync(readme, next)
      }
    }
  }
  return stale
}

if (import.meta.main) {
  const check = process.argv.includes('--check')
  const stale = await rewriteIndexes(DOCS, check)
  if (check && stale.length > 0) {
    console.error(`stale index: ${stale.join(', ')}; run pnpm docs-index`)
    process.exitCode = 1
  } else {
    console.log(
      stale.length === 0 ? 'indexes up to date' : `rewrote ${stale.join(', ')}`,
    )
  }
}
