import { createReadStream, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { hasAlternative, plddtPath, roundedScores } from './isoforms.ts'
import { list, number, readJson, writeJson } from './json.ts'
import { DATA } from './paths.ts'
import { accessionOf, isoformEntries } from './uniprot.ts'

const BLOCK = 512
const MEMBER = /^AF-(.+)-F1-model_v(\d+)\.cif\.gz$/

function field(header: Uint8Array, start: number, length: number) {
  return new TextDecoder()
    .decode(header.subarray(start, start + length))
    .replace(/\0.*$/s, '')
}

export function headerOf(header: Uint8Array) {
  const prefix = field(header, 345, 155)
  const name = field(header, 0, 100)
  return {
    name: prefix ? `${prefix}/${name}` : name,
    size: Number.parseInt(field(header, 124, 12).trim() || '0', 8),
    end: header.every(byte => byte === 0),
  }
}

export async function* tarMembers(
  chunks: AsyncIterable<Uint8Array>,
  wanted: (name: string) => boolean,
) {
  let buffer: Uint8Array = new Uint8Array(0)
  let skip = 0
  let done = false
  for await (const chunk of chunks) {
    buffer = Buffer.concat([buffer, chunk])
    let progressing = !done
    while (progressing) {
      if (skip > 0) {
        const dropped = Math.min(skip, buffer.length)
        skip -= dropped
        buffer = buffer.subarray(dropped)
        progressing = buffer.length > 0
      } else if (buffer.length < BLOCK) {
        progressing = false
      } else {
        const header = headerOf(buffer.subarray(0, BLOCK))
        const padded = Math.ceil(header.size / BLOCK) * BLOCK
        if (header.end) {
          done = true
          progressing = false
        } else if (!wanted(header.name)) {
          buffer = buffer.subarray(BLOCK)
          skip = padded
        } else if (buffer.length >= BLOCK + padded) {
          yield {
            name: header.name,
            data: buffer.slice(BLOCK, BLOCK + header.size),
          }
          buffer = buffer.subarray(BLOCK + padded)
        } else {
          progressing = false
        }
      }
    }
  }
}

const METRIC = '_ma_qa_metric_local.'

export function cifPlddt(cif: string) {
  const lines = cif.split('\n').map(line => line.trim())
  const first = lines.findIndex(line => line.startsWith(METRIC))
  const after = first < 0 ? [] : lines.slice(first)
  const width = after.findIndex(line => !line.startsWith(METRIC))
  const columns = after.slice(0, width).map(line => line.slice(METRIC.length))
  const body = after.slice(width)
  const stop = body.findIndex(line => /^(#|_|loop_)/.test(line))
  const residue = columns.indexOf('label_seq_id')
  const value = columns.indexOf('metric_value')
  return body
    .slice(0, stop < 0 ? body.length : stop)
    .map(line => line.split(/\s+/))
    .map((row): [number, number] => [Number(row[residue]), Number(row[value])])
    .sort(([a], [b]) => a - b)
    .map(([, score]) => score)
}

async function* partChunks(directory: string) {
  const parts = readdirSync(directory)
    .filter(name => /^part-\d+$/.test(name))
    .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
  for (const part of parts) {
    for await (const chunk of createReadStream(join(directory, part))) {
      if (chunk instanceof Uint8Array) {
        yield chunk
      }
    }
  }
}

function cachedScores(path: string) {
  return list(readJson(path)).flatMap(score => number(score) ?? [])
}

async function main(directory = join(DATA, 'proteome')) {
  const needed = new Set(
    (await isoformEntries()).filter(hasAlternative).map(accessionOf),
  )
  const wanted = (name: string) => needed.has(MEMBER.exec(name)?.[1] ?? '')
  const tally = {
    written: 0,
    compared: 0,
    equal: 0,
    versions: new Set<string>(),
  }
  for await (const member of tarMembers(partChunks(directory), wanted)) {
    const [, accession = '', version = ''] = MEMBER.exec(member.name) ?? []
    const path = plddtPath(`AF-${accession}-F1`)
    const scores = roundedScores(
      cifPlddt(new TextDecoder().decode(gunzipSync(member.data))),
    )
    tally.versions.add(version)
    if (existsSync(path)) {
      const cached = cachedScores(path)
      tally.compared += 1
      if (
        cached.length === scores.length &&
        cached.every((score, i) => score === scores[i])
      ) {
        tally.equal += 1
      } else {
        console.log(`${accession}: tar pLDDT differs from the cached doc`)
      }
    } else {
      writeJson(path, scores)
      tally.written += 1
    }
  }
  console.log(
    `${tally.written} pLDDT written; ${tally.equal} of ${tally.compared} cached equal; model versions ${[...tally.versions].join(', ')}`,
  )
}

if (import.meta.main) {
  await main(...process.argv.slice(2))
}
