import { describe, expect, test } from 'vitest'

import type { Edit, Feature, GeneRecord, Isoform } from '../../src/types.ts'
import { gene } from './data.ts'
import {
  answer,
  carriedRuns,
  changeText,
  changes,
  editEffects,
  featureEffects,
  featureLabel,
  confidenceText,
  interfaceLossText,
  lossText,
  maneIsoform,
  modelText,
  residueClause,
  subtractRuns,
} from './loss.ts'

function edit(
  start: number,
  end: number,
  replacement = '',
  added = replacement.length,
): Edit {
  return {
    start,
    end,
    original: 'X'.repeat(Math.min(end - start + 1, 40)),
    replacement,
    added,
  }
}

function feature(
  type: Feature['type'],
  start: number,
  end: number,
  description = '',
): Feature {
  return { type, start, end, description }
}

function isoform(overrides: Partial<Isoform>): Isoform {
  return {
    accession: 'P00000-2',
    name: '2',
    synonyms: [],
    notes: [],
    length: 0,
    transcripts: {
      ensembl: [],
      refseq: [],
      refseqProteins: [],
      maneSelect: false,
    },
    segments: [],
    edits: [],
    missing: 0,
    replaced: 0,
    novel: 0,
    foldedAbsent: null,
    foldedMissing: null,
    features: [],
    interfaces: {},
    model: null,
    ...overrides,
  }
}

function record(overrides: Partial<GeneRecord>): GeneRecord {
  return {
    page: 'GENE',
    gene: 'GENE',
    accession: 'P00000',
    protein: 'Protein',
    length: 100,
    events: ['Alternative splicing'],
    canonical: {
      accession: 'P00000-1',
      name: '1',
      synonyms: [],
      notes: [],
      transcripts: {
        ensembl: [],
        refseq: [],
        refseqProteins: [],
        maneSelect: false,
      },
      model: null,
    },
    features: [],
    interfaces: {},
    isoforms: [],
    ensemblGenes: [],
    unmapped: { ensembl: [], refseq: [], refseqProteins: [] },
    explorer: { gene: null, isoforms: null },
    locus: null,
    exons: null,
    structures: {},
    ...overrides,
  }
}

describe('residues on canonical coordinates', () => {
  test('carried segments merge across an insertion, and an edit keeps only what they do not carry', () => {
    const carried = carriedRuns([
      [1, 1, 20],
      [26, 21, 30],
    ])
    expect(carried).toEqual([[1, 50]])
    expect(subtractRuns([10, 60], carried)).toEqual([[51, 60]])
    expect(
      subtractRuns(
        [1, 10],
        [
          [3, 4],
          [8, 8],
        ],
      ),
    ).toEqual([
      [1, 2],
      [5, 7],
      [9, 10],
    ])
  })

  test('an edit adding at least half as many residues as it removes is a swap, otherwise a loss', () => {
    const [swap, truncation, insertion] = editEffects({
      segments: [
        [1, 1, 9],
        [13, 16, 35],
        [48, 52, 29],
      ],
      edits: [edit(10, 15, 'ABC'), edit(51, 51), edit(81, 100, 'Q')],
    })
    expect(swap).toMatchObject({ removed: 6, novel: 3, fate: 'replaced' })
    expect(truncation).toMatchObject({ removed: 1, novel: 0, fate: 'missing' })
    expect(insertion).toMatchObject({ removed: 20, novel: 1, fate: 'missing' })
  })

  test('a pure insertion removes nothing and is not a swap', () => {
    const [insertion] = editEffects({
      segments: [
        [1, 1, 50],
        [56, 51, 50],
      ],
      edits: [edit(50, 50, 'AKKKK')],
    })
    expect(insertion).toMatchObject({ removed: 0, novel: 4, fate: 'missing' })
  })
})

