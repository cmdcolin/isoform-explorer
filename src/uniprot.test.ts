import { describe, expect, it } from 'vitest'

import {
  eventsOf,
  featuresOf,
  notesByMolecule,
  proteinOf,
  withoutWholeChains,
  withoutEvidence,
} from './uniprot.ts'

const at = (start: number | null, end: number | null) => ({
  start: { value: start },
  end: { value: end },
})

describe('featuresOf', () => {
  it('keeps the four groups, sorted, and drops other types', () => {
    expect(
      featuresOf({
        features: [
          { type: 'Domain', location: at(5, 90), description: 'SH2' },
          { type: 'Chain', location: at(1, 213), description: 'Protein' },
          { type: 'Signal', location: at(1, 20), description: '' },
          { type: 'Compositional bias', location: at(30, 40) },
        ],
      }),
    ).toEqual([
      { type: 'Signal', start: 1, end: 20, description: '' },
      { type: 'Domain', start: 5, end: 90, description: 'SH2' },
    ])
  })

  it('leaves out regions described only as disordered', () => {
    expect(
      featuresOf({
        features: [
          { type: 'Region', location: at(1, 50), description: 'Disordered' },
          {
            type: 'Region',
            location: at(60, 70),
            description: 'Heparin-binding',
          },
        ],
      }),
    ).toEqual([
      { type: 'Region', start: 60, end: 70, description: 'Heparin-binding' },
    ])
  })

  it('names a binding site by its ligand', () => {
    expect(
      featuresOf({
        features: [
          {
            type: 'Binding site',
            location: at(487, 495),
            description: '',
            ligand: { name: 'ATP' },
          },
        ],
      }),
    ).toEqual([
      { type: 'Binding site', start: 487, end: 495, description: 'ATP' },
    ])
  })

  it('keeps a bond with one unknown end at its known residue', () => {
    expect(
      featuresOf({
        features: [
          { type: 'Disulfide bond', location: at(301, null), description: '' },
          { type: 'Domain', location: at(null, 90), description: 'SH2' },
        ],
      }),
    ).toEqual([
      { type: 'Disulfide bond', start: 301, end: 301, description: '' },
    ])
  })
})

describe('notesByMolecule', () => {
  it('collects isoform comments on what the isoform is or does', () => {
    const notes = notesByMolecule({
      comments: [
        {
          commentType: 'MISCELLANEOUS',
          molecule: 'Isoform 2',
          texts: [{ value: 'May be produced at very low levels' }],
        },
        {
          commentType: 'FUNCTION',
          molecule: 'Isoform 2',
          texts: [{ value: 'Acts as a dominant negative' }],
        },
        {
          commentType: 'TISSUE SPECIFICITY',
          molecule: 'Isoform 2',
          texts: [{ value: 'Expressed in kidney' }],
        },
        { commentType: 'FUNCTION', texts: [{ value: 'Whole protein' }] },
      ],
    })
    expect([...notes]).toEqual([
      [
        'Isoform 2',
        [
          {
            topic: 'Miscellaneous',
            text: 'May be produced at very low levels',
          },
          { topic: 'Function', text: 'Acts as a dominant negative' },
        ],
      ],
    ])
  })
})

describe('entry fields', () => {
  it('reads the recommended protein name', () => {
    expect(
      proteinOf({
        proteinDescription: {
          recommendedName: {
            fullName: { value: 'Cellular tumor antigen p53' },
          },
        },
      }),
    ).toBe('Cellular tumor antigen p53')
  })

  it('reads the alternative-products events', () => {
    expect(
      eventsOf({
        comments: [
          {
            commentType: 'ALTERNATIVE PRODUCTS',
            events: ['Alternative promoter usage', 'Alternative splicing'],
          },
        ],
      }),
    ).toEqual(['Alternative promoter usage', 'Alternative splicing'])
  })

  it('strips evidence before caching', () => {
    expect(
      withoutEvidence({
        features: [{ type: 'Signal', evidences: [{ evidenceCode: 'x' }] }],
      }),
    ).toEqual({ features: [{ type: 'Signal' }] })
  })
})

describe('withoutWholeChains', () => {
  const chain = (start: number, end: number, description = '') => ({
    type: 'Chain' as const,
    start,
    end,
    description,
  })

  it('drops the chain of a single-chain protein', () => {
    expect(withoutWholeChains([chain(1, 393)])).toEqual([])
  })

  it('keeps the shorter products of a precursor, never the longest', () => {
    expect(
      withoutWholeChains([
        chain(18, 770, 'Amyloid-beta precursor protein'),
        chain(672, 713, 'Amyloid-beta protein 42'),
        { type: 'Peptide', start: 688, end: 713, description: 'P3(42)' },
      ]),
    ).toEqual([
      chain(672, 713, 'Amyloid-beta protein 42'),
      { type: 'Peptide', start: 688, end: 713, description: 'P3(42)' },
    ])
  })

  it('keeps a lone peptide', () => {
    expect(
      withoutWholeChains([
        { type: 'Peptide', start: 85, end: 116, description: 'Calcitonin' },
      ]),
    ).toHaveLength(1)
  })
})
