import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Disease, GeneRecord, IndexRow, Totals } from '../../src/types.ts'

const DATA = join(process.cwd(), 'site', 'data')

function read<T>(path: string): T {
  return JSON.parse(readFileSync(join(DATA, path), 'utf8'))
}

function once<T>(path: string) {
  let value: T | undefined
  return () => {
    value ??= read<T>(path)
    return value
  }
}

export const indexRows = once<IndexRow[]>('index.json')
export const totals = once<Totals>('totals.json')
export const diseases = once<Disease[]>('diseases.json')
export const gene = (page: string) => read<GeneRecord>(`genes/${page}.json`)
