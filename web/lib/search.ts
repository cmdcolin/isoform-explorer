import { SEARCH } from '../../src/types.ts'
import type { DiseaseEntry, Lookup } from '../../src/types.ts'
import { geneHref, href } from './site.ts'

export type Source = keyof typeof SEARCH
export type Lookups = Partial<Record<Source, Lookup>>

const ACCESSION =
  /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})(?:-\d+)?$/
const ENSEMBL = /^ENST\d+$/
const ENSEMBL_GENE = /^ENSG\d+$/
const REFSEQ = /^(?:NM|NR|XM|XR)_\d+$/
const REFSEQ_PROTEIN = /^(?:NP|XP)_\d+$/
const OTHER_IDS: [RegExp, string][] = [[/^ENSP\d+$/, 'an Ensembl protein id']]

export type Query =
  | { kind: 'empty' }
  | {
      kind: 'transcript' | 'protein' | 'ensemblGene' | 'accession' | 'gene'
      key: string
      sources: Source[]
    }
  | { kind: 'other'; key: string; what: string }

export function parseQuery(raw: string): Query {
  const text = raw.trim().toUpperCase()
  const key = text.replace(/\.\d+$/, '')
  const other = OTHER_IDS.find(([pattern]) => pattern.test(key))
  return text === ''
    ? { kind: 'empty' }
    : ENSEMBL.test(key)
      ? { kind: 'transcript', key, sources: ['ensembl'] }
      : ENSEMBL_GENE.test(key)
        ? { kind: 'ensemblGene', key, sources: ['ensembl'] }
        : REFSEQ.test(key)
          ? { kind: 'transcript', key, sources: ['refseq'] }
          : REFSEQ_PROTEIN.test(key)
            ? { kind: 'protein', key, sources: ['refseq'] }
            : other
              ? { kind: 'other', key, what: other[1] }
              : ACCESSION.test(key)
                ? { kind: 'accession', key, sources: ['accessions', 'genes'] }
                : { kind: 'gene', key: text, sources: ['genes'] }
}

export function dataPath(source: Source) {
  return `data/${SEARCH[source]}`
}

export interface Choice {
  href: string
  gene: string
  accession: string | undefined
  isoform: string | undefined
}

export function choiceOf(target: string): Choice {
  const [page = '', isoform] = target.split('#')
  const [gene = page, accession] = page.split('_')
  return { href: geneHref(page, isoform), gene, accession, isoform }
}

export type Outcome =
  | { kind: 'none' }
  | { kind: 'go'; href: string }
  | { kind: 'choose'; intro: string; choices: Choice[] }
  | { kind: 'miss'; reason: string }

function entryOf(accession: string) {
  return accession.replace(/-\d+$/, '')
}

function missReason(query: Query) {
  return query.kind === 'transcript' || query.kind === 'protein'
    ? `UniProt does not list ${query.key} under any protein on this site, so it is not here. The site covers only isoforms UniProt describes; a novel or unmapped ${query.kind} has no page.`
    : query.kind === 'ensemblGene'
      ? `UniProt does not list the Ensembl gene ${query.key} under any protein on this site. The site covers reviewed human proteins with at least one alternative isoform described in UniProt.`
      : query.kind === 'accession'
        ? `${query.key} is not a reviewed human UniProt entry with a described alternative isoform, nor an isoform of one.`
        : query.kind === 'gene'
          ? `No protein on this site has the gene symbol ${query.key}. The site covers reviewed human proteins with at least one alternative isoform described in UniProt.`
          : query.kind === 'other'
            ? `${query.key} looks like ${query.what}. Search by its gene symbol, a UniProt accession, an Ensembl transcript or gene (ENST, ENSG), or a RefSeq transcript or protein (NM, NP).`
            : ''
}

export function outcome(query: Query, lookups: Lookups): Outcome {
  const hit =
    query.kind === 'empty' || query.kind === 'other'
      ? undefined
      : query.sources
          .map(source => lookups[source]?.[query.key])
          .find(targets => targets !== undefined && targets.length > 0)
  const entry =
    query.kind === 'accession' && query.key !== entryOf(query.key)
      ? lookups.accessions?.[entryOf(query.key)]
      : undefined
  const untied =
    (query.kind === 'transcript' || query.kind === 'protein') &&
    hit !== undefined &&
    hit.every(target => !target.includes('#'))
  return query.kind === 'empty'
    ? { kind: 'none' }
    : untied
      ? {
          kind: 'choose',
          intro: `UniProt lists ${query.key} under ${hit.map(t => choiceOf(t).gene).join(' and ')} but ties it to no described isoform.`,
          choices: hit.map(choiceOf),
        }
      : hit?.length === 1 && hit[0] !== undefined
        ? { kind: 'go', href: choiceOf(hit[0]).href }
        : hit
          ? {
              kind: 'choose',
              intro:
                query.kind === 'transcript' || query.kind === 'protein'
                  ? `UniProt maps ${query.key} to ${hit.length} isoforms:`
                  : `${hit.length} proteins match ${query.key}:`,
              choices: hit.map(choiceOf),
            }
          : entry
            ? {
                kind: 'choose',
                intro: `${entryOf(query.key)} has no isoform ${query.key}. Its page:`,
                choices: entry.map(choiceOf),
              }
            : { kind: 'miss', reason: missReason(query) }
}

export function suggestions(raw: string, genes: Lookup, limit = 8) {
  const prefix = raw.trim().toUpperCase()
  return prefix === ''
    ? []
    : Object.keys(genes)
        .filter(symbol => symbol.startsWith(prefix))
        .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
        .flatMap(symbol => genes[symbol] ?? [])
        .slice(0, limit)
        .map(choiceOf)
}

export async function lookupsFor(
  query: Query,
  load: (source: Source) => Promise<Lookup>,
) {
  const key = 'key' in query ? query.key : ''
  const lookups: Lookups = {}
  for (const source of 'sources' in query ? query.sources : []) {
    if (!Object.values(lookups).some(lookup => key in lookup)) {
      lookups[source] = await load(source)
    }
  }
  return lookups
}

export interface DiseaseChoice {
  href: string
  name: string
  genes: string
}

function wordsOf(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export function diseaseMatches(
  raw: string,
  entries: DiseaseEntry[],
  limit = 8,
) {
  const query = wordsOf(raw)
  const whole = raw.trim().toLowerCase()
  return query.length === 0
    ? []
    : entries
        .filter(([name, acronym, , genes]) => {
          const words = wordsOf(`${name} ${acronym} ${genes}`)
          return query.every(q => words.some(word => word.startsWith(q)))
        })
        .toSorted(
          ([a], [b]) =>
            Number(!a.toLowerCase().startsWith(whole)) -
              Number(!b.toLowerCase().startsWith(whole)) ||
            a.length - b.length ||
            a.localeCompare(b),
        )
        .slice(0, limit)
        .map(([name, , slug, genes]): DiseaseChoice => ({
          href: href(`disease/${slug}/`),
          name,
          genes,
        }))
}
