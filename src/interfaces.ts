import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

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
import { FILE_SERVER_PACE, trickle } from './trickle.ts'
import type { Download } from './trickle.ts'

const ALPHAFOLD_API = 'https://alphafold.ebi.ac.uk/api'
const HUMAN = 9606
export const CONTACT = 5
export const CONFIDENT = 0.6
export const MIN_PLDDT = 70
const MAX_COMPLEXES = 30
const WORKERS = 8
const FILE_SERVER_QUIET = 15 * 60_000
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

async function complexInterface(
  accession: string,
  complex: Record<string, unknown>,
  byChecksum: Map<string, Protein[]>,
) {
  const entity =
    text(complex.modelEntityId) ?? fail("KeyError: 'modelEntityId'")
  const chains = records(
    await getJson(
      `${ALPHAFOLD_API}/prediction/${entity}`,
      join(DATA, 'models', `${entity}.json`),
    ),
  )
  const own = chains.find(chain => chain.uniprotAccession === accession)
  const partner = chains.find(chain => chain !== own)
  const url = text(own?.cifUrl)
  const path = join(DATA, 'cif', `${entity}.cif.gz`)
  const modelled = own && partner && url
  const cached = existsSync(path)
  const atoms =
    modelled && cached
      ? atomsByChain(await getText(url, path))
      : new Map<string, ChainAtom[]>()
  const ownAtoms = atoms.get(text(own?.chainId) ?? '')
  const partnerAtoms = atoms.get(text(partner?.chainId) ?? '')
  const offset = (number(own?.uniprotStart) || 1) - 1
  return {
    interfaces:
      ownAtoms && partnerAtoms
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
        : [],
    pending: modelled && !cached ? [{ url, path } satisfies Download] : [],
  }
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
  const measured = []
  for (const complex of confidentComplexes(complexes)) {
    measured.push(await complexInterface(accession, complex, byChecksum))
  }
  return {
    accession,
    complexes: complexes.length,
    interfaces: confidentInterfaces(measured.flatMap(m => m.interfaces)),
    pending: measured.flatMap(m => m.pending),
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

type Result = Awaited<ReturnType<typeof attempt>>

export async function boundedMap<T, R>(
  items: T[],
  workers: number,
  work: (item: T) => Promise<R>,
  onDone: (finished: number) => void = () => undefined,
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

function replaced(results: Result[], updates: Result[]) {
  const byAccession = new Map(updates.map(r => [r.accession, r]))
  return results.map(r => byAccession.get(r.accession) ?? r)
}

interface FileServer {
  stage: 'api' | 'trickle' | 'done' | 'stalled'
  pause?: number
  throttles?: number
  missing: Download[]
  failed: Download[]
}

function writeOutputs(results: Result[], files: FileServer) {
  const done = results.flatMap(r => ('error' in r ? [] : [r]))
  const confident = done.filter(r => Object.keys(r.interfaces).length > 0)
  const missing = new Set(files.missing.map(d => d.path))
  const waiting = done.map(r => r.pending.filter(d => !missing.has(d.path)))
  const summary = {
    checked: results.length,
    withComplex: done.filter(r => r.complexes > 0).length,
    withConfidentInterface: confident.length,
    partners: confident.reduce(
      (sum, r) => sum + Object.keys(r.interfaces).length,
      0,
    ),
    pendingProteins: waiting.filter(pending => pending.length > 0).length,
    pendingCifs: new Set(waiting.flat().map(d => d.path)).size,
    files: {
      ...files,
      missing: files.missing.map(d => d.url),
      failed: files.failed.map(d => d.url),
    },
    failures: results.flatMap(r => ('error' in r ? [r] : [])),
  }
  writeJson(
    join(OUT, 'interfaces.json'),
    Object.fromEntries(confident.map(r => [r.accession, r.interfaces])),
  )
  writeJson(join(OUT, 'interfaces_summary.json'), summary, 2)
  console.log(
    `${summary.checked} proteins checked, ${summary.withComplex} with a complex, ${summary.withConfidentInterface} with a confident interface (${summary.partners} partners), ${summary.pendingProteins} waiting on ${summary.pendingCifs} CIFs, ${summary.failures.length} failed`,
  )
}

export async function main(args: string[] = []) {
  const started = Date.now()
  const only = args.filter(arg => !arg.startsWith('--'))
  const proteins = await reviewedHuman()
  const byChecksum = Map.groupBy(proteins, checksumOf)
  const accessions = proteins
    .filter(hasAlternativeIsoform)
    .map(accessionOf)
    .filter(accession => !only.length || only.includes(accession))
  const first = await run(accessions, byChecksum)
  let results = replaced(
    first,
    await run(
      first.flatMap(r => ('error' in r ? [r.accession] : [])),
      byChecksum,
    ),
  )
  writeOutputs(results, { stage: 'api', missing: [], failed: [] })
  if (!args.includes('--api-only')) {
    const downloads = [
      ...new Map(
        results
          .flatMap(r => ('error' in r ? [] : r.pending))
          .map(d => [d.path, d]),
      ).values(),
    ]
    await sleep(Math.max(0, started + FILE_SERVER_QUIET - Date.now()))
    console.log(`fetching ${downloads.length} CIFs one at a time`)
    let fetched = 0
    const outcome = await trickle(
      downloads,
      FILE_SERVER_PACE,
      async (batch, pause) => {
        const paths = new Set(batch.map(d => d.path))
        const affected = results.flatMap(r =>
          !('error' in r) && r.pending.some(d => paths.has(d.path))
            ? [r.accession]
            : [],
        )
        results = replaced(
          results,
          await boundedMap(affected, WORKERS, accession =>
            attempt(accession, byChecksum),
          ),
        )
        fetched += batch.length
        console.log(
          `${fetched}/${downloads.length} CIFs, one every ${pause / 1000} s, ${((Date.now() - started) / 60_000).toFixed(1)} min`,
        )
        writeOutputs(results, {
          stage: 'trickle',
          pause,
          missing: [],
          failed: [],
        })
      },
    )
    writeOutputs(results, {
      stage: outcome.stalled ? 'stalled' : 'done',
      pause: outcome.pause,
      throttles: outcome.throttles,
      missing: outcome.missing,
      failed: outcome.failed,
    })
  }
}

if (import.meta.main) {
  await main(process.argv.slice(2))
}
