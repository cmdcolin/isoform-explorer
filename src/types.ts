export const FEATURE_GROUPS = {
  targeting: [
    'Signal',
    'Transit peptide',
    'Propeptide',
    'Transmembrane',
    'Intramembrane',
    'Topological domain',
  ],
  domains: [
    'Domain',
    'Repeat',
    'Zinc finger',
    'DNA binding',
    'Coiled coil',
    'Region',
    'Motif',
  ],
  sites: ['Active site', 'Binding site', 'Site'],
  modifications: [
    'Modified residue',
    'Lipidation',
    'Glycosylation',
    'Disulfide bond',
    'Cross-link',
  ],
} as const

export type FeatureGroup = keyof typeof FEATURE_GROUPS
export type FeatureType = (typeof FEATURE_GROUPS)[FeatureGroup][number]

export interface Feature {
  type: FeatureType
  start: number
  end: number
  description: string
}

export type Segment = [
  isoformStart: number,
  canonicalStart: number,
  length: number,
]
export type BandRun = [band: number, length: number]

export interface Edit {
  start: number
  end: number
  original: string
  replacement: string
}

export interface Transcripts {
  ensembl: string[]
  refseq: string[]
  maneSelect: boolean
}

export interface Model {
  entry: string
  cif: string
  meanPlddt: number
  plddt: BandRun[]
}

export type FeatureLoss = [feature: number, missing: number, replaced: number]
export type InterfaceLoss = [absent: number, total: number]

export interface Isoform {
  accession: string
  name: string
  synonyms: string[]
  note: string
  length: number
  transcripts: Transcripts
  segments: Segment[]
  edits: Edit[]
  missing: number
  replaced: number
  novel: number
  foldedAbsent: number | null
  features: FeatureLoss[]
  interfaces: Record<string, InterfaceLoss>
  model: (Model & { losingConfidence: number }) | null
}

export interface GeneRecord {
  page: string
  gene: string
  accession: string
  protein: string
  length: number
  disease: boolean
  events: string[]
  canonical: {
    accession: string
    name: string
    synonyms: string[]
    transcripts: Transcripts
    model: Model | null
  }
  described: number
  features: Feature[]
  interfaces: Record<string, number[]>
  isoforms: Isoform[]
}

export interface IndexRow {
  page: string
  gene: string
  accession: string
  protein: string
  length: number
  isoforms: number
  withTranscript: number
  mostAbsent: number
  foldedAbsent: number | null
  lost: Record<FeatureGroup, number>
  interfacesLost: number
}

export interface Totals {
  proteins: number
  isoforms: number
  withTranscript: number
  withModel: number
  maneSelectNotCanonical: number
  lacking: Record<FeatureGroup | 'interface' | 'folded', number>
}
