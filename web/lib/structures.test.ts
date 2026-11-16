import { describe, expect, test } from 'vitest'

import type { Structure } from '../../src/types.ts'
import { canonicalResidues, genomeScale } from './structures.ts'

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

const MINUS: Structure = {
  transcript: 'T',
  strand: -1,
  coding: [100, 290],
  exons: [
    [90, 129],
    [201, 300],
  ],
}

describe('canonicalResidues', () => {
  const residuesOf = canonicalResidues(ZDHHC16, 377)

  test('a later acceptor inside exon 7, as in ZDHHC16 isoform 3, keeps residues 215-230', () => {
    expect(residuesOf([97453618, 97453663])).toEqual([[215, 230]])
  })

  test('untranslated bases encode no residues, and the stop codon is not one', () => {
    expect(residuesOf([97446175, 97446353])).toEqual([])
    expect(residuesOf([97456889, 97456891])).toEqual([])
  })

  test('counts from the high end on the minus strand', () => {
    const minus = canonicalResidues(MINUS, 63)
    expect(minus([285, 290])).toEqual([[1, 2]])
    expect(minus([100, 129])).toEqual([[31, 40]])
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
    const place = genomeScale([MINUS], 0, 1000)
    expect(place([201, 300]).x).toBe(0)
    expect(place([90, 129]).x).toBeGreaterThan(place([201, 300]).x)
  })
})
