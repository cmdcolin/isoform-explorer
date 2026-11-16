import { transcriptsUrl } from '../../src/links.ts'
import { gene } from './data.ts'
import { diseasesOfPage } from './diseases.ts'
import { answer } from './loss.ts'
import { JBROWSE, geneHref } from './site.ts'

export function story(page: string, accession: string) {
  const record = gene(page)
  const isoform = record.isoforms.find(i => i.accession === accession)
  if (!isoform) {
    throw new Error(`${page} has no isoform ${accession}`)
  }
  return {
    record,
    isoform,
    answer: answer(record, isoform),
    href: geneHref(page, accession),
    genome: transcriptsUrl(record.locus ?? record.gene, JBROWSE),
    diseases: diseasesOfPage(page),
  }
}
