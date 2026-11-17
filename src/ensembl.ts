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

import {
  list,
  number,
  readJson,
  record,
  records,
  text,
  writeJson,
} from './json.ts'
import { DATA } from './paths.ts'
import { unversioned } from './sequences.ts'
import type { Layout, Structure, TranscriptType } from './types.ts'

const LOOKUP = 'https://rest.ensembl.org/lookup/id'
const BATCH = 1000
const ATTEMPTS = 5
const PAUSE = 1000
const LOW = 100
const PATH = join(DATA, 'ensembl_transcripts.json')
const LAYOUTS = join(DATA, 'gencode_exons.json')
const TYPES = join(DATA, 'gencode_types.json')
const GENE_TRANSCRIPTS = join(DATA, 'gencode_gene_transcripts.json')
const GENCODE = join(DATA, 'gencode.v49.annotation.gff3.gz')
const GENCODE_URL =
  'https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_49/gencode.v49.annotation.gff3.gz'
const GFF_TRANSCRIPT = /transcript_id=(ENST\d+)\.\d+;/
const GFF_GENE = /gene_id=(ENSG\d+)\.\d+/
const CODING = 'protein_coding'
const PRIMARY = /^([1-9]|1\d|2[0-2]|X|Y|MT)$/

export type Place = [chromosome: string, start: number, end: number]

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

export function cachedPlace(value: unknown) {
  const [seq_region_name, start, end] = list(value)
  return placeOf({ seq_region_name, start, end })
}

function cachedPlaces() {
  return new Map(
    Object.entries(record(existsSync(PATH) ? readJson(PATH) : {})).map(
      ([id, value]) => [id, cachedPlace(value)],
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

/** Exons in transcript order with their coding bases and the coding nucleotides before them. */
export function codingParts({ strand, coding, exons }: Layout) {
  let before = 0
  return exons
    .toSorted((a, b) => strand * (a[0] - b[0]))
    .map((exon, i) => {
      const start = Math.max(exon[0], coding[0])
      const end = Math.min(exon[1], coding[1])
      const part =
        start <= end
          ? { bases: [start, end] satisfies [number, number], from: before }
          : null
      before += part ? end - start + 1 : 0
      return { exon, number: i + 1, coding: part }
    })
}

export function junctionsOf(layout: Layout, length: number) {
  const parts = codingParts(layout)
  const coded = parts.flatMap(({ coding }) => (coding ? [coding] : []))
  const last = coded.at(-1)
  const total = last ? last.from + last.bases[1] - last.bases[0] + 1 : 0
  return total === length * 3 || total === (length + 1) * 3
    ? {
        first: parts.findIndex(({ coding }) => coding !== null) + 1,
        junctions: coded
          .slice(1)
          .map(({ from }) => from)
          .filter(from => from < length * 3),
      }
    : null
}

function bases(exons: Layout['exons']) {
  return exons.reduce((sum, [start, end]) => sum + end - start + 1, 0)
}

function sharedBases(a: Layout['exons'], b: Layout['exons']) {
  return a.reduce(
    (sum, [start, end]) =>
      sum +
      b.reduce(
        (inner, [from, to]) =>
          inner + Math.max(0, Math.min(end, to) - Math.max(start, from) + 1),
        0,
      ),
    0,
  )
}

export function structureOf(
  transcripts: string[],
  layouts: Map<string, Layout | null>,
  length: number,
  like: Structure | null,
) {
  const fitting = transcripts.flatMap(transcript => {
    const layout = layouts.get(unversioned(transcript))
    return layout && junctionsOf(layout, length)
      ? [
          {
            structure: {
              transcript,
              ...layout,
              exons: layout.exons.toSorted((a, b) => a[0] - b[0]),
            },
            score: like
              ? 2 * sharedBases(layout.exons, like.exons) - bases(layout.exons)
              : 0,
          },
        ]
      : []
  })
  return (
    fitting.reduce<(typeof fitting)[number] | null>(
      (best, next) => (best && best.score >= next.score ? best : next),
      null,
    )?.structure ?? null
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

export function gencodeType(attributes: string) {
  const type = /(?:^|;)transcript_type=([^;]+)/.exec(attributes)?.[1]
  const tags = /(?:^|;)tag=([^;]+)/.exec(attributes)?.[1]?.split(',') ?? []
  return type
    ? {
        type,
        complete:
          !tags.includes('cds_start_NF') && !tags.includes('cds_end_NF'),
      }
    : null
}

export function typeOf(value: unknown) {
  const found = record(value)
  const type = text(found.type)
  return type ? { type, complete: found.complete === true } : null
}

async function readTypes(wanted: Set<string>) {
  const found = new Map<string, TranscriptType>()
  const lines = createInterface({
    input: createReadStream(GENCODE).pipe(createGunzip()),
    crlfDelay: Infinity,
  })
  for await (const line of lines) {
    const [, , type, , , , , , attributes = ''] = line.split('\t')
    const id = type === 'transcript' && GFF_TRANSCRIPT.exec(attributes)?.[1]
    const transcript = id && wanted.has(id) ? gencodeType(attributes) : null
    if (id && transcript) {
      found.set(id, transcript)
    }
  }
  return found
}

/**
 * Versionless ENSG to the versionless ENST ids GENCODE 49 types
 * `protein_coding` for it with a complete coding sequence, from one pass over
 * the GFF3. A transcript tagged `cds_start_NF` or `cds_end_NF` is left out: its
 * ends are unknown, so it is not an alternative protein to count. Read whole
 * rather than by a wanted set, since a gene's count only means something when
 * every transcript of it is counted.
 */
export async function codingTranscripts() {
  if (existsSync(GENE_TRANSCRIPTS)) {
    return new Map(
      Object.entries(record(readJson(GENE_TRANSCRIPTS))).map(([gene, ids]) => [
        gene,
        Array.isArray(ids) ? ids.map(id => String(id)) : [],
      ]),
    )
  }
  const found = new Map<string, string[]>()
  if (await gencodeFile()) {
    const lines = createInterface({
      input: createReadStream(GENCODE).pipe(createGunzip()),
      crlfDelay: Infinity,
    })
    for await (const line of lines) {
      const [, , type, , , , , , attributes = ''] = line.split('\t')
      const transcript =
        type === 'transcript' ? GFF_TRANSCRIPT.exec(attributes)?.[1] : undefined
      const gene = transcript ? GFF_GENE.exec(attributes)?.[1] : undefined
      const typed = transcript ? gencodeType(attributes) : null
      if (transcript && gene && typed?.type === CODING && typed.complete) {
        found.set(gene, [...(found.get(gene) ?? []), transcript])
      }
    }
    writeJson(GENE_TRANSCRIPTS, Object.fromEntries(found))
  }
  return found
}

export async function transcriptTypes(ids: string[]) {
  const types = new Map(
    Object.entries(record(existsSync(TYPES) ? readJson(TYPES) : {})).map(
      ([id, value]) => [id, typeOf(value)],
    ),
  )
  const missing = new Set(ids.filter(id => !types.has(id)))
  if (missing.size > 0 && (await gencodeFile())) {
    const found = await readTypes(missing)
    for (const id of missing) {
      types.set(id, found.get(id) ?? null)
    }
    writeJson(TYPES, Object.fromEntries(types))
  }
  return types
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
