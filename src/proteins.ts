import { join } from 'node:path'

import { getJson } from './cache.ts'
import { record, records, text } from './json.ts'
import { DATA } from './paths.ts'

export type Protein = Record<string, unknown>

const REVIEWED_HUMAN = 'organism_id:9606 AND reviewed:true'
const FIELDS = 'accession,gene_primary,sequence,cc_alternative_products'

export async function reviewedHuman() {
  const stream = await getJson(
    'https://rest.uniprot.org/uniprotkb/stream',
    join(DATA, 'uniprot_reviewed_human.json'),
    { query: REVIEWED_HUMAN, fields: FIELDS, format: 'json' },
  )
  return records(record(stream).results)
}

export function accessionOf(protein: Protein) {
  return text(protein.primaryAccession) ?? ''
}

export function geneOf(protein: Protein) {
  return text(record(record(records(protein.genes)[0]).geneName).value) ?? ''
}

export function checksumOf(protein: Protein) {
  return (text(record(protein.sequence).md5) ?? '').toUpperCase()
}

export function hasAlternativeIsoform(protein: Protein) {
  return records(protein.comments)
    .filter(comment => comment.commentType === 'ALTERNATIVE PRODUCTS')
    .flatMap(comment => records(comment.isoforms))
    .some(isoform => isoform.isoformSequenceStatus !== 'Displayed')
}
