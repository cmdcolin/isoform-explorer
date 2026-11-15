import { describe, expect, it } from 'vitest'

import { locusOf, placeOf } from './ensembl.ts'

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
