import { expect, test } from 'vitest'

import {
  blocks,
  featureRows,
  keptShare,
  lanes,
  partnerTracks,
  scale,
  spanData,
} from './maps.ts'

test('overlapping features take the next free lane', () => {
  expect(
    lanes([
      { start: 1, end: 65 },
      { start: 14, end: 53 },
      { start: 100, end: 155 },
      { start: 60, end: 70 },
    ]).map(({ item, lane }) => [item.start, lane]),
  ).toEqual([
    [1, 0],
    [14, 1],
    [60, 1],
    [100, 0],
  ])
})

test('sites and modifications draw as ticks on one lane, ranges stack', () => {
  const rows = featureRows([
    { type: 'Domain', start: 1, end: 50, description: 'A' },
    { type: 'Domain', start: 20, end: 60, description: 'B' },
    { type: 'Region', start: 1, end: 90, description: 'Interaction with X' },
    {
      type: 'Modified residue',
      start: 5,
      end: 5,
      description: 'Phosphoserine',
    },
    {
      type: 'Modified residue',
      start: 5,
      end: 5,
      description: 'Phosphothreonine',
    },
  ])
  expect(rows.map(r => [r.label, r.lanes])).toEqual([
    ['Domains', 2],
    ['Regions', 1],
    ['Modifications', 1],
  ])
})

test('residue n spans one step from the left margin, with a visible minimum width', () => {
  const s = scale(100, 1000, 100, 0)
  expect(s.step).toBe(9)
  expect(s.x(1)).toBe(100)
  expect(s.x(101)).toBe(1000)
  expect(s.width([10, 19])).toBe(90)
  expect(scale(30000).width([5, 5])).toBe(1.5)
})

test('interface residues join into blocks across small gaps', () => {
  expect(blocks([5, 1, 2, 3, 9, 20], 4)).toEqual([
    [1, 9],
    [20, 20],
  ])
  expect(spanData(blocks([1, 2, 4]))).toBe('1-2 4-4')
})

test('partners with nearly the same interface share a row, the protein itself never does', () => {
  const tracks = partnerTracks({
    gene: 'APP',
    interfaces: {
      KLK11: [1, 2, 3, 4, 5],
      KLK14: [1, 2, 3, 4, 5, 6],
      APP: [1, 2, 3, 4, 5],
      PRSS8: [40, 41],
    },
  })
  expect(tracks.map(t => t.label)).toEqual(['KLK14 +1', 'itself', 'PRSS8'])
})

test('the share of an interface present counts carried residues', () => {
  expect(keptShare([1, 2, 30, 40], [[1, 10]])).toBe(0.5)
})