describe('features under the change that removes them', () => {
  const features = [
    feature('Signal', 1, 20),
    feature('Domain', 30, 80, 'Kinase'),
    feature('Disulfide bond', 25, 90),
    feature('Modified residue', 95, 95, 'Phosphoserine'),
  ]
  const effects = editEffects({
    segments: [[1, 21, 60]],
    edits: [edit(1, 20), edit(81, 100, 'ABCDEFGHIJKLMNOP')],
  })

  test('counts each feature residue, or bond end, missing or replaced', () => {
    expect(
      featureEffects(features, effects).map(e => [
        e.index,
        e.missing,
        e.replaced,
        lossText(e),
      ]),
    ).toEqual([
      [0, 20, 0, 'all 20 missing'],
      [2, 0, 1, '1 of 2 ends in a replaced stretch'],
      [3, 0, 1, 'in a replaced stretch'],
    ])
  })

  test('edits within a few residues of each other read as one change', () => {
    const near = editEffects({
      segments: [
        [1, 1, 9],
        [10, 13, 3],
        [13, 20, 81],
      ],
      edits: [edit(10, 12), edit(16, 19, 'AB')],
    })
    const [change] = changes(near)
    expect(changes(near)).toHaveLength(1)
    expect(change && changeText(change)).toBe(
      '10–19: 3 residues missing and 4 residues replaced by 2 different residues',
    )
  })

  test('labels say what kind of feature and where', () => {
    expect(featureLabel(feature('Signal', 1, 21))).toBe('signal peptide (1–21)')
    expect(featureLabel(feature('Transmembrane', 56, 75, 'Helical'))).toBe(
      'transmembrane segment (56–75)',
    )
    expect(
      featureLabel(
        feature('Transmembrane', 56, 75, 'Helical; Name=S3 of repeat IV'),
      ),
    ).toBe('transmembrane segment S3 of repeat IV (56–75)')
    expect(
      featureLabel(feature('Domain', 5, 40, 'EGF-like 2; calcium-binding')),
    ).toBe('EGF-like 2 (domain, calcium-binding, 5–40)')
    expect(featureLabel(feature('Disulfide bond', 24, 86))).toBe(
      'disulfide bond (24 and 86)',
    )
    expect(featureLabel(feature('Repeat', 10, 40, '3'))).toBe(
      'repeat 3 (10–40)',
    )
  })
})

describe('the answer sentence', () => {
  test('names sites and domains before regions, counts modifications and never names topological domains', () => {
    const r = record({
      features: [
        feature('Topological domain', 1, 100, 'Cytoplasmic'),
        feature('Region', 10, 60, 'Interaction with X'),
        feature('Domain', 30, 80, 'Kinase'),
        feature('Active site', 50, 50, 'Proton acceptor'),
        feature('Modified residue', 5, 5, 'Phosphoserine'),
      ],
    })
    const i = isoform({
      segments: [[1, 1, 39]],
      edits: [edit(40, 100)],
      missing: 61,
    })
    expect(answer(r, i)).toBe(
      'Lacks residues 40–100 (61 of 100); missing in full: Proton acceptor (active site, 50); cut: Kinase (domain, 30–80) and Interaction with X (region, 10–60).',
    )
  })

  test('peptides and chains come first, two at most, before domains', () => {
    const r = record({
      features: [
        feature('Chain', 18, 100, 'Soluble form'),
        feature('Chain', 60, 99, 'Amyloid-beta 40'),
        feature('Chain', 60, 100, 'C41'),
        feature('Peptide', 70, 90, 'P3'),
        feature('Transmembrane', 80, 95, 'Helical'),
      ],
    })
    const i = isoform({
      segments: [[1, 1, 59]],
      edits: [edit(60, 100)],
      missing: 41,
    })
    expect(answer(r, i)).toBe(
      'Lacks residues 60–100 (41 of 100); missing in full: Amyloid-beta 40 (chain, 60–99), C41 (chain, 60–100), transmembrane segment (80–95) and 1 more processing, targeting or topology feature; cut: Soluble form (chain, 18–100).',
    )
  })

  test('cut features are ordered by the share of the feature lost', () => {
    const r = record({
      features: [
        feature('Region', 1, 100, 'Long'),
        feature('Region', 80, 95, 'Short'),
      ],
    })
    const i = isoform({
      segments: [[1, 1, 89]],
      edits: [edit(90, 100)],
      missing: 11,
    })
    expect(answer(r, i)).toBe(
      'Lacks residues 90–100 (11 of 100); cut: Short (region, 80–95) and Long (region, 1–100).',
    )
  })

  test('a swap leads with the swap and the feature it sits in', () => {
    const r = record({
      features: [
        feature('Domain', 60, 100, 'Ig-like 3'),
        feature('Glycosylation', 80, 80, 'N-linked'),
      ],
    })
    const i = isoform({
      segments: [[1, 1, 76]],
      edits: [edit(77, 100, 'ABCDEFGHIJKLMN')],
      replaced: 24,
      novel: 14,
    })
    expect(answer(r, i)).toBe(
      'Swaps 24 residues of the Ig-like 3 domain (77–100) for 14 different ones; nothing else is missing; in a replaced stretch: 1 modification.',
    )
  })

  test('a truncation ending in a short new tail has the tail in its place', () => {
    const i = isoform({
      segments: [[1, 1, 79]],
      edits: [edit(80, 100, 'Q')],
      missing: 21,
      novel: 1,
    })
    expect(residueClause(editEffects(i), 100)).toBe(
      'lacks residues 80–100 (21 of 100), with 1 different residue in their place',
    )
  })

  test('an isoform with only an insertion carries every canonical residue', () => {
    const i = isoform({
      segments: [
        [1, 1, 50],
        [56, 51, 50],
      ],
      edits: [edit(50, 50, 'AKKKK')],
      novel: 4,
    })
    expect(answer(record({}), i)).toBe(
      'Carries every canonical residue and inserts 4 residues the canonical lacks, at 50.',
    )
  })
})

