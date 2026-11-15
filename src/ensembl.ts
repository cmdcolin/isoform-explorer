import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import { number, readJson, record, text, writeJson } from './json.ts'
import { DATA } from './paths.ts'

const LOOKUP = 'https://rest.ensembl.org/lookup/id'
const BATCH = 1000
const ATTEMPTS = 5
const PAUSE = 1000
const LOW = 100
const PATH = join(DATA, 'ensembl_transcripts.json')
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
