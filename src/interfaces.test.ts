import { expect, test } from 'vitest'

import {
  atomsByChain,
  boundedMap,
  confidentComplexes,
  confidentInterfaces,
  interfaceResidues,
  partnerIdentity,
} from './interfaces.ts'

const COMPLEX = `data_x
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_seq_id
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.B_iso_or_equiv
_atom_site.auth_asym_id
ATOM 1 N N 1 0.0 0.0 0.0 80.5 A
ATOM 2 C CA 1 1.5 0.0 0.0 81.5 A
ATOM 3 H H 1 9.0 0.0 0.0 82.5 A
ATOM 4 C CA 2 20.0 0.0 0.0 60.25 A
ATOM 5 N N 7 4.0 0.0 0.0 90.0 B
HETATM 6 C C1 . 21.0 0.0 0.0 50.0 B
#
`

test('atoms by chain skip hydrogens and ligands', () => {
  const chains = atomsByChain(COMPLEX)
  expect([...chains.keys()]).toEqual(['A', 'B'])
  expect(chains.get('A')).toEqual([
    { position: 1, coord: [0, 0, 0], plddt: 80.5 },
    { position: 1, coord: [1.5, 0, 0], plddt: 81.5 },
    { position: 2, coord: [20, 0, 0], plddt: 60.25 },
  ])
  expect(chains.get('B')).toHaveLength(1)
})

test('interface residues take the last contacting atom of each residue', () => {
  const chains = atomsByChain(COMPLEX)
  expect(
    interfaceResidues(chains.get('A') ?? [], chains.get('B') ?? []),
  ).toEqual(new Map([[1, 81.5]]))
  expect(
    interfaceResidues(chains.get('B') ?? [], chains.get('A') ?? []),
  ).toEqual(new Map([[7, 90]]))
})

test('a non-human partner takes the identity of its sequence-identical human protein', () => {
  const human = new Map([
    [
      'ABC',
      [
        {
          primaryAccession: 'P63218',
          genes: [{ geneName: { value: 'GNG5' } }],
        },
      ],
    ],
  ])
  const rat = {
    uniprotAccession: 'P63219',
    gene: 'Gng5',
    taxId: 10116,
    organismScientificName: 'Rattus norvegicus',
    sequenceChecksum: 'abc',
  }
  expect(partnerIdentity(rat, human)).toEqual({
    partner: 'P63218',
    gene: 'GNG5',
  })
  expect(partnerIdentity({ ...rat, sequenceChecksum: 'def' }, human)).toEqual({
    partner: 'P63219',
    gene: 'Gng5',
  })
  expect(
    partnerIdentity(
      { ...rat, taxId: 9606, organismScientificName: 'Homo sapiens' },
      human,
    ),
  ).toEqual({ partner: 'P63219', gene: 'Gng5' })
})

test('the top homodimer and top hetero complexes are kept only when confident', () => {
  const complex = (
    modelEntityId: string,
    assemblyType: string,
    ipsae: number | null,
  ) => ({
    modelEntityId,
    assemblyType,
    complexPredictionAccuracy_ipSAE: ipsae,
  })
  const hetero = Array.from({ length: 32 }, (_, i) =>
    complex(`H${i}`, 'Hetero', i === 31 ? 0.99 : 0.9 - i / 100),
  )
  const kept = confidentComplexes([
    complex('D1', 'Homo', 0.7),
    complex('D2', 'Homo', 0.8),
    complex('X', 'Hetero', null),
    ...hetero,
  ]).map(c => c.modelEntityId)
  expect(kept[0]).toBe('D2')
  expect(kept[1]).toBe('H31')
  expect(kept).toHaveLength(1 + 30)
  expect(kept).not.toContain('D1')
  expect(kept.at(-1)).toBe('H28')
  expect(
    confidentComplexes([
      complex('L', 'Hetero', 0.59),
      complex('M', 'Homo', 0.6),
    ]).map(c => c.modelEntityId),
  ).toEqual(['M'])
})

test('confident interfaces name partners, keep each partner once and drop low pLDDT', () => {
  const partner = (
    accession: string | null,
    gene: string | null,
    ipsae: number,
    residues: [number, number][],
  ) => ({ partner: accession, gene, ipsae, residues: new Map(residues) })
  expect(
    confidentInterfaces([
      partner('P2', null, 0.7, [
        [9, 90],
        [3, 75],
      ]),
      partner('P1', 'ABC', 0.9, [[5, 80]]),
      partner('P1', 'ABC', 0.8, [[6, 80]]),
      partner('P3', 'LOW', 0.95, [[1, 69.9]]),
    ]),
  ).toEqual({ ABC: [5], P2: [3, 9] })
})

test('bounded map keeps input order', async () => {
  const done: number[] = []
  expect(
    await boundedMap(
      [3, 1, 2],
      2,
      async n => n * 10,
      finished => done.push(finished),
    ),
  ).toEqual([30, 10, 20])
  expect(done).toEqual([1, 2, 3])
})
