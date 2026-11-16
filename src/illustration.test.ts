import { expect, test } from 'vitest'

import {
  type Illustration,
  KIND,
  flatten,
  parseAtoms,
  structTitle,
} from './illustration.ts'

const CIF = `data_TEST
_struct.title                     'A test structure'
loop_
_atom_site.group_PDB
_atom_site.type_symbol
_atom_site.label_alt_id
_atom_site.label_comp_id
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.auth_seq_id
_atom_site.auth_asym_id
ATOM   C . ALA 1.0 0.0 0.0 10 A
ATOM   H . ALA 1.0 0.5 0.0 10 A
ATOM   C B ALA 1.0 0.9 0.0 10 A
ATOM   C . GLY 0.0 2.0 0.0 20 A
HETATM P . FBP 0.0 0.0 3.0 600 A
HETATM O . HOH 9.0 9.0 9.0 700 A
ATOM   C . ALA -1.0 0.0 0.0 10 B
`

const pkm: Illustration = {
  name: 'test',
  pdb: 'TEST',
  highlight: [15, 25],
  ligand: 'FBP',
}

test('keeps heavy atoms of the protein and the named ligand, marking the highlighted residues', () => {
  const atoms = parseAtoms(CIF, pkm)
  expect(atoms.map(a => [a.chain, a.kind])).toEqual([
    ['A', KIND.protein],
    ['A', KIND.highlight],
    ['A', KIND.ligand],
    ['B', KIND.protein],
  ])
})

test('reads the structure title', () => {
  expect(structTitle(CIF)).toBe('A test structure')
})

test('flattens to five integers per atom, centred, in tenths of an ångström', () => {
  const flat = flatten(parseAtoms(CIF, pkm))
  expect(flat).toHaveLength(20)
  const sums = [0, 1, 2].map(axis =>
    flat.filter((_, i) => i % 5 === axis).reduce((a, b) => a + b, 0),
  )
  sums.forEach(sum => expect(Math.abs(sum)).toBeLessThanOrEqual(2))
  expect(flat.filter((_, i) => i % 5 === 3)).toEqual([0, 0, 0, 1])
})
