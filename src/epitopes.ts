import { join } from 'node:path'

import { getJson, getText } from './cache.ts'
import { structTitle } from './illustration.ts'
import { atomsByChain, interfaceResidues } from './interfaces.ts'
import type { ChainAtom } from './interfaces.ts'
import { list, number, record, records, text, writeJson } from './json.ts'
import { DATA, OUT } from './paths.ts'

const RCSB = 'https://data.rcsb.org/rest/v1/core'
const FILES = 'https://files.rcsb.org/download'

export const STRUCTURES = [
  { accession: 'P20273', pdb: '7O52' },
  { accession: 'P20273', pdb: '5VL3' },
]

export interface Entity {
  id: string
  description: string
  chains: string[]
  toUniProt: Map<number, number>
}

export function entityOf(id: string, json: unknown, accession: string) {
  const entity = record(json)
  const regions = records(entity.rcsb_polymer_entity_align)
    .filter(
      align =>
        align.reference_database_name === 'UniProt' &&
        align.reference_database_accession === accession,
    )
    .flatMap(align => records(align.aligned_regions))
  return {
    id,
    description:
      text(record(entity.rcsb_polymer_entity).pdbx_description) ?? '',
    chains: list(
      record(entity.rcsb_polymer_entity_container_identifiers).auth_asym_ids,
    ).flatMap(chain => (typeof chain === 'string' ? [chain] : [])),
    toUniProt: new Map(
      regions.flatMap(region => {
        const from = number(region.entity_beg_seq_id) ?? 0
        const to = number(region.ref_beg_seq_id) ?? 0
        return Array.from(
          { length: number(region.length) ?? 0 },
          (_, i) => [from + i, to + i] satisfies [number, number],
        )
      }),
    ),
  } satisfies Entity
}

function runsOf(positions: number[]) {
  return positions
    .toSorted((a, b) => a - b)
    .reduce<[number, number][]>((runs, position) => {
      const last = runs.at(-1)
      return last && position === last[1] + 1
        ? [...runs.slice(0, -1), [last[0], position]]
        : [...runs, [position, position]]
    }, [])
}

function contactsWith(own: ChainAtom[], partner: ChainAtom[] | undefined) {
  return partner ? [...interfaceResidues(own, partner).keys()] : []
}

/**
 * Binder chains grouped into units, a Fab's heavy chain with the light chain
 * it touches most: each chain of the first binder entity, with the chain of
 * every other binder entity sharing the most residues with it.
 */
export function binderUnits(
  atoms: Map<string, ChainAtom[]>,
  [first, ...others]: Entity[],
) {
  return (first?.chains ?? []).map(lead => {
    const own = atoms.get(lead) ?? []
    return [
      lead,
      ...others.flatMap(entity =>
        entity.chains
          .map(chain => ({
            chain,
            size: contactsWith(own, atoms.get(chain)).length,
          }))
          .toSorted((a, b) => b.size - a.size)
          .slice(0, 1)
          .map(({ chain }) => chain),
      ),
    ]
  })
}

/**
 * For each copy of the target in the asymmetric unit, the residues within 5 Å
 * of the binder unit touching it most, in UniProt numbering. Contacts with any
 * other unit are crystal packing and only counted.
 */
export function copyContacts(
  atoms: Map<string, ChainAtom[]>,
  target: Entity,
  binders: Entity[],
) {
  const units = binderUnits(atoms, binders)
  const uniprot = (positions: number[]) =>
    [...new Set(positions)]
      .flatMap(position => target.toUniProt.get(position) ?? [])
      .toSorted((a, b) => a - b)
  return target.chains.flatMap(chain => {
    const own = atoms.get(chain)
    const touching = units
      .map(unit => ({
        unit,
        residues: uniprot(
          unit.flatMap(partner =>
            own ? contactsWith(own, atoms.get(partner)) : [],
          ),
        ),
      }))
      .toSorted((a, b) => b.residues.length - a.residues.length)
    const [paired, ...others] = touching
    return own && paired
      ? [
          {
            chain,
            binders: paired.unit,
            contacts: paired.residues,
            observed: runsOf(uniprot(own.map(atom => atom.position))),
            packing: others
              .filter(({ residues }) => residues.length > 0)
              .map(({ unit, residues }) => ({
                chains: unit,
                residues: residues.length,
              })),
          },
        ]
      : []
  })
}

async function structure({ accession, pdb }: (typeof STRUCTURES)[number]) {
  const entry = record(
    await getJson(`${RCSB}/entry/${pdb}`, join(DATA, 'pdb', `${pdb}.json`)),
  )
  const ids = list(
    record(entry.rcsb_entry_container_identifiers).polymer_entity_ids,
  ).flatMap(id => (typeof id === 'string' ? [id] : []))
  const entities = await Promise.all(
    ids.map(async id =>
      entityOf(
        id,
        await getJson(
          `${RCSB}/polymer_entity/${pdb}/${id}`,
          join(DATA, 'pdb', `${pdb}-${id}.json`),
        ),
        accession,
      ),
    ),
  )
  const target = entities.find(entity => entity.toUniProt.size > 0)
  const binders = entities.filter(entity => entity !== target)
  const cif = await getText(
    `${FILES}/${pdb}.cif`,
    join(DATA, 'pdb', `${pdb}.cif.gz`),
  )
  return {
    accession,
    pdb,
    title: structTitle(cif),
    resolution: list(record(entry.rcsb_entry_info).resolution_combined).map(
      value => number(value),
    )[0],
    target: target?.description ?? null,
    binders: binders.map(binder => binder.description),
    copies: target ? copyContacts(atomsByChain(cif), target, binders) : [],
  }
}

if (import.meta.main) {
  const results = []
  for (const entry of STRUCTURES) {
    results.push(await structure(entry))
  }
  writeJson(join(OUT, 'epitopes.json'), results, 1)
  console.log(
    JSON.stringify(
      results.map(r => ({
        ...r,
        copies: r.copies.map(c => ({ ...c, contacts: c.contacts.length })),
      })),
    ),
  )
}
