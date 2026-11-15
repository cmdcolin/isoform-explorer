import { FOLDED_PLDDT, INTERFACE_LOST_SHARE } from '../../src/isoforms.ts'
import { FEATURE_GROUPS } from '../../src/types.ts'
import type { FeatureGroup, Totals } from '../../src/types.ts'
import { GROUPS, GROUP_LABELS } from './features.ts'

const SHARES: Record<number, string> = { 0.5: 'half' }

export function share(value: number) {
  return SHARES[value] ?? `${Math.round(value * 100)}%`
}

export function groupMissing(group: FeatureGroup) {
  return `missing in full a feature from ${GROUP_LABELS[group].toLowerCase()}`
}

export const INTERFACE_MISSING = `missing at least ${share(INTERFACE_LOST_SHARE)} of a predicted partner interface`

export const MODELLED = `confidently modelled canonical residues (pLDDT ≥ ${FOLDED_PLDDT} in the AlphaFold DB model)`

export const MODELLED_MISSING = `missing ${MODELLED}`

export const LACKING_PHRASES: Record<string, string> = {
  ...Object.fromEntries(GROUPS.map(group => [group, groupMissing(group)])),
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
    'The most canonical residues any one isoform is missing, with nothing in their place, out of the canonical length. Replaced residues are not counted.',
  modelled: `The most ${MODELLED} any one isoform is missing; replaced residues are not counted. Blank until the canonical model’s pLDDT is fetched.`,
  ...Object.fromEntries(
    GROUPS.map(group => [
      group,
      `Isoforms ${groupMissing(group)}: ${FEATURE_GROUPS[group].join(', ').toLowerCase()}. Missing only; a replaced residue never counts.`,
    ]),
  ),
  interface: `Isoforms ${INTERFACE_MISSING}.`,
}
