import { describe, expect, it } from 'vitest'

import { definingJunctions, readsBySample, tissueKey } from './expression.ts'
import type { Structure } from './types.ts'

function structure(strand: number, exons: [number, number][]): Structure {
  return {
    transcript: 'ENST1.1',
    strand,
    coding: [exons[0]?.[0] ?? 0, exons.at(-1)?.[1] ?? 0],
    exons,
  }
}

function gene(canonical: Structure, isoform: Structure) {
  return {
    canonical: { accession: 'P1-1' },
    locus: 'chr1:1-1000',
    structures: { 'P1-1': canonical, 'P1-2': isoform },
  }
}

describe('definingJunctions', () => {
  it('pairs an exon skip with the canonical intron from the same donor', () => {
    const canonical = structure(1, [
      [100, 200],
      [300, 400],
      [500, 600],
    ])
    const skipping = structure(1, [
      [100, 200],
      [500, 600],
    ])
    expect(definingJunctions(gene(canonical, skipping), 'P1-2')).toEqual({
      chromosome: 'chr1',
      isoform: [201, 499],
      canonical: [201, 299],
      shared: 'donor',
    })
  })

  it('reads the donor at the high end on the minus strand', () => {
    const canonical = structure(-1, [
      [100, 200],
      [300, 400],
    ])
    const later = structure(-1, [
      [100, 250],
      [300, 400],
    ])
    expect(definingJunctions(gene(canonical, later), 'P1-2')).toMatchObject({
      isoform: [251, 299],
      canonical: [201, 299],
      shared: 'donor',
    })
  })

  it('falls back to a shared acceptor, and finds nothing for the canonical', () => {
    const canonical = structure(-1, [
      [100, 200],
      [300, 400],
    ])
    const later = structure(-1, [
      [100, 200],
      [350, 400],
    ])
    expect(definingJunctions(gene(canonical, later), 'P1-2')).toMatchObject({
      isoform: [201, 349],
      shared: 'acceptor',
    })
    expect(
      definingJunctions(gene(canonical, canonical), 'P1-2'),
    ).toBeUndefined()
  })
})

it('parses Snaptron sample counts and matches GTEx tissue names', () => {
  expect(readsBySample(',12:3,40:1')).toEqual([
    [12, 3],
    [40, 1],
  ])
  expect(tissueKey('Cells - EBV-transformed lymphocytes')).toBe(
    tissueKey('Cells_EBV-transformed_lymphocytes'),
  )
})
