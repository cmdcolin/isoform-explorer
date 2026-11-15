import { FOLDED_PLDDT, INTERFACE_LOST_SHARE } from '../../src/isoforms.ts'
import type { FeatureGroup } from '../../src/types.ts'

const SHARES: Record<number, string> = { 0.5: 'half' }

export function share(value: number) {
  return SHARES[value] ?? `${Math.round(value * 100)}%`
}

export const LOST_IN_FULL: Record<FeatureGroup, string> = {
  targeting:
    'a whole targeting or topology feature, such as a signal peptide or transmembrane segment',
  domains: 'a whole domain, repeat, zinc finger, region or motif',
  sites: 'a whole active, binding or other site',
  modifications:
    'a modified residue, glycosylation or lipidation site, disulfide bond or cross-link',
}

export const MISSING: Record<FeatureGroup | 'interface', string> = {
  ...LOST_IN_FULL,
  interface: `at least ${share(INTERFACE_LOST_SHARE)} of a predicted partner interface`,
}

export const SHORT_MISSING: Record<FeatureGroup | 'interface', string> = {
  targeting: 'a whole targeting or topology feature',
  domains: 'a whole domain or region',
  sites: 'a whole site',
  modifications: 'a modification',
  interface: `at least ${share(INTERFACE_LOST_SHARE)} of a partner interface`,
}

export const FOLDED = `canonical residues the AlphaFold DB model places with pLDDT ≥ ${FOLDED_PLDDT}`

export const COLUMN_TITLES: Record<string, string> = {
  isoforms:
    'Alternative isoforms UniProt describes; the canonical is not counted',
  transcripts:
    'Alternative isoforms with at least one Ensembl or RefSeq transcript',
  absent:
    'The most canonical residues any isoform does not carry over, missing or replaced, out of the canonical length',
  folded: `The most ${FOLDED} that any isoform does not carry over; blank without the canonical model’s pLDDT`,
  ...Object.fromEntries(
    Object.entries(MISSING).map(([key, text]) => [
      key,
      `Isoforms missing ${text}`,
    ]),
  ),
}
