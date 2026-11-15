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
  count?: (row: IndexRow) => number
}

const lostColumns = GROUPS.map((group): BrowseColumn => ({
  key: group,
  label: GROUP_LABELS[group],
  num: true,
  cell: row => String(row.lost[group]),
  sort: row => row.lost[group],
  count: row => row.lost[group],
}))

export const COLUMNS: BrowseColumn[] = [
  {
    key: 'gene',
    label: 'Gene',
    cell: row => `<a href="${geneHref(row.page)}">${esc(row.gene)}</a>`,
    sort: row => row.gene,
  },
  {
    key: 'protein',
    label: 'Protein',
    cell: row =>
      `${esc(row.protein)} <span class="muted">${esc(row.accession)}</span>`,
    sort: row => row.protein,
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
    key: 'folded',
    label: 'Folded residues absent',
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
    count: row => row.interfacesLost,
  },
]

export const FILTERS = COLUMNS.filter(column => column.count !== undefined)

export interface View {
  query: string
  has: string
  sort: string
  descending: boolean
}

export const DEFAULT_SORT = 'absent'

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

export function rowsFor(rows: IndexRow[], texts: string[], view: View) {
  const query = view.query.toUpperCase()
  const column = columnOf(view.sort) ?? COLUMNS[0]
  const count = FILTERS.find(f => f.key === view.has)?.count
  const kept = rows.filter(
    (row, index) =>
      (query === '' || (texts[index] ?? '').includes(query)) &&
      (count === undefined || count(row) > 0),
  )
  return column
    ? kept.sort((a, b) => {
        const order = compare(column.sort(a), column.sort(b))
        return (view.descending ? -order : order) || compare(a.gene, b.gene)
      })
    : kept
}

export function isoformsIn(rows: IndexRow[], has: string) {
  const count = FILTERS.find(f => f.key === has)?.count
  return count ? rows.reduce((n, row) => n + count(row), 0) : 0
}

export function rowHtml(row: IndexRow) {
  return `<tr>${COLUMNS.map(
    c => `<td${c.num ? ' class="num"' : ''}>${c.cell(row)}</td>`,
  ).join('')}</tr>`
}
