import type { Mrna } from './start-codons-figure.ts'

export const CEBPB_MRNA: Mrna = {
  refseq: 'NM_001285879.1',
  length: 2113,
  start: 452,
  stop: 1489,
  uorf: [481, 516],
  polyA: 2108,
}

export const CEBPB_NAMES: Record<string, string> = {
  'P17676-1': 'LAP*',
  'P17676-2': 'LAP',
  'P17676-3': 'LIP',
}
