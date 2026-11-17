import { expect, test } from 'vitest'

import type { Point } from './contacts.ts'
import {
  centre,
  contactFrame,
  parseBackbone,
  rmsd,
  subtract,
  superposition,
} from './structure.ts'

const CIF = `data_TEST
loop_
_atom_site.group_PDB
_atom_site.label_atom_id
_atom_site.label_asym_id
_atom_site.label_seq_id
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.B_iso_or_equiv
ATOM N  A 1 0.0 0.0 0.0 90.0
ATOM CA A 1 1.0 2.0 3.0 91.5
ATOM CA A 2 4.0 5.0 6.0 40.0
ATOM CA B 1 7.0 8.0 9.0 77.0
HETATM CA A 3 0.0 0.0 0.0 10.0
`

const fold: Point[] = [
  [0, 0, 0],
  [3, 1, 0],
  [4, 4, 1],
  [2, 6, 3],
  [-1, 5, 6],
  [-3, 2, 4],
  [-2, -1, 1],
]

function turned([x, y, z]: Point): Point {
  const angle = 2.1
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [c * x - s * z + 10, y - 4, s * x + c * z + 7]
}

test('reads one alpha carbon per residue with its pLDDT, optionally for one chain', () => {
  expect(parseBackbone(CIF).map(r => r.position)).toEqual([1, 2, 1])
  expect(parseBackbone(CIF, 'A')).toEqual([
    { position: 1, coord: [1, 2, 3], plddt: 91.5 },
    { position: 2, coord: [4, 5, 6], plddt: 40 },
  ])
})

test('superposition undoes a rotation and a shift', () => {
  const place = superposition(fold.map(turned), fold)
  expect(rmsd(fold.map(turned).map(place), fold)).toBeLessThan(1e-6)
})

test('superposition leaves a residual when the folds differ', () => {
  const bent = fold.map(([x, y, z], i): Point => [x, y + (i % 2) * 2, z])
  const place = superposition(bent.map(turned), fold)
  expect(rmsd(bent.map(turned).map(place), fold)).toBeGreaterThan(0.1)
})

test('the contact frame puts the partner along the positive x axis', () => {
  const partner = fold.map(([x, y, z]): Point => [x + 20, y + 3, z - 2])
  const place = contactFrame(fold, partner)
  const [x, y, z] = centre(partner.map(place))
  expect(x).toBeGreaterThan(15)
  expect(Math.abs(y)).toBeLessThan(1e-9)
  expect(Math.abs(z)).toBeLessThan(1e-9)
  const [own] = centre(fold.map(place))
  expect(own).toBeCloseTo(0)
})

test('subtract takes the second point from the first', () => {
  expect(subtract([3, 2, 1], [1, 1, 1])).toEqual([2, 1, 0])
})
