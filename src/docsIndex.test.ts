import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  BEGIN,
  END,
  frontmatter,
  indexTable,
  rewriteIndexes,
  withTable,
} from './docsIndex.ts'

describe('frontmatter', () => {
  it('reads a name and a one-line description', () => {
    expect(
      frontmatter(
        '---\nname: deploy\ndescription: How it ships.\n---\n\n# Deploy\n',
      ),
    ).toEqual({ name: 'deploy', description: 'How it ships.' })
  })

  it('joins a description wrapped over several indented lines', () => {
    const text = [
      '---',
      'name: claims',
      'description:',
      '  "What the site refuses to claim, and why.',
      '  Read before writing a sentence."',
      '---',
      '',
    ].join('\n')
    expect(frontmatter(text).description).toBe(
      'What the site refuses to claim, and why. Read before writing a sentence.',
    )
  })

  it('gives nothing for a doc with no frontmatter', () => {
    expect(frontmatter('# Just a heading\n')).toEqual({
      name: undefined,
      description: undefined,
    })
  })
})

describe('indexTable', () => {
  it('sorts by path and links each doc', () => {
    const table = indexTable(
      [
        { path: 'b/second.md', name: 'second', description: 'Second.' },
        { path: 'a/first.md', name: 'first', description: 'First.' },
      ],
      'What it settles',
    )
    expect(table).toContain('| Doc | What it settles |')
    expect(table.indexOf('a/first.md')).toBeLessThan(
      table.indexOf('b/second.md'),
    )
    expect(table).toContain('| [first](a/first.md) | First. |')
  })

  it('escapes a pipe so it does not split the row', () => {
    expect(
      indexTable([{ path: 'x.md', name: 'x', description: 'a | b' }], 'What'),
    ).toContain('a \\| b')
  })

  it('says so when a directory is empty', () => {
    expect(indexTable([], 'What')).toContain('_None right now._')
  })
})

describe('withTable', () => {
  it('replaces what is between the markers and keeps the rest', () => {
    const readme = [
      '# Index',
      '',
      '<!-- BEGIN GENERATED INDEX -->',
      'stale',
      '<!-- END GENERATED INDEX -->',
      '',
      'after',
      '',
    ].join('\n')
    const next = withTable(readme, 'fresh')
    expect(next).toContain('fresh')
    expect(next).not.toContain('stale')
    expect(next?.endsWith('\nafter\n')).toBe(true)
  })

  it('gives nothing when the markers are missing', () => {
    expect(withTable('# Index\n', 'fresh')).toBeUndefined()
  })
})

describe('rewriteIndexes', () => {
  const build = (files: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'docs-index-'))
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), content)
    }
    return root
  }
  const README = ['# Index', '', BEGIN, '', '_old_', '', END, ''].join('\n')
  const doc = (name: string, description: string) =>
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`

  it('writes a row for every doc below the README, nested included', async () => {
    const root = build({
      'ideas/README.md': README,
      'ideas/one.md': doc('one', 'First.'),
      'ideas/ready/two.md': doc('two', 'Second.'),
    })
    expect(await rewriteIndexes(root)).toEqual(['ideas/README.md'])
    const written = readFileSync(join(root, 'ideas/README.md'), 'utf8')
    expect(written).toContain('| [one](one.md) | First. |')
    expect(written).toContain('| [two](ready/two.md) | Second. |')
    expect(written).not.toContain('_old_')
  })

  it('leaves a nested README out of the rows and gives it no table', async () => {
    const root = build({
      'ideas/README.md': README,
      'ideas/ready/README.md': '# Ready\n',
      'ideas/ready/two.md': doc('two', 'Second.'),
    })
    await rewriteIndexes(root)
    const written = readFileSync(join(root, 'ideas/README.md'), 'utf8')
    expect(written).toContain('[two](ready/two.md)')
    expect(written).not.toContain('README')
    expect(readFileSync(join(root, 'ideas/ready/README.md'), 'utf8')).toBe(
      '# Ready\n',
    )
  })

  it('reports a stale index without writing it when checking', async () => {
    const root = build({
      'ideas/README.md': README,
      'ideas/one.md': doc('one', 'First.'),
    })
    expect(await rewriteIndexes(root, true)).toEqual(['ideas/README.md'])
    expect(readFileSync(join(root, 'ideas/README.md'), 'utf8')).toBe(README)
  })

  it('reports nothing stale once the table is written', async () => {
    const root = build({
      'ideas/README.md': README,
      'ideas/one.md': doc('one', 'First.'),
    })
    await rewriteIndexes(root)
    expect(await rewriteIndexes(root, true)).toEqual([])
  })

  it('names the doc that carries no frontmatter', async () => {
    const root = build({
      'ideas/README.md': README,
      'ideas/bare.md': '# Bare\n',
    })
    await expect(rewriteIndexes(root)).rejects.toThrow('bare.md')
  })
})
