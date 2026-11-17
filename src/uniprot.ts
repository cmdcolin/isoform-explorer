import { join } from 'node:path'

import { getJson } from './cache.ts'
import { isRecord, list, number, record, records, text } from './json.ts'
import { DATA } from './paths.ts'
import { FEATURE_GROUPS } from './types.ts'
import type { Feature, FeatureType, Note } from './types.ts'

export type UniProtEntry = Record<string, unknown>

const HUMAN = 'organism_id:9606 AND reviewed:true'

const ENTRY_FIELDS = [
  'accession',
  'gene_primary',
  'protein_name',
  'sequence',
  'cc_alternative_products',
  'cc_miscellaneous',
  'cc_function',
  'cc_subunit',
  'cc_domain',
  'cc_caution',
  'ft_var_seq',
  'xref_refseq',
  'xref_ensembl',
  'xref_mane-select',
  'ft_chain',
  'ft_peptide',
  'ft_signal',
  'ft_transit',
  'ft_propep',
  'ft_transmem',
  'ft_intramem',
  'ft_topo_dom',
  'ft_domain',
  'ft_repeat',
  'ft_zn_fing',
  'ft_dna_bind',
  'ft_coiled',
  'ft_region',
  'ft_motif',
  'ft_act_site',
  'ft_binding',
  'ft_site',
  'ft_mod_res',
  'ft_lipid',
  'ft_carbohyd',
  'ft_disulfid',
  'ft_crosslnk',
].join(',')

const FEATURE_TYPES: readonly FeatureType[] =
  Object.values(FEATURE_GROUPS).flat()

export const BONDS: readonly FeatureType[] = ['Disulfide bond', 'Cross-link']

export function withoutEvidence(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map(withoutEvidence)
    : isRecord(value)
      ? Object.fromEntries(
          Object.entries(value)
            .filter(
              ([key]) =>
                key !== 'evidences' && key !== 'featureCrossReferences',
            )
            .map(([key, inner]) => [key, withoutEvidence(inner)]),
        )
      : value
}

async function stream(query: string, fields: string, path: string) {
  const results = await getJson(
    'https://rest.uniprot.org/uniprotkb/stream',
    path,
    { query, fields, format: 'json' },
    withoutEvidence,
  )
  return records(record(results).results)
}

export function isoformEntries() {
  return stream(
    `${HUMAN} AND cc_ap:*`,
    ENTRY_FIELDS,
    join(DATA, 'uniprot_isoforms.json'),
  )
}

export function diseaseEntries() {
  return stream(
    `${HUMAN} AND cc_disease:*`,
    'accession,cc_disease',
    join(DATA, 'uniprot_diseases.json'),
  )
}

export function accessionOf(entry: UniProtEntry) {
  return text(entry.primaryAccession) ?? ''
}

export function geneOf(entry: UniProtEntry) {
  return text(record(record(records(entry.genes)[0]).geneName).value) ?? ''
}

export function sequenceOf(entry: UniProtEntry) {
  return text(record(entry.sequence).value) ?? ''
}

export function proteinOf(entry: UniProtEntry) {
  const description = record(entry.proteinDescription)
  const name = (value: unknown) => text(record(record(value).fullName).value)
  return (
    name(description.recommendedName) ??
    name(records(description.submissionNames)[0]) ??
    ''
  )
}

function featureType(value: unknown) {
  return FEATURE_TYPES.find(type => type === value)
}

function isDropped(type: FeatureType, description: string) {
  return type === 'Region' && description === 'Disordered'
}

function position(location: Record<string, unknown>, end: 'start' | 'end') {
  return number(record(location[end]).value)
}

const PRODUCTS: readonly FeatureType[] = ['Chain', 'Peptide']

const span = (feature: Feature) => feature.end - feature.start + 1

export function withoutWholeChains(features: Feature[]) {
  const products = features.filter(f => PRODUCTS.includes(f.type))
  const longest = Math.max(0, ...products.map(span))
  return features.filter(feature =>
    feature.type === 'Chain'
      ? products.length > 1 && span(feature) < longest
      : true,
  )
}

export function featuresOf(entry: UniProtEntry) {
  const features = records(entry.features)
    .flatMap(feature => {
      const type = featureType(feature.type)
      const location = record(feature.location)
      const start = position(location, 'start')
      const end = position(location, 'end')
      const description =
        text(feature.description) || text(record(feature.ligand).name) || ''
      const bond = type !== undefined && BONDS.includes(type)
      const first = start ?? (bond ? end : undefined)
      const last = end ?? (bond ? start : undefined)
      return type &&
        first !== undefined &&
        last !== undefined &&
        !isDropped(type, description)
        ? [{ type, start: first, end: last, description } satisfies Feature]
        : []
    })
    .sort(
      (a, b) =>
        a.start - b.start ||
        a.end - b.end ||
        FEATURE_TYPES.indexOf(a.type) - FEATURE_TYPES.indexOf(b.type),
    )
  return withoutWholeChains(features)
}

const NOTE_TOPICS: Record<string, string> = {
  MISCELLANEOUS: 'Miscellaneous',
  FUNCTION: 'Function',
  SUBUNIT: 'Subunit',
  DOMAIN: 'Domain',
  CAUTION: 'Caution',
}

export function notesByMolecule(entry: UniProtEntry) {
  const notes = new Map<string, Note[]>()
  for (const comment of records(entry.comments)) {
    const molecule = text(comment.molecule)
    const topic = NOTE_TOPICS[text(comment.commentType) ?? '']
    const note = records(comment.texts)
      .flatMap(t => text(t.value) ?? [])
      .join(' ')
    if (molecule && topic && note) {
      notes.set(molecule, [
        ...(notes.get(molecule) ?? []),
        { topic, text: note },
      ])
    }
  }
  return notes
}

/**
 * UniProt's SUBUNIT comments that name no isoform, verbatim and in the entry's
 * order. They are about the entry, so they belong nowhere near a single
 * isoform's section; `notesByMolecule` keeps the ones that do name an isoform
 * and these would otherwise be dropped. Nothing is filtered, including the
 * "(Microbial infection)" paragraphs some entries carry.
 */
export function subunitNotes(entry: UniProtEntry) {
  return records(entry.comments).flatMap((comment): Note[] => {
    const note = records(comment.texts)
      .flatMap(t => text(t.value) ?? [])
      .join(' ')
    return comment.commentType === 'SUBUNIT' && !text(comment.molecule) && note
      ? [{ topic: 'Subunit', text: note }]
      : []
  })
}

export function eventsOf(entry: UniProtEntry) {
  const comment = records(entry.comments).find(
    c => c.commentType === 'ALTERNATIVE PRODUCTS',
  )
  return list(comment?.events).flatMap(event => text(event) ?? [])
}
