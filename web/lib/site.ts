import { jbrowseUrl } from '../../src/links.ts'

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/')

export const JBROWSE = jbrowseUrl(
  new URL(`${BASE}jbrowse/config.json`, import.meta.env.SITE).href,
)

export const INTERFACE_EXPLORER =
  'https://cmdcolin.github.io/interface-explorer/'

export function href(path = '') {
  return `${BASE}${path}`
}

export function geneHref(page: string, isoform?: string) {
  return href(
    `gene/${encodeURIComponent(page)}/${isoform ? `#${encodeURIComponent(isoform)}` : ''}`,
  )
}

export function interfaceExplorerHref(gene: string) {
  return `${INTERFACE_EXPLORER}genes/?q=${encodeURIComponent(gene)}`
}
