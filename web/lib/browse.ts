import type { IndexRow } from '../../src/types.ts'
import { GROUPS, GROUP_LABELS } from './features.ts'
import { esc } from './html.ts'
import { geneHref } from './site.ts'

export interface BrowseColumn {
  key: string
  label: string
  num?: boolean
  cell: (row: IndexRow) => string
  sort: (row: IndexRow) => string | number
  keep?: (row: IndexRow) => boolean
  isoforms?: (row: IndexRow) => number
}

const lostColumns = GROUPS.map((group): BrowseColumn => ({
  key: group,
  label: GROUP_LABELS[group],
  num: true,
  cell: row => String(row.lost[group]),
  sort: row => row.lost[group],
  keep: row => row.lost[group] > 0,
  isoforms: row => row.lost[group],
}))

export const COLUMNS: BrowseColumn[] = [
  {
    key: 'gene',
    label: 'Gene',
    cell: row =>
      `<a href="${geneHref(row.page)}">${esc(row.gene)}</a><span class="protein">${esc(row.protein)} <span class="muted">${esc(row.accession)}</span></span>`,
    sort: row => row.gene,
  },
  {
    key: 'isoforms',
    label: 'Isoforms',
    num: true,
    cell: row => String(row.isoforms),
    sort: row => row.isoforms,
  },
  {
    key: 'transcripts',
    label: 'With a transcript',
    num: true,
    cell: row => String(row.withTranscript),
    sort: row => row.withTranscript,
  },
  {
    key: 'absent',
    label: 'Most residues absent',
    num: true,
    cell: row => `${row.mostAbsent} <span class="muted">/ ${row.length}</span>`,
    sort: row => row.mostAbsent,
  },
  {
    key: 'modelled',
    label: 'Confidently modelled residues absent',
    num: true,
    cell: row => (row.foldedAbsent === null ? '' : String(row.foldedAbsent)),
    sort: row => row.foldedAbsent ?? -1,
  },
  ...lostColumns,
  {
    key: 'interface',
    label: 'Partner interface',
    num: true,
    cell: row => String(row.interfacesLost),
    sort: row => row.interfacesLost,
    keep: row => row.interfacesLost > 0,
    isoforms: row => row.interfacesLost,
  },
]

export const FILTERS = COLUMNS.filter(column => column.keep !== undefined)

export interface View {
  query: string
  has: string
  sort: string
  descending: boolean
}

export const DEFAULT_SORT = 'gene'

function columnOf(key: string) {
  return COLUMNS.find(c => c.key === key)
}

function defaultSort(has: string) {
  return has || DEFAULT_SORT
}

function defaultDescending(sort: string) {
  return columnOf(sort)?.num === true
}

export function viewFrom(params: URLSearchParams): View {
  const has = FILTERS.find(f => f.key === params.get('has'))?.key ?? ''
  const sort = columnOf(params.get('sort') ?? '')?.key ?? defaultSort(has)
  const order = params.get('order')
  return {
    query: params.get('q')?.trim() ?? '',
    has,
    sort,
    descending:
      order === 'asc'
        ? false
        : order === 'desc'
          ? true
          : defaultDescending(sort),
  }
}

export function browseQuery({
  query = '',
  has = '',
  sort,
  descending,
}: Partial<View>) {
  const sorted = sort ?? defaultSort(has)
  const params = new URLSearchParams(
    [
      ['q', query],
      ['has', has],
      ['sort', sorted === defaultSort(has) ? '' : sorted],
      [
        'order',
        descending === undefined || descending === defaultDescending(sorted)
          ? ''
          : descending
            ? 'desc'
            : 'asc',
      ],
    ].filter(([, value]) => value !== ''),
  )
  const search = params.toString()
  return search === '' ? '' : `?${search}`
}

export function nextSort(view: View, key: string) {
  return {
    ...view,
    sort: key,
    descending: key === view.sort ? !view.descending : defaultDescending(key),
  }
}

export function searchText(row: IndexRow) {
  return `${row.gene} ${row.accession} ${row.protein}`.toUpperCase()
}

function compare(a: string | number, b: string | number) {
  return a < b ? -1 : a > b ? 1 : 0
}

function rank(row: IndexRow, query: string) {
  const gene = row.gene.toUpperCase()
  return query === '' || gene === query || row.accession === query
    ? 0
    : gene.startsWith(query)
      ? 1
      : 2
}

export function rowsFor(rows: IndexRow[], texts: string[], view: View) {
  const query = view.query.toUpperCase()
  const column = columnOf(view.sort) ?? COLUMNS[0]
  const keep = columnOf(view.has)?.keep
  const kept = rows.filter(
    (row, index) =>
      (query === '' || (texts[index] ?? '').includes(query)) &&
      (keep === undefined || keep(row)),
  )
  return column
    ? kept.sort((a, b) => {
        const order = compare(column.sort(a), column.sort(b))
        return (
          rank(a, query) - rank(b, query) ||
          (view.descending ? -order : order) ||
          compare(a.gene, b.gene)
        )
      })
    : kept
}

export function sumOf(rows: IndexRow[], count: (row: IndexRow) => number) {
  return rows.reduce((n, row) => n + count(row), 0)
}

export function countLine(
  shown: IndexRow[],
  all: number,
  view: View,
  phrases: Record<string, string>,
  totals: Record<string, number>,
) {
  const n = (value: number) => value.toLocaleString('en-US')
  const key = view.has || view.sort
  const isoforms = columnOf(key)?.isoforms
  const total = view.query === '' ? totals[key] : undefined
  const lacking = isoforms ? sumOf(shown, isoforms) : total
  return [
    `${n(shown.length)} of ${n(all)} proteins`,
    `${n(sumOf(shown, row => row.isoforms))} isoforms, ${n(sumOf(shown, row => row.withTranscript))} with a transcript`,
    ...(lacking !== undefined && phrases[key]
      ? [`${n(lacking)} ${phrases[key]}`]
      : []),
  ].join(' · ')
}

export function rowHtml(row: IndexRow) {
  return `<tr>${COLUMNS.map(
    c => `<td${c.num ? ' class="num"' : ''}>${c.cell(row)}</td>`,
  ).join('')}</tr>`
}