describe('structure, interfaces and models', () => {
  const plddt: [number, number][] = [
    [90, 50],
    [0, 50],
  ]
  const modelled = record({
    canonical: {
      ...record({}).canonical,
      model: { entry: 'AF-P00000-F1', cif: 'c.cif', meanPlddt: 70, plddt },
    },
  })

  test('absent residues are counted by confidence, never summarised as no fold', () => {
    const i = isoform({
      segments: [[1, 1, 30]],
      edits: [edit(31, 100)],
      missing: 70,
      foldedAbsent: 20,
      foldedMissing: 20,
    })
    expect(confidenceText(modelled, i)).toBe(
      'Of the 70 missing residues, 20 are confidently modelled in the canonical model (pLDDT ≥ 70) and 50 have pLDDT below 50.',
    )
  })

  test('one absent residue reads in the singular', () => {
    const i = isoform({
      segments: [[1, 1, 99]],
      edits: [edit(100, 100)],
      missing: 1,
      foldedAbsent: 0,
      foldedMissing: 0,
    })
    expect(confidenceText(modelled, i)).toBe(
      'The missing residue has pLDDT below 50 in the canonical model.',
    )
  })

  test('without the canonical model or its confidence nothing is counted', () => {
    const i = isoform({
      segments: [[1, 11, 90]],
      edits: [edit(1, 10)],
      missing: 10,
      foldedAbsent: 10,
      foldedMissing: 10,
    })
    expect(confidenceText(record({}), i)).toMatch(/no full-length model/)
    expect(
      confidenceText(
        record({
          canonical: {
            ...modelled.canonical,
            model: {
              entry: 'AF-P00000-F1',
              cif: 'c.cif',
              meanPlddt: null,
              plddt: null,
            },
          },
        }),
        { ...i, foldedAbsent: null, foldedMissing: null },
      ),
    ).toMatch(/not yet fetched/)
  })

  test('a model without fetched confidence is not the same as no model', () => {
    const r = record({})
    expect(modelText(r, isoform({}))).toMatch(/no model/)
    expect(
      modelText(
        r,
        isoform({
          model: {
            entry: 'AF-X-2-F1',
            cif: 'x.cif',
            meanPlddt: null,
            plddt: null,
            losingConfidence: null,
          },
        }),
      ),
    ).toBe(
      'AlphaFold DB has a model, AF-X-2-F1; its confidence is not yet fetched.',
    )
    expect(
      modelText(
        modelled,
        isoform({
          model: {
            entry: 'AF-X-2-F1',
            cif: 'x.cif',
            meanPlddt: 60.25,
            plddt: [],
            losingConfidence: 3,
          },
        }),
      ),
    ).toMatch(
      /3 shared residues fall .* the model's confidence, not a measurement of folding\.$/,
    )
  })

  test('interface losses lead with counts per partner', () => {
    expect(
      interfaceLossText({ name: 'KLK11', missing: 8, replaced: 9, total: 18 }),
    ).toBe('KLK11: 8 missing and 9 replaced, of 18 interface residues')
  })
})

describe('real records', () => {
  test('per-edit counts add up to the pipeline’s own totals', () => {
    for (const page of ['TP53', 'FGFR2', 'APP', 'TTN', 'NDUFC2']) {
      const r = gene(page)
      for (const i of r.isoforms) {
        const effects = editEffects(i)
        const of = (fate: 'missing' | 'replaced') =>
          effects
            .filter(e => e.fate === fate)
            .reduce((sum, e) => sum + e.removed, 0)
        expect([of('missing'), of('replaced')]).toEqual([i.missing, i.replaced])
        expect(
          featureEffects(r.features, effects).map(e => [
            e.index,
            e.missing,
            e.replaced,
          ]),
        ).toEqual(i.features)
      }
    }
  })

  test('the MANE Select isoform is found when it is not the canonical', () => {
    expect(maneIsoform(gene('SPTAN1'))?.accession).toBe('Q13813-2')
    expect(maneIsoform(gene('TP53'))?.accession).toBe('P04637-1')
  })
})
