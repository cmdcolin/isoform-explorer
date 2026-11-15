import { setTimeout as sleep } from 'node:timers/promises'
import { gzipSync } from 'node:zlib'

import { fetchOnce, THROTTLED } from './cache.ts'
import { writeAtomically } from './json.ts'

export interface Download {
  url: string
  path: string
}

export interface Pace {
  pause: number
  slowdown: number
  maxPause: number
  rest: number
  maxRest: number
  stallAfter: number
  retries: number
  errorPause: number
  batch: number
}

export const FILE_SERVER_PACE: Pace = {
  pause: 2_000,
  slowdown: 1.5,
  maxPause: 60_000,
  rest: 300_000,
  maxRest: 1_200_000,
  stallAfter: 8,
  retries: 3,
  errorPause: 30_000,
  batch: 25,
}

export async function trickle(
  downloads: Download[],
  pace: Pace,
  onBatch: (done: Download[], pause: number) => Promise<void> | void,
  get = fetchOnce,
  wait: (ms: number) => Promise<unknown> = sleep,
) {
  let pause = pace.pause
  let throttles = 0
  let refusedInARow = 0
  let batch: Download[] = []
  const missing: Download[] = []
  const failed: Download[] = []
  const remaining: Download[] = []
  const stalled = () => refusedInARow >= pace.stallAfter
  for (const download of downloads) {
    let settled = false
    let errors = 0
    while (!settled && !stalled()) {
      const response = await get(download.url)
      if (response?.ok) {
        writeAtomically(
          download.path,
          gzipSync(new Uint8Array(await response.arrayBuffer())),
        )
        settled = true
        refusedInARow = 0
        batch.push(download)
        if (batch.length >= pace.batch) {
          await onBatch(batch, pause)
          batch = []
        }
        await wait(pause)
      } else if (THROTTLED.includes(response?.status ?? 0)) {
        throttles += 1
        refusedInARow += 1
        pause = Math.min(pause * pace.slowdown, pace.maxPause)
        const rest = Math.min(pace.rest * refusedInARow, pace.maxRest)
        console.log(
          `HTTP ${response?.status} on ${download.url}: resting ${rest / 60_000} min, then one request every ${pause / 1000} s`,
        )
        await wait(rest)
      } else if (response?.status === 404) {
        settled = true
        missing.push(download)
        await wait(pause)
      } else {
        errors += 1
        settled = errors >= pace.retries
        if (settled) {
          failed.push(download)
        }
        await wait(Math.max(pause, pace.errorPause))
      }
    }
    if (!settled) {
      remaining.push(download)
    }
  }
  await onBatch(batch, pause)
  return { pause, throttles, stalled: stalled(), remaining, missing, failed }
}
