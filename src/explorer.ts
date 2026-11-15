import { join } from 'node:path'

import { getJson } from './cache.ts'
import { record, records, text } from './json.ts'
import { DATA } from './paths.ts'

const SITE = 'https://cmdcolin.github.io/interface-explorer/data'

export function pagesByAccession(rows: Record<string, unknown>[]) {
  return new Map(
    rows.flatMap(row => {
      const accession = text(row.accession)
      const page = text(row.page)
      return accession && page ? [[accession, page] as const] : []
    }),
  )
}

export async function explorerPages() {
  const genes = await getJson(
    `${SITE}/genes.json`,
    join(DATA, 'explorer_genes.json'),
  )
  const isoforms = await getJson(
    `${SITE}/isoforms.json`,
    join(DATA, 'explorer_isoforms.json'),
  )
  const genePages = pagesByAccession(records(genes))
  const isoformPages = pagesByAccession(records(record(isoforms).genes))
  return (accession: string) => ({
    gene: genePages.get(accession) ?? null,
    isoforms: isoformPages.get(accession) ?? null,
  })
}
