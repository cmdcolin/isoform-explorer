import type { Example, Feature, GeneRecord, Isoform } from '../../src/types.ts'
import { residueCount } from './html.ts'

type Losses = Pick<GeneRecord, 'features'> & {
  isoforms: Pick<Isoform, 'accession' | 'features'>[]
}

function span({ start, end }: Pick<Feature, 'start' | 'end'>) {
  return start === end ? `residue ${start}` : `residues ${start}–${end}`
}

function sameFeature(a: Feature, b: Feature) {
  return (
    a.type === b.type &&
    a.start === b.start &&
    a.end === b.end &&
    a.description === b.description
  )
}

function missingOf(example: Example, record: Losses, feature: Feature) {
  const index = record.features.findIndex(f => sameFeature(f, feature))
  const isoform = record.isoforms.find(i => i.accession === example.isoform)
  return isoform?.features.find(([at]) => at === index)?.[1] ?? 0
}

function lossPhrase(example: Example, record: Losses) {
  const { feature } = example
  const segments = record.features.filter(f => f.type === 'Transmembrane')
  const sites = record.features.filter(
    site =>
      site.type === 'Active site' &&
      site.start >= feature.start &&
      site.end <= feature.end &&
      missingOf(example, record, site) >= site.end - site.start + 1,
  )
  const domain = feature.description
    ? `the ${feature.description} domain`
    : 'a domain'
  return example.kind === 'signal'
    ? `the whole signal peptide (${span(feature)})`
    : example.kind === 'transmembrane'
      ? segments.length === 1
        ? `the protein’s only transmembrane segment (${span(feature)})`
        : `all ${segments.length} of its transmembrane segments`
      : `${missingOf(example, record, feature)} of the ${feature.end - feature.start + 1} residues of ${domain} (${span(feature)}) and ${
          sites.length === 1
            ? `its active site at ${span(sites[0] ?? feature)}`
            : `${sites.length} active sites within it`
        }`
}

export function exampleSentence(example: Example, record: Losses) {
  const replaced = example.replaced
    ? ` (and ${example.replaced} more replaced by other sequence)`
    : ''
  return `${example.gene} isoform ${example.name}, encoded by ${example.transcript}, is missing ${residueCount(example.missing)} of the canonical sequence${replaced}, including ${lossPhrase(example, record)}.`
}
