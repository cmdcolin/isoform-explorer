import { expect, test } from 'vitest'

import type { IndexRow } from '../../src/types.ts'
import {
  browseQuery,
  isoformsIn,
  nextSort,
  rowHtml,
  rowsFor,
  searchText,
  viewFrom,
} from './browse.ts'
import { geneHref } from './site.ts'

function row(gene: string, overrides: Partial<IndexRow> = {}): IndexRow {
  return {
    page: gene,
    gene,
    accession: `P${gene}`,
    protein: `${gene} protein`,
    length: 300,
    isoforms: 1,
    withTranscript: 1,
    mostAbsent: 10,
    foldedAbsent: 5,
    lost: { targeting: 0, domains: 0, sites: 0, modifications: 0 },
    interfacesLost: 0,
    ...overrides,
  }
}

const rows = [
  row('AAA', { mostAbsent: 5 }),
  row('BBB', {
    mostAbsent: 50,
    lost: { targeting: 2, domains: 0, sites: 0, modifications: 0 },
  }),
  row('CCC', {
    mostAbsent: 20,
    lost: { targeting: 1, domains: 1, sites: 0, modifications: 0 },
    interfacesLost: 1,
  }),
]
const texts = rows.map(searchText)

test('a plain visit sorts by most residues absent, largest first', () => {
  const view = viewFrom(new URLSearchParams())
  expect(view).toEqual({
    query: '',
    has: '',
    sort: 'absent',
    descending: true,
  })
  expect(rowsFor(rows, texts, view).map(r => r.gene)).toEqual([
    'BBB',
    'CCC',
    'AAA',
  ])
})

test('a tile link keeps proteins with such an isoform, sorted by that count', () => {
  const view = viewFrom(new URLSearchParams('has=targeting'))
  expect(view.sort).toBe('targeting')
  const kept = rowsFor(rows, texts, view)
  expect(kept.map(r => r.gene)).toEqual(['BBB', 'CCC'])
  expect(isoformsIn(kept, 'targeting')).toBe(3)
  expect(isoformsIn(kept, '')).toBe(0)
})

test('unknown filters and sorts fall back to the defaults', () => {
  expect(viewFrom(new URLSearchParams('has=nonsense&sort=nope'))).toEqual(
    viewFrom(new URLSearchParams()),
  )
})

test('the text filter matches gene, accession or protein name, any case', () => {
  const view = viewFrom(new URLSearchParams('q=ccc'))
  expect(rowsFor(rows, texts, view).map(r => r.gene)).toEqual(['CCC'])
  expect(
    rowsFor(rows, texts, { ...view, query: 'pbbb' }).map(r => r.gene),
  ).toEqual(['BBB'])
})

test('sorting a column twice reverses it; text columns start A to Z', () => {
  const byGene = nextSort(viewFrom(new URLSearchParams()), 'gene')
  expect(byGene.descending).toBe(false)
  expect(rowsFor(rows, texts, byGene).map(r => r.gene)).toEqual([
    'AAA',
    'BBB',
    'CCC',
  ])
  expect(nextSort(byGene, 'gene').descending).toBe(true)
})

test('the address names only what differs from the default view', () => {
  expect(browseQuery(viewFrom(new URLSearchParams()))).toBe('')
  expect(browseQuery({ has: 'interface' })).toBe('?has=interface')
  expect(browseQuery({ sort: 'folded' })).toBe('?sort=folded')
  expect(browseQuery({ query: 'kras', sort: 'gene', descending: true })).toBe(
    '?q=kras&sort=gene&order=desc',
  )
  const view = viewFrom(new URLSearchParams('q=x&has=sites&order=asc'))
  expect(viewFrom(new URLSearchParams(browseQuery(view)))).toEqual(view)
})

test('a row links its gene page and leaves folded blank without pLDDT', () => {
  const html = rowHtml(
    row('HLA-A', { page: 'HLA-A_P04439', foldedAbsent: null }),
  )
  expect(html).toContain(`href="${geneHref('HLA-A_P04439')}"`)
  expect(html).toContain('<td class="num"></td>')
})
