import { FOLDED_PLDDT, INTERFACE_LOST_SHARE } from '../../src/isoforms.ts'
import { FEATURE_GROUPS } from '../../src/types.ts'
import type { FeatureGroup, Totals } from '../../src/types.ts'
import { GROUPS, GROUP_MISSING } from './features.ts'

const SHARES: Record<number, string> = { 0.5: 'half' }

export function share(value: number) {
  return SHARES[value] ?? `${Math.round(value * 100)}%`
}

export function groupMissing(group: FeatureGroup) {
  return GROUP_MISSING[group]
}

export const INTERFACE_MISSING = `missing at least ${share(INTERFACE_LOST_SHARE)} of a predicted partner interface`

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
