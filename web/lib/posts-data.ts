import type { Mrna } from './start-codons-figure.ts'
import type { Reported } from './exon-figures.ts'

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

export const CD19_REPORTED: Reported = {
  summary:
    'An mRNA found in B-cell leukaemia that relapsed after CAR T therapy, listed by neither UniProt nor GENCODE 49',
  cite: 'reported in B-ALL, Sotillo et al. 2015',
}
