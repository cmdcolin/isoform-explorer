import { FOLDED_PLDDT, INTERFACE_LOST_SHARE } from '../../src/isoforms.ts'
import { FEATURE_GROUPS } from '../../src/types.ts'
import type {
  FeatureGroup,
  GencodeGene,
  GeneRecord,
  Totals,
} from '../../src/types.ts'
import { GROUPS, GROUP_MISSING } from './features.ts'
import { count, listText, plural } from './loss.ts'

const SHARES: Record<number, string> = { 0.5: 'half' }

export function share(value: number) {
  return SHARES[value] ?? `${Math.round(value * 100)}%`
}

export function groupMissing(group: FeatureGroup) {
  return GROUP_MISSING[group]
}

export const INTERFACE_MISSING = `missing at least ${share(INTERFACE_LOST_SHARE)} of a predicted partner interface`

function genesText(genes: GencodeGene[], page: string) {
  const byName = Map.groupBy(genes, gene => gene.name)
  const own = [...byName]
    .toSorted(([a], [b]) =>
      (a === page) === (b === page) ? a.localeCompare(b) : a === page ? -1 : 1,
    )
    .flatMap(([name, same]) => {
      const kept = same.filter(gene => !gene.readthrough)
      const places = new Set(kept.map(gene => gene.chromosome))
      return kept.length === 0
        ? []
        : kept.length === 1
          ? [name]
          : places.size === kept.length
            ? [`${name} on ${listText([...places])}`]
            : kept.map(gene => `${name} (${gene.id})`)
    })
  const readthrough = genes
    .filter(gene => gene.readthrough)
    .map(gene => (byName.get(gene.name)?.length === 1 ? gene.name : gene.id))
    .toSorted()
  return genes.length > 1
    ? listText([
        ...own,
        ...(readthrough.length > 0
          ? [
              `the readthrough ${readthrough.length === 1 ? 'gene' : 'genes'} ${listText(readthrough)}`,
            ]
          : []),
      ])
    : 'this gene'
}

/**
 * What GENCODE 49 lists for the gene against what UniProt describes, or '' when
 * every one of its complete coding transcripts is mapped. "Complete" and "of
 * GENCODE's other types" are both said out loud: the count leaves out
 * transcripts tagged `cds_start_NF` or `cds_end_NF`, and leaves out the types
 * UniProt sometimes maps to an isoform shown here, so a reader comparing it
 * with the Transcripts lists on the page is told why they differ.
 */
export function codingNote(
  { genes, gencode, mapped }: GeneRecord['coding'],
  page: string,
) {
  const rest = gencode - mapped
  const one = rest === 1
  const has =
    rest === gencode
      ? one
        ? 'It has'
        : 'They have'
      : `The other ${one ? 'one has' : `${count(rest)} have`}`
  return rest <= 0
    ? ''
    : [
        `GENCODE 49 lists ${plural(gencode, 'complete protein-coding transcript')}`,
        ` of ${genesText(genes, page)}, `,
        gencode === 1
          ? 'mapped to no isoform above. '
          : mapped === 0
            ? 'none of them mapped to an isoform above. '
            : `${mapped === 1 ? 'one' : count(mapped)} of them mapped to an isoform above. `,
        `${has} no page here, since the site covers the isoforms UniProt describes; ${one ? 'it is' : 'they are'} in JBrowse's GENCODE track.`,
        " Transcripts of GENCODE's other types are outside the count, including any UniProt maps to an isoform here.",
      ].join('')
}

export const DOMAINS_WHOLE =
  'missing at least one whole domain or region, with none cut or swapped partway'

export const MODELLED = `confidently modelled canonical residues (pLDDT ≥ ${FOLDED_PLDDT} in the AlphaFold DB model)`

export const MODELLED_MISSING = `missing ${MODELLED}`

export const LACKING_PHRASES: Record<string, string> = {
  ...Object.fromEntries(GROUPS.map(group => [group, groupMissing(group)])),
  excised: DOMAINS_WHOLE,
  interface: INTERFACE_MISSING,
  modelled: MODELLED_MISSING,
}

export function lackingTotals(totals: Totals) {
  return {
    ...totals.lacking,
    modelled: totals.lacking.folded,
  }
}

export const COLUMN_NOTES: Record<string, string> = {
  gene: 'Gene symbol, then UniProt’s protein name and accession.',
  isoforms:
    'Alternative isoforms UniProt describes; the canonical isoform is not counted.',
  transcripts:
    'Alternative isoforms with at least one Ensembl or RefSeq transcript UniProt maps to them.',
  missing:
    'The most canonical residues any one isoform is missing, with nothing in their place, out of the canonical length.',
  modelled: `The most ${MODELLED} any one isoform is missing, with nothing in their place. Blank until the canonical model’s pLDDT is fetched.`,
  ...Object.fromEntries(
    GROUPS.map(group => [
      group,
      `Isoforms ${groupMissing(group)} (${FEATURE_GROUPS[group].join(', ').toLowerCase()}), counting missing residues only.`,
    ]),
  ),
  excised: `Isoforms ${DOMAINS_WHOLE}.`,
  interface: `Isoforms ${INTERFACE_MISSING}.`,
}
