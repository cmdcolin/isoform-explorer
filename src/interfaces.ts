import { join } from 'node:path'

import { getJson, getText } from './cache.ts'
import { withinDistance } from './contacts.ts'
import type { Point } from './contacts.ts'
import { number, records, text, writeJson } from './json.ts'
import { DATA, OUT } from './paths.ts'
import {
  accessionOf,
  checksumOf,
  geneOf,
  hasAlternativeIsoform,
  reviewedHuman,
} from './proteins.ts'
import type { Protein } from './proteins.ts'
import { compareText } from './sequences.ts'

const ALPHAFOLD_API = 'https://alphafold.ebi.ac.uk/api'
const HUMAN = 9606
const CONTACT = 5
const CONFIDENT = 0.6
const MIN_PLDDT = 70
const MAX_COMPLEXES = 30
const WORKERS = 8
const PROGRESS_EVERY = 250

export interface ChainAtom {
  position: number
  coord: Point
  plddt: number
}

export interface PartnerInterface {
  partner: string | null
  gene: string | null
  ipsae: number
  residues: Map<number, number>
}

function fail(message: string): never {
  throw new Error(message)
}

function numeric(value: string) {
  const parsed = Number(value)
  return value === '' || Number.isNaN(parsed)
    ? fail(`ValueError: not a number: '${value}'`)
    : parsed
}

function atomSite(cif: string) {
  const header: string[] = []
  const rows: string[][] = []
  for (const line of cif.split(/\r?\n/)) {
    if (line.startsWith('_atom_site.')) {
      header.push(line.slice('_atom_site.'.length).trim())
    } else if (header.length && line.startsWith('ATOM')) {
      rows.push(line.trim().split(/\s+/))
    }
  }
  const column = (tag: string) => {
    const index = header.indexOf(tag)
    return (row: string[]) => row[index] ?? fail(`KeyError: '${tag}'`)
  }
  return { rows, column }
}

export function atomsByChain(cif: string) {
  const { rows, column } = atomSite(cif)
  const element = column('type_symbol')
  const chain = column('auth_asym_id')
  const position = column('label_seq_id')
  const x = column('Cartn_x')
  const y = column('Cartn_y')
  const z = column('Cartn_z')
  const plddt = column('B_iso_or_equiv')
  const chains = new Map<string, ChainAtom[]>()
  for (const row of rows) {
    if (element(row) !== 'H') {
      const atom = {
        position: numeric(position(row)),
        coord: [numeric(x(row)), numeric(y(row)), numeric(z(row))],
        plddt: numeric(plddt(row)),
      } satisfies ChainAtom
      const atoms = chains.get(chain(row))
      if (atoms) {
        atoms.push(atom)
      } else {
        chains.set(chain(row), [atom])
      }
    }
  }
  return chains
}

export function interfaceResidues(own: ChainAtom[], partner: ChainAtom[]) {
  const contacts = withinDistance(
    own.map(atom => atom.coord),
    partner.map(atom => atom.coord),
    CONTACT,
  )
  const residues = new Map<number, number>()
  own.forEach((atom, i) => {
    if (contacts[i]) {
      residues.set(atom.position, atom.plddt)
    }
  })
  return residues
}

export function partnerIdentity(
  chain: Record<string, unknown> | undefined,
  byChecksum: Map<string, Protein[]>,
) {
  const accession = text(chain?.uniprotAccession) ?? null
  const organism = text(chain?.organismScientificName)
  const twins =
    byChecksum.get((text(chain?.sequenceChecksum) ?? '').toUpperCase()) ?? []
  const twin = twins.length === 1 ? twins[0] : undefined
  return number(chain?.taxId) !== HUMAN && accession && organism && twin
    ? { partner: accessionOf(twin), gene: geneOf(twin) || null }
    : { partner: accession, gene: text(chain?.gene) ?? null }
}

function ipsaeOf(complex: Record<string, unknown>) {
  return number(complex.complexPredictionAccuracy_ipSAE) || 0
}

export function confidentComplexes(complexes: Record<string, unknown>[]) {
  const top = (assemblyType: string, count: number) =>
    complexes
      .filter(complex => complex.assemblyType === assemblyType)
      .sort((a, b) => ipsaeOf(b) - ipsaeOf(a))
      .slice(0, count)
  return [...top('Homo', 1), ...top('Hetero', MAX_COMPLEXES)].filter(
    complex => ipsaeOf(complex) >= CONFIDENT,
  )
}

export function confidentInterfaces(interfaces: PartnerInterface[]) {
  const byIpsae = interfaces.toSorted((a, b) => b.ipsae - a.ipsae)
  const distinct = byIpsae.filter(
    (complex, index) =>
      complex.partner === null ||
      byIpsae.findIndex(other => other.partner === complex.partner) === index,
  )
  const byName = new Map(
    distinct.map(complex => [
      complex.gene || complex.partner || '',
      [...complex.residues]
        .filter(([, plddt]) => plddt >= MIN_PLDDT)
        .map(([position]) => position)
        .sort((a, b) => a - b),
    ]),
  )
  return Object.fromEntries(
    [...byName]
      .filter(([, residues]) => residues.length > 0)
      .sort(([a], [b]) => compareText(a, b)),
  )
}

