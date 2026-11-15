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
  foldText,
  interfaceSummary,
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
    transcripts: { ensembl: [], refseq: [], maneSelect: false },
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
    disease: false,
    events: ['Alternative splicing'],
    canonical: {
      accession: 'P00000-1',
      name: '1',
      synonyms: [],
      notes: [],
      transcripts: { ensembl: [], refseq: [], maneSelect: false },
      model: null,
    },
    features: [],
    interfaces: {},
    isoforms: [],
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
      [2, 0, 1, '1 of 2 ends replaced'],
      [3, 0, 1, 'replaced'],
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
      'Helical (transmembrane, 56–75)',
    )
    expect(featureLabel(feature('Disulfide bond', 24, 86))).toBe(
      'disulfide bond (24 and 86)',
    )
    expect(featureLabel(feature('Repeat', 10, 40, '3'))).toBe(
      'repeat 3 (10–40)',
    )
  })
})

describe('the answer sentence', () => {
  test('names missing features first and counts the rest, never calling replaced residues lost', () => {
    const r = record({
      features: [
        feature('Signal', 1, 20),
        feature('Region', 10, 60, 'Interaction with X'),
        feature('Domain', 30, 80, 'Kinase'),
        feature('Modified residue', 5, 5, 'Phosphoserine'),
      ],
    })
    const i = isoform({
      segments: [[1, 21, 80]],
      edits: [edit(1, 20)],
      missing: 20,
    })
    expect(answer(r, i)).toBe(
      'Lacks residues 1–20 (20 of 100); missing in full: signal peptide (1–20) and 1 modification; cut: Interaction with X (region, 10–60).',
    )
  })

  test('an isoform with only a swap has nothing missing', () => {
    const i = isoform({
      segments: [[1, 1, 76]],
      edits: [edit(77, 100, 'ABCDEFGHIJKLMN')],
      replaced: 24,
      novel: 14,
    })
    expect(residueClause(editEffects(i), 100, i)).toBe(
      'nothing is missing; residues 77–100 are replaced by 14 different residues',
    )
  })

  test('an isoform with only an insertion has nothing missing or replaced', () => {
    const i = isoform({
      segments: [
        [1, 1, 50],
        [56, 51, 50],
      ],
      edits: [edit(50, 50, 'AKKKK')],
      novel: 4,
    })
    expect(answer(record({}), i)).toBe(
      'Nothing is missing or replaced; it adds 4 residues the canonical lacks, at 50.',
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

  test('residues mostly below pLDDT 50 read as no fold, not fold lost', () => {
    const i = isoform({
      segments: [[1, 1, 60]],
      edits: [edit(61, 100)],
      missing: 40,
      foldedAbsent: 0,
      foldedMissing: 0,
    })
    expect(foldText(modelled, i)).toBe(
      'The canonical model shows no fold where residues are missing: 40 of the 40 have pLDDT below 50.',
    )
  })

  test('folded residues count only where the canonical model has pLDDT', () => {
    const i = isoform({
      segments: [[1, 11, 90]],
      edits: [edit(1, 10)],
      missing: 10,
      foldedAbsent: 10,
      foldedMissing: 10,
    })
    expect(foldText(modelled, i)).toBe(
      'All 10 missing residues are folded in the canonical model (pLDDT ≥ 70).',
    )
    expect(foldText(record({}), i)).toMatch(/no full-length model/)
    expect(
      foldText(
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

  test('a present interface is reported as present, never as binding', () => {
    const r = record({ interfaces: { KLK11: [1, 2, 3, 4], GENE: [50, 51] } })
    expect(interfaceSummary(r, isoform({}))).toBe(
      'Every predicted interface residue is present, for 2 partners.',
    )
    expect(
      interfaceSummary(r, isoform({ interfaces: { KLK11: [2, 1, 4] } })),
    ).toBe('Missing at least half of the predicted interface with KLK11.')
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
