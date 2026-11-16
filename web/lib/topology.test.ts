import { expect, test } from 'vitest'

import type { Feature } from '../../src/types.ts'
import { chainPoints } from './topology.ts'

const helix = (start: number, end: number): Feature => ({
  type: 'Transmembrane',
  start,
  end,
  description: 'Helical',
})

test('a two-helix protein starts outside, crosses twice and ends outside', () => {
  const points = chainPoints({
    length: 60,
    features: [helix(11, 30), helix(36, 55)],
  })
  const membrane = (n: number) => points[n]?.y ?? 0
  expect(points.slice(1).every(p => p.x > 0 && p.y > 0)).toBe(true)
  expect(membrane(1)).toBeLessThan(membrane(11))
  expect(membrane(30)).toBeGreaterThan(membrane(11))
  expect(membrane(33)).toBeGreaterThan(membrane(30))
  expect(membrane(55)).toBeLessThan(membrane(36))
  expect(membrane(60)).toBeLessThan(membrane(55))
  expect(points[11]?.x).toBe(points[30]?.x)
})
