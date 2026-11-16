import { describe, expect, it } from 'vitest'

import {
  cachedPlace,
  codingParts,
  gencodeType,
  junctionsOf,
  layoutOf,
  locusOf,
  placeOf,
  structureOf,
  typeOf,
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

describe('cachedPlace', () => {
  it('reads a place as the cache writes it', () => {
    expect(cachedPlace(['1', 97446142, 97457370])).toEqual([
      '1',
      97446142,
      97457370,
    ])
  })

  it('gives nothing for an id cached as unknown', () => {
    expect(cachedPlace(null)).toBeNull()
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

describe('codingParts', () => {
  it('numbers exons along the transcript and counts coding nucleotides before each', () => {
    const layout = layoutOf(ZDHHC16)
    const parts = layout && codingParts(layout)
    expect(parts?.[0]?.coding).toBeNull()
    expect(parts?.[2]).toMatchObject({
      number: 3,
      coding: { bases: [97451676, 97451918], from: 0 },
    })
    expect(parts?.[6]?.coding?.from).toBe(556)
  })

  it('walks a minus-strand transcript from its highest coordinate', () => {
    const parts = codingParts({
      strand: -1,
      coding: [100, 290],
      exons: [
        [90, 129],
        [201, 300],
      ],
    })
    expect(parts.map(p => [p.number, p.exon, p.coding?.from])).toEqual([
      [1, [201, 300], 0],
      [2, [90, 129], 90],
    ])
  })
})

describe('structureOf', () => {
  const canonical = layoutOf(ZDHHC16)
  const withoutExon2 = canonical && {
    ...canonical,
    exons: canonical.exons.filter(([start]) => start !== 97450357),
  }
  const short: [number, number] = [97451676, 97456000]
  const layouts = new Map([
    ['ENST1', withoutExon2],
    ['ENST2', canonical],
    ['ENST3', canonical && { ...canonical, coding: short }],
  ])

  it('takes the first fitting transcript when there is nothing to resemble', () => {
    expect(
      structureOf(['ENST3.1', 'ENST1.1', 'ENST2.1'], layouts, 377, null)
        ?.transcript,
    ).toBe('ENST1.1')
  })

  it('prefers the fitting transcript differing from the canonical one in fewest bases', () => {
    const like = structureOf(['ENST2.1'], layouts, 377, null)
    expect(
      structureOf(['ENST3.1', 'ENST1.1', 'ENST2.1'], layouts, 377, like)
        ?.transcript,
    ).toBe('ENST2.1')
  })

  it('orders exons by start whatever the strand', () => {
    const minus = {
      strand: -1,
      coding: [100, 290] satisfies [number, number],
      exons: [
        [201, 300],
        [90, 129],
      ] satisfies [number, number][],
    }
    expect(
      structureOf(['ENST4.1'], new Map([['ENST4', minus]]), 39, null)?.exons,
    ).toEqual([
      [90, 129],
      [201, 300],
    ])
  })
})

describe('gencodeType', () => {
  it('reads the transcript type from GFF3 attributes', () => {
    expect(
      gencodeType(
        'ID=ENST00000525085.1;transcript_id=ENST00000525085.1;transcript_type=protein_coding;level=2;tag=basic,CCDS',
      ),
    ).toEqual({ type: 'protein_coding', complete: true })
  })

  it('marks a coding sequence tagged as starting or ending outside the transcript', () => {
    expect(
      gencodeType(
        'transcript_id=ENST1.1;transcript_type=nonsense_mediated_decay;tag=basic,cds_start_NF,mRNA_start_NF',
      ),
    ).toEqual({ type: 'nonsense_mediated_decay', complete: false })
    expect(
      gencodeType(
        'transcript_id=ENST1.1;transcript_type=nonsense_mediated_decay;tag=cds_end_NF',
      ),
    ).toEqual({ type: 'nonsense_mediated_decay', complete: false })
  })

  it('does not take gene_type for the transcript type', () => {
    expect(
      gencodeType('gene_type=protein_coding;transcript_id=ENST1.1'),
    ).toBeNull()
  })
})

describe('typeOf', () => {
  it('reads a type as the cache writes it', () => {
    expect(typeOf({ type: 'nonsense_mediated_decay', complete: true })).toEqual(
      {
        type: 'nonsense_mediated_decay',
        complete: true,
      },
    )
  })

  it('gives nothing for a transcript GENCODE lacks', () => {
    expect(typeOf(null)).toBeNull()
  })
})
