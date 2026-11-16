import {
  createReadStream,
  createWriteStream,
  existsSync,
  renameSync,
} from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { createGunzip } from 'node:zlib'

import { number, readJson, record, records, text, writeJson } from './json.ts'
import { DATA } from './paths.ts'
import { unversioned } from './sequences.ts'

const LOOKUP = 'https://rest.ensembl.org/lookup/id'
const BATCH = 1000
const ATTEMPTS = 5
const PAUSE = 1000
const LOW = 100
const PATH = join(DATA, 'ensembl_transcripts.json')
const LAYOUTS = join(DATA, 'gencode_exons.json')
const GENCODE = join(DATA, 'gencode.v49.annotation.gff3.gz')
const GENCODE_URL =
  'https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_49/gencode.v49.annotation.gff3.gz'
const GFF_TRANSCRIPT = /transcript_id=(ENST\d+)\.\d+;/
const PRIMARY = /^([1-9]|1\d|2[0-2]|X|Y|MT)$/

export type Place = [chromosome: string, start: number, end: number]

export interface Layout {
  strand: number
  coding: [start: number, end: number]
  exons: [start: number, end: number][]
}

function seconds(header: string | null, fallback: number) {
  return (number(Number(header)) ?? fallback) * 1000
}

async function lookup(
  ids: string[],
  attempt = 0,
): Promise<Record<string, unknown> | undefined> {
  const response = await fetch(LOOKUP, {
    method: 'POST',
    headers: {
      'user-agent': 'isoform-explorer',
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ ids }),
    signal: AbortSignal.timeout(300_000),
  }).catch(() => undefined)
  const remaining = number(
    Number(response?.headers.get('x-ratelimit-remaining') ?? LOW),
  )
  if (response?.ok && (remaining ?? 0) < LOW) {
    await sleep(seconds(response.headers.get('x-ratelimit-reset'), 60))
  }
  return response?.ok
    ? record(await response.json())
    : attempt + 1 < ATTEMPTS
      ? sleep(
          response?.status === 429
            ? seconds(response.headers.get('retry-after'), 60)
            : PAUSE * 2 ** attempt,
        ).then(() => lookup(ids, attempt + 1))
      : undefined
}

export function placeOf(value: unknown): Place | null {
  const found = record(value)
  const chromosome = text(found.seq_region_name)
  const start = number(found.start)
  const end = number(found.end)
  return chromosome && start !== undefined && end !== undefined
    ? [chromosome, start, end]
    : null
}

function cachedPlaces() {
  return new Map(
    Object.entries(record(existsSync(PATH) ? readJson(PATH) : {})).map(
      ([id, value]) => [id, placeOf(value)],
    ),
  )
}

export async function transcriptPlaces(ids: string[]) {
  const places = cachedPlaces()
  const missing = [...new Set(ids)].filter(id => !places.has(id)).sort()
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH)
    const found = await lookup(batch)
    if (found) {
      for (const id of batch) {
        places.set(id, placeOf(found[id]))
      }
      writeJson(PATH, Object.fromEntries(places))
    }
    await sleep(PAUSE)
  }
  return places
}

export function layoutOf(value: unknown): Layout | null {
  const found = record(value)
  const translation = record(found.Translation)
  const strand = number(found.strand)
  const start = number(translation.start)
  const end = number(translation.end)
  const exons = records(found.Exon).flatMap(exon => {
    const from = number(exon.start)
    const to = number(exon.end)
    const span: [number, number][] =
      from !== undefined && to !== undefined ? [[from, to]] : []
    return span
  })
  return strand !== undefined &&
    start !== undefined &&
    end !== undefined &&
    exons.length > 0
    ? { strand, coding: [start, end], exons }
    : null
}

