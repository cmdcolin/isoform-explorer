import type { IndexRow } from '../../src/types.ts'
import {
  browseQuery,
  isoformsIn,
  nextSort,
  rowHtml,
  rowsFor,
  searchText,
  viewFrom,
} from '../lib/browse.ts'
import type { View } from '../lib/browse.ts'

const PAGE = 100

function isRow(value: unknown): value is IndexRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    'page' in value &&
    typeof value.page === 'string' &&
    'gene' in value &&
    typeof value.gene === 'string' &&
    'lost' in value &&
    typeof value.lost === 'object' &&
    'mostAbsent' in value &&
    typeof value.mostAbsent === 'number'
  )
}

async function loadRows(url: string) {
  const response = await fetch(url)
  const value: unknown = response.ok ? await response.json() : []
  return Array.isArray(value) ? value.filter(isRow) : []
}

function wire(form: HTMLFormElement, table: HTMLTableElement) {
  const input = form.querySelector<HTMLInputElement>('input[name="q"]')
  const select = form.querySelector<HTMLSelectElement>('select[name="has"]')
  const count = form.querySelector('[data-count]')
  const body = table.tBodies[0]
  const more = document.querySelector<HTMLButtonElement>('.browse-more button')
  const headers = [...table.querySelectorAll<HTMLElement>('th[data-key]')]
  let view = viewFrom(new URLSearchParams(location.search))
  let rows: IndexRow[] = []
  let texts: string[] = []
  let shown: IndexRow[] = []
  let limit = PAGE

  const describe = () => {
    const proteins = `${shown.length.toLocaleString()} of ${rows.length.toLocaleString()} proteins`
    return view.has
      ? `${proteins}, ${isoformsIn(shown, view.has).toLocaleString()} isoforms`
      : proteins
  }

  const draw = () => {
    if (body) {
      body.innerHTML = shown.slice(0, limit).map(rowHtml).join('')
    }
    if (count) {
      count.textContent = describe()
    }
    if (more) {
      const left = shown.length - limit
      more.hidden = left <= 0
      more.textContent = `Show ${Math.min(left, PAGE)} more of ${left.toLocaleString()}`
    }
    for (const header of headers) {
      header.setAttribute(
        'aria-sort',
        header.dataset.key === view.sort
          ? view.descending
            ? 'descending'
            : 'ascending'
          : 'none',
      )
    }
  }

  const show = (next: View) => {
    view = next
    limit = PAGE
    shown = rowsFor(rows, texts, view)
    history.replaceState(null, '', `${location.pathname}${browseQuery(view)}`)
    draw()
  }

  if (input) {
    input.value = view.query
    input.addEventListener('input', () => show({ ...view, query: input.value }))
  }
  if (select) {
    select.value = view.has
    select.addEventListener('change', () =>
      show(
        select.value
          ? { ...view, has: select.value, sort: select.value, descending: true }
          : { ...view, has: '' },
      ),
    )
  }
  form.addEventListener('submit', event => event.preventDefault())
  for (const header of headers) {
    header
      .querySelector('button')
      ?.addEventListener('click', () =>
        show(nextSort(view, header.dataset.key ?? '')),
      )
  }
  more?.addEventListener('click', () => {
    limit += PAGE
    draw()
  })

  loadRows(form.dataset.index ?? '').then(
    loaded => {
      rows = loaded
      texts = rows.map(searchText)
      show(view)
    },
    () => {
      if (count) {
        count.textContent =
          'The protein list did not load. Reload to try again.'
      }
    },
  )
}

const form = document.querySelector<HTMLFormElement>('.browse-toolbar')
const table = document.querySelector<HTMLTableElement>('table.browse')
if (form && table) {
  wire(form, table)
}
