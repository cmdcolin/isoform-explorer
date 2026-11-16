import { describe, expect, it } from 'vitest'

import {
  canonicalExons,
  junctionsOf,
  layoutOf,
  locusOf,
  placeOf,
} from './ensembl.ts'

describe('placeOf', () => {
  it('reads chromosome and span from a lookup result', () => {
    expect(
      placeOf({ seq_region_name: '17', start: 7668421, end: 7687490 }),
    ).toEqual(['17', 7668421, 7687490])
  })

  it('gives nothing for an id Ensembl does not know', () => {
    expect(placeOf(null)).toBeNull()
  })
})

describe('locusOf', () => {
  it('spans the transcripts of one chromosome', () => {
    expect(
      locusOf([
        ['17', 7668421, 7687490],
        ['17', 7661779, 7687538],
      ]),
    ).toBe('chr17:7661779-7687538')
  })

  it('ignores unknown transcripts and alternative haplotypes', () => {
    expect(
      locusOf([undefined, null, ['HSCHR6_MHC_COX', 1, 2], ['MT', 5, 9]]),
    ).toBe('chrM:5-9')
  })

  it('gives no locus when transcripts disagree on chromosome', () => {
    expect(
      locusOf([
        ['1', 1, 2],
        ['2', 1, 2],
      ]),
    ).toBeNull()
  })

  it('gives no locus without transcripts', () => {
    expect(locusOf([])).toBeNull()
  })
})

const ZDHHC16 = {
  strand: 1,
  Translation: { start: 97451676, end: 97456891 },
  Exon: [
    [97446175, 97446353],
    [97450357, 97450536],
    [97451671, 97451918],
    [97452090, 97452284],
    [97452415, 97452503],
    [97452895, 97452923],
    [97453530, 97453663],
    [97453799, 97453846],
    [97454714, 97454799],
    [97455660, 97455783],
    [97455974, 97456044],
    [97456777, 97457370],
  ].map(([start, end]) => ({ start, end })),
}

describe('junctionsOf', () => {
  const layout = layoutOf(ZDHHC16)

  it('reads strand, coding span and exons from an expanded lookup', () => {
    expect(layout?.coding).toEqual([97451676, 97456891])
    expect(layout?.exons).toHaveLength(12)
  })

  it('places each junction in coding nucleotides, from the first coding exon, like ZDHHC16', () => {
    expect(layout && junctionsOf(layout, 377)).toEqual({
      first: 3,
      junctions: [243, 438, 527, 556, 690, 738, 824, 948, 1019],
    })
  })

  it('walks a minus-strand transcript from its highest coordinate', () => {
    expect(
      junctionsOf(
        {
          strand: -1,
          coding: [100, 290],
          exons: [
            [90, 129],
            [201, 300],
          ],
        },
        39,
      ),
    ).toEqual({ first: 1, junctions: [90] })
  })

  it('gives nothing when the coding length does not fit the protein', () => {
    expect(layout && junctionsOf(layout, 376)).toBeNull()
  })
})

describe('canonicalExons', () => {
  it('takes the first transcript whose translation fits the canonical length', () => {
    const layout = layoutOf(ZDHHC16)
    const short: [number, number] = [97451676, 97456000]
    const layouts = new Map([
      ['ENST1', layout && { ...layout, coding: short }],
      ['ENST2', layout],
    ])
    expect(
      canonicalExons(['ENST3.1', 'ENST1.4', 'ENST2.6'], layouts, 377)
        ?.transcript,
    ).toBe('ENST2.6')
  })
})
