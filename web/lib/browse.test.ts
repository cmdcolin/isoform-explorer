import { expect, test } from 'vitest'

import type { IndexRow } from '../../src/types.ts'
import {
  browseQuery,
  countLine,
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
    mostMissing: 8,
    foldedMissing: 4,
    lost: { targeting: 0, domains: 0, sites: 0, modifications: 0 },
    interfacesLost: 0,
    ...overrides,
  }
}

const rows = [
  row('AAA', { foldedMissing: 0 }),
  row('BBB', {
    lost: { targeting: 2, domains: 0, sites: 0, modifications: 0 },
  }),
  row('CCC', {
    lost: { targeting: 1, domains: 1, sites: 0, modifications: 0 },
    interfacesLost: 1,
  }),
]
const texts = rows.map(searchText)

test('a plain visit lists proteins by gene symbol, A to Z', () => {
  const view = viewFrom(new URLSearchParams())
  expect(view).toEqual({
    query: '',
    has: '',
    sort: 'gene',
    descending: false,
  })
  expect(rowsFor(rows, texts, view).map(r => r.gene)).toEqual([
    'AAA',
    'BBB',
    'CCC',
  ])
})

test('a has= link keeps proteins with such an isoform, sorted by that count', () => {
  const view = viewFrom(new URLSearchParams('has=targeting'))
  expect(view.sort).toBe('targeting')
  const kept = rowsFor(rows, texts, view)
  expect(kept.map(r => r.gene)).toEqual(['BBB', 'CCC'])
  const modelled = rowsFor(
    rows,
    texts,
    viewFrom(new URLSearchParams('has=modelled')),
  )
  expect(modelled.map(r => r.gene)).toEqual(['BBB', 'CCC'])
})

test('the count line restates the total for a has= filter', () => {
  const phrases = {
    targeting: 'missing a whole thing',
    modelled: 'missing modelled residues',
  }
  const totals = { targeting: 3, modelled: 7 }
  const count = (params: string, shown = rows) =>
    countLine(shown, 3, viewFrom(new URLSearchParams(params)), phrases, totals)
  expect(count('')).toBe('3 of 3 proteins · 3 isoforms, 3 with a transcript')
  expect(count('has=targeting', rows.slice(1))).toBe(
    '2 of 3 proteins · 2 isoforms, 2 with a transcript · 3 missing a whole thing',
  )
  expect(count('has=modelled', rows.slice(1))).toBe(
    '2 of 3 proteins · 2 isoforms, 2 with a transcript · 7 missing modelled residues',
  )
  expect(count('sort=modelled')).toBe(
    '3 of 3 proteins · 3 isoforms, 3 with a transcript · 7 missing modelled residues',
  )
  expect(count('sort=modelled&q=aaa', rows.slice(0, 1))).toBe(
    '1 of 3 proteins · 1 isoforms, 1 with a transcript',
  )
})

test('a filtered list puts the exact symbol first, then symbols starting with it', () => {
  const app = [
    row('APPBP2'),
    row('GOLGA2', { protein: 'Golgi apparatus protein' }),
    row('APP', { protein: 'Amyloid-beta precursor protein' }),
    row('ZAPP', { accession: 'Q00APP' }),
  ]
  const view = viewFrom(new URLSearchParams('q=app'))
  expect(rowsFor(app, app.map(searchText), view).map(r => r.gene)).toEqual([
    'APP',
    'APPBP2',
    'GOLGA2',
    'ZAPP',
  ])
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
  const byGene = nextSort(
    viewFrom(new URLSearchParams('sort=isoforms')),
    'gene',
  )
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
  expect(browseQuery({ sort: 'modelled' })).toBe('?sort=modelled')
  expect(browseQuery({ query: 'kras', sort: 'gene', descending: true })).toBe(
    '?q=kras&order=desc',
  )
  const view = viewFrom(new URLSearchParams('q=x&has=sites&order=asc'))
  expect(viewFrom(new URLSearchParams(browseQuery(view)))).toEqual(view)
})

test('a row links its gene page and leaves the modelled count blank without pLDDT', () => {
  const html = rowHtml(
    row('HLA-A', { page: 'HLA-A_P04439', foldedMissing: null }),
  )
  expect(html).toContain(`href="${geneHref('HLA-A_P04439')}"`)
  expect(html).toContain('<td class="num"></td>')
})
