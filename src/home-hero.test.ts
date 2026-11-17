import { expect, test } from 'vitest'

import { heroTraces, keptRanges } from './home-hero.ts'

const HEADER = `data_TEST
loop_
_atom_site.group_PDB
_atom_site.label_atom_id
_atom_site.label_asym_id
_atom_site.label_seq_id
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.B_iso_or_equiv
`

function chain(id: string, shift: number, length: number) {
  return Array.from(
    { length },
    (_, i) =>
      `ATOM CA ${id} ${i + 1} ${shift + 3 * Math.cos(i)} ${3 * Math.sin(i)} ${i} 90.0`,
  ).join('\n')
}

const complexCif = `${HEADER}${chain('A', 0, 8)}\n${chain('B', 20, 8)}\n`
const isoformCif = `${HEADER}${chain('A', 100, 5)}\n`

test('a segment list becomes the canonical residue ranges the isoform keeps', () => {
  expect(
    keptRanges([
      [1, 1, 134],
      [135, 200, 10],
    ]),
  ).toEqual([
    [1, 134],
    [200, 209],
  ])
})

test('isoform residues are numbered as in the canonical and those outside the segments are dropped', () => {
  const { isoform } = heroTraces({
    complexCif,
    isoformCif,
    segments: [[1, 1, 4]],
    anchor: [1, 4],
  })
  expect(isoform.filter((_, i) => i % 5 === 0)).toEqual([1, 2, 3, 4])
})

test('every chain is written as position, x, y, z and pLDDT in tenths of an ångström', () => {
  const { canonical, partner } = heroTraces({
    complexCif,
    isoformCif,
    segments: [[1, 1, 5]],
    anchor: [1, 5],
  })
  expect(canonical).toHaveLength(8 * 5)
  expect(partner).toHaveLength(8 * 5)
  expect(canonical.filter((_, i) => i % 5 === 4)).toEqual(Array(8).fill(90))
})

test('the partner lies on the positive side of the contact axis and the isoform lands on the canonical', () => {
  const { canonical, partner, isoform, anchorRmsd } = heroTraces({
    complexCif,
    isoformCif,
    segments: [[1, 1, 5]],
    anchor: [1, 5],
  })
  const meanX = (flat: number[]) =>
    flat.filter((_, i) => i % 5 === 1).reduce((a, b) => a + b, 0) /
    (flat.length / 5)
  expect(meanX(partner)).toBeGreaterThan(meanX(canonical))
  expect(anchorRmsd).toBeLessThan(0.2)
  expect(isoform.slice(0, 5)).toEqual(canonical.slice(0, 5))
})
