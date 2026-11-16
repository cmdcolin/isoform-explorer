import { join } from 'node:path'

import { getText } from './cache.ts'
import { DATA } from './paths.ts'
import { SYSTEMS } from './types.ts'

const MONDO_URL = 'https://purl.obolibrary.org/obo/mondo.obo'

export interface Term {
  name: string
  parents: string[]
  omim: string[]
}

function crossReference(id: string) {
  return id.startsWith('OMIMPS:')
    ? `PS${id.slice('OMIMPS:'.length)}`
    : id.startsWith('OMIM:')
      ? id.slice('OMIM:'.length)
      : undefined
}

export function parseObo(obo: string) {
  const terms = new Map<string, Term>()
  for (const stanza of obo.split('\n\n')) {
    const lines = stanza.trim().split('\n')
    const values = (tag: string) =>
      lines.flatMap(line =>
        line.startsWith(`${tag}: `)
          ? [line.slice(tag.length + 2).split(' ')[0] ?? '']
          : [],
      )
    const id = values('id')[0]
    const name = lines.find(line => line.startsWith('name: '))?.slice(6)
    if (
      lines[0] === '[Term]' &&
      id?.startsWith('MONDO:') &&
      name !== undefined &&
      !lines.includes('is_obsolete: true')
    ) {
      terms.set(id, {
        name,
        parents: values('is_a').filter(p => p.startsWith('MONDO:')),
        omim: values('xref').flatMap(x => crossReference(x) ?? []),
      })
    }
  }
  return terms
}

export function classifier(terms: Map<string, Term>) {
  const byOmim = new Map<string, string[]>()
  for (const [id, term] of terms) {
    for (const omim of term.omim) {
      byOmim.set(omim, [...(byOmim.get(omim) ?? []), id])
    }
  }
  const ancestry = new Map<string, Set<string>>()
  const ancestors = (id: string): Set<string> => {
    const known = ancestry.get(id)
    if (known) {
      return known
    }
    const found = new Set<string>()
    ancestry.set(id, found)
    for (const parent of terms.get(id)?.parents ?? []) {
      found.add(parent)
      for (const above of ancestors(parent)) {
        found.add(above)
      }
    }
    return found
  }
  const isSeries = (id: string) =>
    terms.get(id)?.omim.some(x => x.startsWith('PS')) ?? false
  return (omim: string) => {
    const ids = omim ? (byOmim.get(omim) ?? []).filter(id => !isSeries(id)) : []
    const above = new Set(ids.flatMap(id => [id, ...ancestors(id)]))
    const series = ids
      .flatMap(id => terms.get(id)?.parents.filter(isSeries) ?? [])
      .map(id => ({
        id: terms.get(id)?.omim.find(x => x.startsWith('PS')) ?? '',
        name: terms.get(id)?.name ?? '',
      }))[0]
    return {
      systems: SYSTEMS.filter(s => s.mondo.some(m => above.has(m))).map(
        s => s.key,
      ),
      series: series ?? null,
    }
  }
}

export async function readClassifier() {
  return classifier(
    parseObo(await getText(MONDO_URL, join(DATA, 'mondo.obo.gz'))),
  )
}
