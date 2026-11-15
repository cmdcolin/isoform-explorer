import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { expect, test } from 'vitest'

import { trickle } from './trickle.ts'
import type { Pace } from './trickle.ts'

const PACE: Pace = {
  pause: 2,
  slowdown: 2,
  maxPause: 5,
  rest: 100,
  maxRest: 250,
  stallAfter: 3,
  retries: 2,
  errorPause: 30,
  batch: 2,
}

function server(statuses: Record<string, number[]>) {
  return async (url: string | URL) => {
    const status = statuses[String(url)]?.shift() ?? 200
    return status === 0
      ? undefined
      : new Response(status === 200 ? `cif ${url}` : '', { status })
  }
}

function downloads(...names: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'trickle-'))
  return names.map(name => ({ url: name, path: join(dir, `${name}.cif.gz`) }))
}

test('a throttled download rests, slows the pace and is fetched again', async () => {
  const waits: number[] = []
  const batches: string[][] = []
  const files = downloads('a', 'b', 'c')
  const outcome = await trickle(
    files,
    PACE,
    batch => {
      batches.push(batch.map(d => d.url))
    },
    server({ b: [429, 403] }),
    async ms => waits.push(ms),
  )
  expect(waits).toEqual([2, 100, 200, 5, 5])
  expect(batches).toEqual([['a', 'b'], ['c']])
  expect(outcome).toMatchObject({ pause: 5, throttles: 2, stalled: false })
  expect(gunzipSync(readFileSync(files[1]?.path ?? '')).toString()).toBe(
    'cif b',
  )
})

test('a server that keeps refusing stalls the trickle and leaves the rest pending', async () => {
  const files = downloads('a', 'b', 'c')
  const outcome = await trickle(
    files,
    PACE,
    () => undefined,
    server({ b: [429, 429, 429] }),
    async () => undefined,
  )
  expect(outcome.stalled).toBe(true)
  expect(outcome.remaining.map(d => d.url)).toEqual(['b', 'c'])
  expect(existsSync(files[1]?.path ?? '')).toBe(false)
})

test('an absent file is listed as missing and repeated errors as failed, neither cached', async () => {
  const files = downloads('a', 'b', 'c')
  const outcome = await trickle(
    files,
    PACE,
    () => undefined,
    server({ a: [404], b: [500, 0] }),
    async () => undefined,
  )
  expect(outcome.missing.map(d => d.url)).toEqual(['a'])
  expect(outcome.failed.map(d => d.url)).toEqual(['b'])
  expect(files.map(d => existsSync(d.path))).toEqual([false, false, true])
})
