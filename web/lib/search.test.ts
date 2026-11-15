import { describe, expect, test } from 'vitest'

import { lookupsFor, outcome, parseQuery, suggestions } from './search.ts'
import { href } from './site.ts'

const lookups = {
  genes: {
    TP53: ['TP53'],
    TP53BP1: ['TP53BP1'],
    TP63: ['TP63'],
    CDKN2A: ['CDKN2A_P42771', 'CDKN2A_Q8N726'],
  },
  accessions: {
    P04637: ['TP53'],
    'P04637-1': ['TP53#P04637-1'],
    'P04637-2': ['TP53#P04637-2'],
  },
  ensembl: {
    ENST00000420246: ['TP53#P04637-2'],
    ENST00000341656: ['SPDYE2B#A6NHP3-2', 'SPDYE2#Q495Y8-2'],
  },
  refseq: { NM_001126114: ['TP53#P04637-2'] },
}

describe('reading a query', () => {
  test('a transcript id loads only its own map, version and case ignored', () => {
    expect(parseQuery('  enst00000420246.6 ')).toEqual({
      kind: 'transcript',
      key: 'ENST00000420246',
      sources: ['ensembl'],
    })
    expect(parseQuery('NM_001126114.3')).toEqual({
      kind: 'transcript',
      key: 'NM_001126114',
      sources: ['refseq'],
    })
  })

  test('an accession, entry or isoform, falls back to gene symbols', () => {
    expect(parseQuery('p04637-2')).toEqual({
      kind: 'accession',
      key: 'P04637-2',
      sources: ['accessions', 'genes'],
    })
    expect(parseQuery('A0A096LP01').kind).toBe('accession')
  })

  test('anything else is a gene symbol', () => {
    expect(parseQuery('tp53')).toEqual({
      kind: 'gene',
      key: 'TP53',
      sources: ['genes'],
    })
    expect(parseQuery('C9orf72').kind).toBe('gene')
    expect(parseQuery('   ')).toEqual({ kind: 'empty' })
  })

  test('gene and protein ids are named, not looked up', () => {
    expect(parseQuery('ENSG00000141510')).toMatchObject({
      kind: 'other',
      what: 'an Ensembl gene id',
    })
    expect(parseQuery('NP_000537.3')).toMatchObject({
      kind: 'other',
      key: 'NP_000537',
    })
  })
})

describe('where a query leads', () => {
  const resolve = (raw: string) => outcome(parseQuery(raw), lookups)

  test('one target goes straight to the gene page or the isoform on it', () => {
    expect(resolve('tp53')).toEqual({ kind: 'go', href: href('gene/TP53/') })
    expect(resolve('P04637')).toEqual({ kind: 'go', href: href('gene/TP53/') })
    expect(resolve('P04637-2')).toEqual({
      kind: 'go',
      href: href('gene/TP53/#P04637-2'),
    })
    expect(resolve('ENST00000420246.6')).toEqual({
      kind: 'go',
      href: href('gene/TP53/#P04637-2'),
    })
    expect(resolve(' nm_001126114 ')).toEqual({
      kind: 'go',
      href: href('gene/TP53/#P04637-2'),
    })
  })

  test('several targets are offered as choices', () => {
    expect(resolve('ENST00000341656')).toEqual({
      kind: 'choose',
      intro: 'UniProt maps ENST00000341656 to 2 isoforms:',
      choices: [
        {
          href: href('gene/SPDYE2B/#A6NHP3-2'),
          gene: 'SPDYE2B',
          accession: undefined,
          isoform: 'A6NHP3-2',
        },
        {
          href: href('gene/SPDYE2/#Q495Y8-2'),
          gene: 'SPDYE2',
          accession: undefined,
          isoform: 'Q495Y8-2',
        },
      ],
    })
    expect(resolve('cdkn2a')).toMatchObject({
      kind: 'choose',
      intro: '2 proteins match CDKN2A:',
      choices: [
        { gene: 'CDKN2A', accession: 'P42771' },
        { gene: 'CDKN2A', accession: 'Q8N726' },
      ],
    })
  })

  test('an isoform the entry does not describe offers the entry', () => {
    expect(resolve('P04637-99')).toMatchObject({
      kind: 'choose',
      intro: 'P04637 has no isoform P04637-99. Its page:',
      choices: [{ href: href('gene/TP53/') }],
    })
  })

  test('a miss says why, a transcript miss that it is not a described isoform', () => {
    expect(resolve('ENST00000000001')).toMatchObject({
      kind: 'miss',
      reason: expect.stringContaining('UniProt does not map ENST00000000001'),
    })
    expect(resolve('Q99999')).toMatchObject({ kind: 'miss' })
    expect(resolve('NOTAGENE')).toMatchObject({
      kind: 'miss',
      reason: expect.stringContaining('gene symbol NOTAGENE'),
    })
    expect(resolve('ENSG00000141510')).toMatchObject({
      kind: 'miss',
      reason: expect.stringContaining('Ensembl gene id'),
    })
    expect(resolve('')).toEqual({ kind: 'none' })
  })
})

test('gene suggestions put the exact symbol, then shorter ones, first', () => {
  expect(suggestions('tp', lookups.genes).map(s => s.gene)).toEqual([
    'TP53',
    'TP63',
    'TP53BP1',
  ])
  expect(suggestions('cdkn', lookups.genes).map(s => s.accession)).toEqual([
    'P42771',
    'Q8N726',
  ])
  expect(suggestions(' ', lookups.genes)).toEqual([])
  expect(suggestions('t', lookups.genes, 1)).toHaveLength(1)
})

test('a later lookup file is fetched only when the earlier ones miss', async () => {
  const fetched: string[] = []
  const load = async (source: keyof typeof lookups) => {
    fetched.push(source)
    return lookups[source]
  }
  await lookupsFor(parseQuery('P04637-2'), load)
  expect(fetched).toEqual(['accessions'])
  await lookupsFor(parseQuery('Q99999'), load)
  expect(fetched).toEqual(['accessions', 'accessions', 'genes'])
  await lookupsFor(parseQuery('ENSG00000141510'), load)
  expect(fetched).toHaveLength(3)
})
