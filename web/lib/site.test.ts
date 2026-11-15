import { expect, test } from 'vitest'

import { JBROWSE, geneHref, href, interfaceExplorerHref } from './site.ts'

test('a gene link lands on the page, or on one isoform section of it', () => {
  expect(geneHref('TP53')).toBe(href('gene/TP53/'))
  expect(geneHref('TP53', 'P04637-2')).toBe(href('gene/TP53/#P04637-2'))
  expect(geneHref('HLA-A_P04439')).toBe(href('gene/HLA-A_P04439/'))
})

test('outside links name our JBrowse config and the sibling gene search', () => {
  expect(JBROWSE).toMatch(/^https:\/\/jbrowse\.org\/code\/jb2\/main\/\?config=/)
  expect(decodeURIComponent(JBROWSE)).toContain(
    `${href('jbrowse/config.json')}`,
  )
  expect(interfaceExplorerHref('TP53')).toBe(
    'https://cmdcolin.github.io/interface-explorer/genes/?q=TP53',
  )
})
