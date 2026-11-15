import { describe, expect, test } from 'vitest'

import { internalTargets, targetFile } from './checkLinks.ts'

describe('checkLinks', () => {
  test('resolves relative and absolute links against the page, skipping external ones', () => {
    const html = `
      <a href="../../browse/?q=TP53">a</a>
      <a href="/isoform-explorer/gene/TP53/#P04637-2">b</a>
      <img src="/isoform-explorer/logo.svg" />
      <a href="https://www.uniprot.org/">c</a>
      <a href="https://cmdcolin.github.io/interface-explorer/genes/?q=TP53">d</a>
      <a href="#P04637-2">e</a>`
    expect(
      internalTargets(html, 'gene/TP53/index.html').map(t => t.path),
    ).toEqual([
      '/isoform-explorer/browse/',
      '/isoform-explorer/gene/TP53/',
      '/isoform-explorer/logo.svg',
    ])
  })

  test('maps a path to its file in the build, or to nothing outside the base', () => {
    expect(targetFile('dist', '/isoform-explorer/gene/TP53/')).toBe(
      'dist/gene/TP53/index.html',
    )
    expect(targetFile('dist', '/isoform-explorer/logo.svg')).toBe(
      'dist/logo.svg',
    )
    expect(targetFile('dist', '/interface-explorer/genes/')).toBeUndefined()
  })
})
