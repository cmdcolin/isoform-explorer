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

/**
 * A disulfide bond or cross-link is its two residues `start` and `end`, not
 * the range between; `start === end` for an interchain bond or one whose
 * other end UniProt gives as unknown.
 */
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

/** Longest `original` and `replacement` kept; `added` is the full length. */
export const EDIT_PREVIEW = 40

/** Canonical `start..end` becomes `replacement` (`''` when missing). */
export interface Edit {
  start: number
  end: number
  original: string
  replacement: string
  added: number
}

/** ENST and NM ids with versions, the MANE Select transcript first. */
export interface Transcripts {
  ensembl: string[]
  refseq: string[]
  maneSelect: boolean
}

/** UniProt text about this isoform, `topic` naming the comment it is from. */
export interface Note {
  topic: string
  text: string
}

/** pLDDT fields are null while the model's confidence doc is not cached. */
export interface Model {
  entry: string
  cif: string
  meanPlddt: number | null
  plddt: BandRun[] | null
}

/** Counts of the feature's residues (or bond ends) missing and replaced. */
export type FeatureLoss = [feature: number, missing: number, replaced: number]
export type InterfaceLoss = [missing: number, replaced: number, total: number]

export interface Isoform {
  accession: string
  name: string
  synonyms: string[]
  notes: Note[]
  length: number
  transcripts: Transcripts
  segments: Segment[]
  edits: Edit[]
  missing: number
  replaced: number
  novel: number
  /** Canonical pLDDT ≥ 70 residues not carried over; null without its pLDDT. */
  foldedAbsent: number | null
  /** The part of `foldedAbsent` that is missing rather than replaced. */
  foldedMissing: number | null
  /** Only features with at least one residue not carried over. */
  features: FeatureLoss[]
  /** Only partners with at least one interface residue not carried over. */
  interfaces: Record<string, InterfaceLoss>
  /** `losingConfidence` is null unless both models have pLDDT. */
  model: (Model & { losingConfidence: number | null }) | null
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
    notes: Note[]
    transcripts: Transcripts
    model: Model | null
  }
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
  /** Most canonical residues any isoform does not carry over. */
  mostAbsent: number
  /** Most `foldedAbsent` of any isoform; null without canonical pLDDT. */
  foldedAbsent: number | null
  /** Isoforms lacking, in full, at least one feature of the group. */
  lost: Record<FeatureGroup, number>
  /** Isoforms missing at least half of a partner's interface. */
  interfacesLost: number
}

export interface Totals {
  proteins: number
  isoforms: number
  withTranscript: number
  /** Alternative isoforms with their own AlphaFold DB model. */
  withModel: number
  /** Proteins whose canonical has a full-length AlphaFold DB model. */
  canonicalModels: number
  /** Canonical and isoform models whose pLDDT is not yet cached. */
  modelsPending: number
  maneSelectNotCanonical: number
  lacking: Record<FeatureGroup | 'interface' | 'folded', number>
}

export interface Example {
  kind: 'signal' | 'transmembrane' | 'activeSite'
  page: string
  gene: string
  protein: string
  isoform: string
  name: string
  transcript: string
  feature: Feature
  missing: number
  replaced: number
}

/** Upper-case gene symbols, accessions and versionless ENST/NM to targets. */
export type Lookup = Record<string, string[]>

export const SEARCH = {
  genes: 'search/genes.json',
  accessions: 'search/accessions.json',
  ensembl: 'search/ensembl.json',
  refseq: 'search/refseq.json',
} as const