async function complexChains(entity: string, accession: string) {
  const chains = records(
    await getJson(
      `${ALPHAFOLD_API}/prediction/${entity}`,
      join(DATA, 'models', `${entity}.json`),
    ),
  )
  const own = chains.find(chain => chain.uniprotAccession === accession)
  const partner = chains.find(chain => chain !== own)
  const cifUrl = text(own?.cifUrl)
  const atoms =
    own && partner && cifUrl
      ? atomsByChain(
          await getText(cifUrl, join(DATA, 'cif', `${entity}.cif.gz`)),
        )
      : new Map<string, ChainAtom[]>()
  return {
    own,
    partner,
    ownAtoms: atoms.get(text(own?.chainId) ?? ''),
    partnerAtoms: atoms.get(text(partner?.chainId) ?? ''),
  }
}

async function complexInterface(
  accession: string,
  complex: Record<string, unknown>,
  byChecksum: Map<string, Protein[]>,
) {
  const entity =
    text(complex.modelEntityId) ?? fail("KeyError: 'modelEntityId'")
  const { own, partner, ownAtoms, partnerAtoms } = await complexChains(
    entity,
    accession,
  )
  const offset = (number(own?.uniprotStart) || 1) - 1
  return ownAtoms && partnerAtoms
    ? [
        {
          ...partnerIdentity(partner, byChecksum),
          ipsae: ipsaeOf(complex),
          residues: new Map(
            [...interfaceResidues(ownAtoms, partnerAtoms)].map(
              ([position, plddt]) => [position + offset, plddt],
            ),
          ),
        } satisfies PartnerInterface,
      ]
    : []
}

async function proteinInterfaces(
  accession: string,
  byChecksum: Map<string, Protein[]>,
) {
  const complexes = records(
    await getJson(
      `${ALPHAFOLD_API}/complex/${accession}`,
      join(DATA, 'complexes', `${accession}.json`),
    ),
  )
  const interfaces: PartnerInterface[] = []
  for (const complex of confidentComplexes(complexes)) {
    interfaces.push(...(await complexInterface(accession, complex, byChecksum)))
  }
  return {
    accession,
    complexes: complexes.length,
    interfaces: confidentInterfaces(interfaces),
  }
}

async function attempt(accession: string, byChecksum: Map<string, Protein[]>) {
  try {
    return await proteinInterfaces(accession, byChecksum)
  } catch (error) {
    return {
      accession,
      error:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
    }
  }
}

export async function boundedMap<T, R>(
  items: T[],
  workers: number,
  work: (item: T) => Promise<R>,
  onDone: (finished: number) => void,
) {
  const results: R[] = []
  const queue = items.entries()
  let finished = 0
  await Promise.all(
    Array.from({ length: Math.max(1, workers) }, async () => {
      for (const [i, item] of queue) {
        results[i] = await work(item)
        finished += 1
        onDone(finished)
      }
    }),
  )
  return results
}

async function run(accessions: string[], byChecksum: Map<string, Protein[]>) {
  const started = Date.now()
  let failed = 0
  return boundedMap(
    accessions,
    WORKERS,
    async accession => {
      const result = await attempt(accession, byChecksum)
      failed += 'error' in result ? 1 : 0
      return result
    },
    finished => {
      if (finished % PROGRESS_EVERY === 0 || finished === accessions.length) {
        const minutes = ((Date.now() - started) / 60_000).toFixed(1)
        console.log(
          `${finished}/${accessions.length} proteins, ${failed} failed, ${minutes} min`,
        )
      }
    },
  )
}

export async function main(only: string[] = []) {
  const proteins = await reviewedHuman()
  const byChecksum = Map.groupBy(proteins, checksumOf)
  const accessions = proteins
    .filter(hasAlternativeIsoform)
    .map(accessionOf)
    .filter(accession => !only.length || only.includes(accession))
  const first = await run(accessions, byChecksum)
  const retried = await run(
    first.flatMap(r => ('error' in r ? [r.accession] : [])),
    byChecksum,
  )
  const retriedByAccession = new Map(retried.map(r => [r.accession, r]))
  const results = first.map(r => retriedByAccession.get(r.accession) ?? r)
  const done = results.flatMap(r => ('error' in r ? [] : [r]))
  const failures = results.flatMap(r => ('error' in r ? [r] : []))
  const confident = done.filter(r => Object.keys(r.interfaces).length > 0)
  const summary = {
    checked: accessions.length,
    withComplex: done.filter(r => r.complexes > 0).length,
    withConfidentInterface: confident.length,
    partners: confident.reduce(
      (sum, r) => sum + Object.keys(r.interfaces).length,
      0,
    ),
    failures,
  }
  writeJson(
    join(OUT, 'interfaces.json'),
    Object.fromEntries(confident.map(r => [r.accession, r.interfaces])),
  )
  writeJson(join(OUT, 'interfaces_summary.json'), summary, 2)
  console.log(
    `${summary.checked} proteins checked, ${summary.withComplex} with a complex, ${summary.withConfidentInterface} with a confident interface (${summary.partners} partners), ${failures.length} failed`,
  )
}

if (import.meta.main) {
  await main(process.argv.slice(2))
}
