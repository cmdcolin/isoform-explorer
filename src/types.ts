export const FEATURE_GROUPS = {
  targeting: [
    'Signal',
    'Transit peptide',
    'Propeptide',
    'Chain',
    'Peptide',
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
  /** NP ids of the isoform, with versions. */
  refseqProteins: string[]
  maneSelect: boolean
  /** The `ensembl` ids GENCODE 49 types nonsense_mediated_decay. */
  decay: string[]
  /** Every `ensembl` id is in GENCODE 49, typed nonsense_mediated_decay, with a complete coding sequence. */
  onlyDecay: boolean
}

/** A transcript's GENCODE transcript_type; `complete` unless tagged cds_start_NF or cds_end_NF. */
export interface TranscriptType {
  type: string
  complete: boolean
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
  /** ENSG ids, with versions. */
  ensemblGenes: string[]
  /** Transcripts UniProt lists for the entry without naming an isoform. */
  unmapped: { ensembl: string[]; refseq: string[]; refseqProteins: string[] }
  /** Interface explorer page names for this accession, if it has them. */
  explorer: { gene: string | null; isoforms: string | null }
  /** GRCh38 span of the isoforms' Ensembl transcripts, `chr17:7661779-7687546`. */
  locus: string | null
  /**
   * Exon junctions of an Ensembl transcript encoding the canonical sequence, in
   * coding nucleotides from the start codon; `first` numbers the first coding
   * exon along the transcript.
   */
  exons: Exons | null
  /** By isoform accession, canonical included; isoforms without one are absent. */
  structures: Record<string, Structure>
}

/** Exons and coding span of a transcript, in GRCh38 coordinates. */
export interface Layout {
  strand: number
  coding: [start: number, end: number]
  exons: [start: number, end: number][]
}

/** A GENCODE transcript encoding the isoform. */
export interface Structure extends Layout {
  transcript: string
}

export interface Exons {
  transcript: string
  first: number
  junctions: number[]
}

export interface IndexRow {
  page: string
  gene: string
  accession: string
  protein: string
  length: number
  isoforms: number
  withTranscript: number
  /** Most canonical residues any isoform is missing. */
  mostMissing: number
  /** Most `foldedMissing` of any isoform; null without canonical pLDDT. */
  foldedMissing: number | null
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
  /** Proteins with at least one confident predicted partner interface. */
  interfaceProteins: number
  /** Canonical and isoform models whose pLDDT is not yet cached. */
  modelsPending: number
  maneSelectNotCanonical: number
  lacking: Record<FeatureGroup | 'interface' | 'folded', number>
}

/**
 * Upper-case gene symbols, accessions and versionless ENST, ENSG, NM and NP ids
 * to `page#isoform`, or to `page` for ids not tied to an isoform.
 */
export type Lookup = Record<string, string[]>

export interface DiseaseGene {
  page: string
  gene: string
  /** UniProt's note on how the gene is involved, verbatim. */
  note: string
}

/** A UniProt disease linked to at least one protein on the site. */
export interface Disease {
  id: string
  slug: string
  name: string
  acronym: string
  description: string
  omim: string
  genes: DiseaseGene[]
}

export const SEARCH = {
  genes: 'search/genes.json',
  accessions: 'search/accessions.json',
  ensembl: 'search/ensembl.json',
  refseq: 'search/refseq.json',
} as const
