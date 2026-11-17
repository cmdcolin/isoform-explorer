import { describe, expect, it } from 'vitest'

import { skipsExon } from './cd19.ts'
import { skipping } from './transcript-sets-figure.ts'

const transcript = (exons: [number, number][]) => ({
  id: 'ENST1.1',
  name: 'GENE-201',
  type: 'protein_coding',
  tags: [],
  strand: '+',
  exons,
  cds: [10, 95] satisfies [number, number],
})

const canonical = transcript([
  [1, 20],
  [41, 52],
  [71, 100],
])

describe('skipping', () => {
  it('drops the exon and keeps the coding span when it is whole codons', () => {
    expect(skipping(canonical, 2)).toEqual({
      exons: [
        [1, 20],
        [71, 100],
      ],
      cds: [10, 95],
      skipped: [41, 52],
      inFrame: true,
    })
  })

  it('drops the coding span when the exon shifts the frame', () => {
    const shifted = transcript([
      [1, 20],
      [41, 50],
      [71, 100],
    ])
    expect(skipping(shifted, 2)).toMatchObject({ cds: null, inFrame: false })
  })
})

describe('skipsExon', () => {
  it('finds a transcript joining the exons either side of the skipped one', () => {
    const skipper = {
      ...transcript([
        [1, 20],
        [71, 100],
      ]),
      name: 'GENE-202',
    }
    expect(
      skipsExon([canonical, skipper], canonical, 2).map(t => t.name),
    ).toEqual(['GENE-202'])
  })
})