export function junctionsOf({ strand, coding, exons }: Layout, length: number) {
  const ordered = exons.toSorted((a, b) =>
    strand < 0 ? b[1] - a[1] : a[0] - b[0],
  )
  const codingLengths = ordered.map(([start, end]) =>
    Math.max(0, Math.min(end, coding[1]) - Math.max(start, coding[0]) + 1),
  )
  const total = codingLengths.reduce((sum, n) => sum + n, 0)
  const first = codingLengths.findIndex(n => n > 0)
  const ends = codingLengths.map((_, i) =>
    codingLengths.slice(0, i + 1).reduce((sum, n) => sum + n, 0),
  )
  return first >= 0 && (total === length * 3 || total === (length + 1) * 3)
    ? {
        first: first + 1,
        junctions: ends.slice(first).filter(end => end < length * 3),
      }
    : null
}

export function canonicalExons(
  transcripts: string[],
  layouts: Map<string, Layout | null>,
  length: number,
) {
  return (
    transcripts
      .map(transcript => {
        const layout = layouts.get(unversioned(transcript))
        const edges = layout ? junctionsOf(layout, length) : null
        return edges && { transcript, ...edges }
      })
      .find(exons => exons !== null) ?? null
  )
}

function cachedLayouts() {
  return new Map(
    Object.entries(record(existsSync(LAYOUTS) ? readJson(LAYOUTS) : {})).map(
      ([id, value]) => [id, layoutOf(value)],
    ),
  )
}

async function gencodeFile() {
  if (!existsSync(GENCODE)) {
    const response = await fetch(GENCODE_URL)
    if (response.ok && response.body) {
      await pipeline(
        Readable.fromWeb(response.body),
        createWriteStream(`${GENCODE}.part`),
      )
      renameSync(`${GENCODE}.part`, GENCODE)
    }
  }
  return existsSync(GENCODE)
}

async function readGencode(wanted: Set<string>) {
  const found = new Map<
    string,
    { strand: number; exons: [number, number][]; coding: number[] }
  >()
  const lines = createInterface({
    input: createReadStream(GENCODE).pipe(createGunzip()),
    crlfDelay: Infinity,
  })
  for await (const line of lines) {
    const [, , type, start, end, , strand, , attributes = ''] = line.split('\t')
    const id = GFF_TRANSCRIPT.exec(attributes)?.[1]
    if ((type === 'exon' || type === 'CDS') && id && wanted.has(id)) {
      const entry = found.get(id) ?? {
        strand: strand === '-' ? -1 : 1,
        exons: [],
        coding: [],
      }
      if (type === 'exon') {
        entry.exons.push([Number(start), Number(end)])
      } else {
        entry.coding.push(Number(start), Number(end))
      }
      found.set(id, entry)
    }
  }
  return found
}

export async function transcriptLayouts(ids: string[]) {
  const layouts = cachedLayouts()
  const missing = new Set(ids.filter(id => !layouts.has(id)))
  if (missing.size > 0 && (await gencodeFile())) {
    const found = await readGencode(missing)
    for (const id of missing) {
      const entry = found.get(id)
      layouts.set(
        id,
        entry && entry.coding.length > 0
          ? {
              strand: entry.strand,
              coding: [Math.min(...entry.coding), Math.max(...entry.coding)],
              exons: entry.exons,
            }
          : null,
      )
    }
    writeJson(
      LAYOUTS,
      Object.fromEntries(
        [...layouts].map(([id, layout]) => [
          id,
          layout && {
            strand: layout.strand,
            Translation: { start: layout.coding[0], end: layout.coding[1] },
            Exon: layout.exons.map(([start, end]) => ({ start, end })),
          },
        ]),
      ),
    )
  }
  return layouts
}

export function locusOf(places: (Place | null | undefined)[]) {
  const primary = places.flatMap(place =>
    place && PRIMARY.test(place[0]) ? [place] : [],
  )
  const chromosomes = new Set(primary.map(([chromosome]) => chromosome))
  const [chromosome] = chromosomes
  return chromosome !== undefined && chromosomes.size === 1
    ? `chr${chromosome === 'MT' ? 'M' : chromosome}:${Math.min(...primary.map(([, start]) => start))}-${Math.max(...primary.map(([, , end]) => end))}`
    : null
}
