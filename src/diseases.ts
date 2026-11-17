import { join } from 'node:path'

import { list, readJson, record, records, text, writeJson } from './json.ts'
import { readClassifier } from './mondo.ts'
import { SITE_DATA } from './paths.ts'
import { DISEASE_SEARCH } from './types.ts'
import type { Disease, DiseaseEntry, IndexRow } from './types.ts'
import { type UniProtEntry, accessionOf, diseaseEntries } from './uniprot.ts'

export function slugOf(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

type Classify = (omim: string) => Pick<Disease, 'systems' | 'series'>

export function diseasesOf(
  entries: UniProtEntry[],
  rows: Pick<IndexRow, 'page' | 'gene' | 'accession'>[],
  classify: Classify = () => ({ systems: [], series: null }),
) {
  const byAccession = new Map(rows.map(row => [row.accession, row]))
  const found = new Map<string, Disease>()
  for (const entry of entries) {
    const row = byAccession.get(accessionOf(entry))
    for (const comment of records(entry.comments)) {
      const disease = record(comment.disease)
      const id = text(disease.diseaseAccession)
      const name = text(disease.diseaseId)
      if (row && id && name && text(comment.commentType) === 'DISEASE') {
        const reference = record(disease.diseaseCrossReference)
        const note = records(record(comment.note).texts)
          .map(t => text(t.value) ?? '')
          .join(' ')
        const known = found.get(id) ?? {
          id,
          slug: '',
          name,
          acronym: text(disease.acronym) ?? '',
          description: text(disease.description) ?? '',
          omim:
            text(reference.database) === 'MIM'
              ? (text(reference.id) ?? '')
              : '',
          genes: [],
          systems: [],
          series: null,
        }
        known.genes.push({ page: row.page, gene: row.gene, note })
        found.set(id, known)
      }
    }
  }
  const sorted = [...found.values()].toSorted((a, b) =>
    a.name.localeCompare(b.name),
  )
  const counts = new Map<string, number>()
  for (const disease of sorted) {
    const slug = slugOf(disease.name)
    counts.set(slug, (counts.get(slug) ?? 0) + 1)
  }
  return sorted.map(disease => {
    const slug = slugOf(disease.name)
    return {
      ...disease,
      slug:
        (counts.get(slug) ?? 0) > 1
          ? `${slug}-${disease.id.toLowerCase()}`
          : slug,
      genes: disease.genes.toSorted((a, b) => a.gene.localeCompare(b.gene)),
      ...classify(disease.omim),
    }
  })
}

/**
 * A gene symbol, with the accession where two UniProt entries share the
 * symbol: those pages are identified as `SYMBOL_ACCESSION`.
 */
export function geneName({ page, gene }: { page: string; gene: string }) {
  return page.startsWith(`${gene}_`)
    ? `${gene} (${page.slice(gene.length + 1)})`
    : gene
}

export function searchEntries(diseases: Disease[]) {
  return diseases.map((d): DiseaseEntry => [
    d.name,
    d.acronym,
    d.slug,
    d.genes.map(geneName).join(' '),
  ])
}

if (import.meta.main) {
  const rows = list(readJson(join(SITE_DATA, 'index.json')))
    .map(record)
    .map(row => ({
      page: text(row.page) ?? '',
      gene: text(row.gene) ?? '',
      accession: text(row.accession) ?? '',
    }))
  const diseases = diseasesOf(
    await diseaseEntries(),
    rows,
    await readClassifier(),
  )
  writeJson(join(SITE_DATA, 'diseases.json'), diseases)
  writeJson(join(SITE_DATA, DISEASE_SEARCH), searchEntries(diseases))
  console.log(
    `${diseases.filter(d => d.systems.length).length} with a group, ${diseases.filter(d => d.series).length} in an OMIM series`,
  )
  console.log(
    `${diseases.length} diseases over ${new Set(diseases.flatMap(d => d.genes.map(g => g.page))).size} proteins`,
  )
}
