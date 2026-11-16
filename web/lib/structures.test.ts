import { describe, expect, test } from 'vitest'

import type { Structure } from '../../src/types.ts'
import { canonicalResidues, codingParts, genomeScale, merged } from './structures.ts'

const ZDHHC16: Structure = {
  transcript: 'ENST00000393760.6',
  strand: 1,
  coding: [97451676, 97456891],
  exons: [
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
  ],
}

describe('merged', () => {
  test('joins overlapping and touching spans', () => {
    expect(
      merged([
        [10, 20],
        [1, 5],
        [21, 30],
        [25, 26],
      ]),
    ).toEqual([
      [1, 5],
      [10, 30],
    ])
  })
})

describe('codingParts', () => {
  test('numbers exons along the transcript and counts coding nucleotides before each', () => {
    const parts = codingParts(ZDHHC16)
    expect(parts[0]?.coding).toBeNull()
    expect(parts[2]).toMatchObject({ number: 3, coding: { bases: [97451676, 97451918], from: 0 } })
    expect(parts[6]?.coding?.from).toBe(556)
  })

  test('walks a minus-strand transcript from its highest coordinate', () => {
    const parts = codingParts({ transcript: 'T', strand: -1, coding: [100, 290], exons: [[90, 129], [201, 300]] })
    expect(parts.map(p => [p.number, p.exon, p.coding?.from])).toEqual([
      [1, [201, 300], 0],
      [2, [90, 129], 90],
    ])
  })
})

describe('canonicalResidues', () => {
  test('a later acceptor inside exon 7, as in ZDHHC16 isoform 3, keeps residues 215-230', () => {
    expect(canonicalResidues(ZDHHC16, [97453618, 97453663], 377)).toEqual([[215, 230]])
  })

  test('untranslated bases encode no residues, and the stop codon is not one', () => {
    expect(canonicalResidues(ZDHHC16, [97446175, 97446353], 377)).toEqual([])
    expect(canonicalResidues(ZDHHC16, [97456889, 97456891], 377)).toEqual([])
  })

  test('counts from the high end on the minus strand', () => {
    const minus: Structure = { transcript: 'T', strand: -1, coding: [100, 290], exons: [[90, 129], [201, 300]] }
    expect(canonicalResidues(minus, [285, 290], 63)).toEqual([[1, 2]])
    expect(canonicalResidues(minus, [100, 129], 63)).toEqual([[31, 40]])
  })
})

describe('genomeScale', () => {
  test('fills the width, with untranslated bases narrower than coding ones', () => {
    const place = genomeScale([ZDHHC16], 0, 1000)
    const first = place([97446175, 97446353])
    const last = place([97456777, 97457370])
    expect(first.x).toBe(0)
    expect(last.x + last.width).toBeCloseTo(1000)
    const utr = place([97446175, 97446184]).width
    const cds = place([97451700, 97451709]).width
    expect(cds / utr).toBeCloseTo(5)
  })

  test('puts the 5′ end on the left for a minus-strand gene', () => {
    const place = genomeScale(
      [{ transcript: 'T', strand: -1, coding: [100, 290], exons: [[90, 129], [201, 300]] }],
      0,
      1000,
    )
    expect(place([201, 300]).x).toBe(0)
    expect(place([90, 129]).x).toBeGreaterThan(place([201, 300]).x)
  })
})
