import type { Lookup } from '../../src/types.ts'
import { esc } from '../lib/html.ts'
import {
  dataPath,
  lookupsFor,
  outcome,
  parseQuery,
  suggestions,
} from '../lib/search.ts'
import type { Choice, Source } from '../lib/search.ts'
import { href } from '../lib/site.ts'

const loading = new Map<Source, Promise<Lookup>>()

function isLookup(value: unknown): value is Lookup {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function load(source: Source) {
  const pending =
    loading.get(source) ??
    fetch(href(dataPath(source)))
      .then(response => (response.ok ? response.json() : undefined))
      .then((value: unknown) =>
        isLookup(value) ? value : Promise.reject(new Error(source)),
      )
  loading.set(source, pending)
  pending.catch(() => loading.delete(source))
  return pending
}

function namesOf(form: HTMLFormElement) {
  const value: unknown = JSON.parse(form.dataset.names ?? '{}')
  return new Map(
    isLookup(value)
      ? Object.entries(value).flatMap(([page, name]) =>
          typeof name === 'string' ? [[page, name]] : [],
        )
      : [],
  )
}

function choiceHtml(choice: Choice, names: Map<string, string>) {
  const page = choice.accession
    ? `${choice.gene}_${choice.accession}`
    : choice.gene
  const detail = [
    choice.isoform ? `isoform ${choice.isoform}` : choice.accession,
    names.get(page),
  ].filter(Boolean)
  return `<li><a href="${esc(choice.href)}">${esc(choice.gene)}</a>${
    detail.length
      ? ` <span class="muted">${esc(detail.join(' · '))}</span>`
      : ''
  }</li>`
}

function listHtml(choices: Choice[], names: Map<string, string>) {
  return choices.length
    ? `<ul>${choices.map(c => choiceHtml(c, names)).join('')}</ul>`
    : ''
}

function wire(form: HTMLFormElement) {
  const input = form.querySelector<HTMLInputElement>('input[type="search"]')
  const results = form.querySelector<HTMLElement>('.search-results')
  const names = namesOf(form)
  const about = form.dataset.about ?? href('about/')
  let latest = 0

  const show = (html: string) => {
    if (results) {
      results.innerHTML = html
    }
  }

  const failed = () =>
    show(
      '<p>The search index did not load. Check the connection and try again.</p>',
    )

  const suggest = async (value: string) => {
    const ticket = (latest += 1)
    const query = parseQuery(value)
    if (query.kind === 'gene') {
      const genes = await load('genes').catch(() => undefined)
      if (ticket === latest && genes) {
        const found = suggestions(value, genes)
        show(
          found.length
            ? `<p class="muted">Gene symbols starting ${esc(query.key)}</p>${listHtml(found, names)}`
            : '',
        )
      }
    } else {
      show(
        query.kind === 'empty'
          ? ''
          : `<p class="muted">Press Enter to look up ${esc(query.key)}.</p>`,
      )
    }
  }

  const lookUp = async () => {
    const ticket = (latest += 1)
    const value = input?.value ?? ''
    const query = parseQuery(value)
    show('sources' in query ? '<p class="muted">Looking up…</p>' : '')
    const lookups = await lookupsFor(query, load).catch(() => undefined)
    if (ticket === latest) {
      if (lookups) {
        const result = outcome(query, lookups)
        const nearby =
          result.kind === 'miss' && query.kind === 'gene' && lookups.genes
            ? suggestions(value, lookups.genes)
            : []
        if (result.kind === 'go') {
          location.assign(result.href)
          show('')
        } else {
          show(
            result.kind === 'choose'
              ? `<p>${esc(result.intro)}</p>${listHtml(result.choices, names)}`
              : result.kind === 'miss'
                ? `<p>${esc(result.reason)} <a href="${esc(about)}">About</a> says what is covered.</p>${
                    nearby.length
                      ? `<p class="muted">Gene symbols starting ${esc(query.kind === 'gene' ? query.key : '')}</p>${listHtml(nearby, names)}`
                      : ''
                  }`
                : '',
          )
        }
      } else {
        failed()
      }
    }
  }

  const links = () => [
    ...(results?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? []),
  ]

  form.addEventListener('submit', event => {
    event.preventDefault()
    void lookUp()
  })
  input?.addEventListener('input', () => void suggest(input.value))
  form.addEventListener('keydown', event => {
    const all = links()
    const at = all.findIndex(link => link === document.activeElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const next =
        event.key === 'ArrowDown'
          ? all[Math.min(at + 1, all.length - 1)]
          : at <= 0
            ? input
            : all[at - 1]
      if (next) {
        event.preventDefault()
        next.focus()
      }
    } else if (event.key === 'Escape') {
      show('')
      input?.focus()
    }
  })
  form.addEventListener('focusout', event => {
    if (!(
      event.relatedTarget instanceof Node && form.contains(event.relatedTarget)
    )) {
      show('')
    }
  })
  for (const example of document.querySelectorAll<HTMLButtonElement>(
    `[data-search-example="${input?.id ?? ''}"]`,
  )) {
    example.addEventListener('click', () => {
      if (input) {
        input.value = example.textContent ?? ''
        void lookUp()
      }
    })
  }
}

document.querySelectorAll<HTMLFormElement>('form.search').forEach(wire)
