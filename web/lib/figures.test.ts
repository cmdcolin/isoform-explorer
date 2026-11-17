import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test } from 'vitest'

import { acceptorFigure, acceptors } from './acceptor-figure.ts'
import { activeSiteFigure } from './active-site-figure.ts'
import { gene } from './data.ts'
import { expressionOf } from './expression.ts'
import { CD19_REPORTED, CEBPB_MRNA, CEBPB_NAMES } from './posts-data.ts'
import { cd19Transcripts } from './cd19.ts'
import { sashimiFigure } from './sashimi-figure.ts'
import { startCodons } from './start-codons-figure.ts'
import {
  residuesOfExon,
  transcriptSetsFigure,
} from './transcript-sets-figure.ts'

const window = JSON.parse(
  readFileSync(
    join(process.cwd(), 'web', 'content', 'blog', 'data', 'ndufc2-exon2.json'),
    'utf8',
  ),
)

test('NDUFC2 isoform 4 starts exon 2 at a second acceptor 69 bases in', () => {
  const sites = acceptors(gene('NDUFC2'), 'O95298-2')
  expect(sites?.exonNumber).toBe(2)
  expect((sites?.canonical ?? 0) - (sites?.isoform ?? 0)).toBe(69)
  expect(sites?.codingBefore).toBe(166)
})

test('the bases between the acceptors translate to the residues UniProt removes', () => {
  const svg = acceptorFigure(gene('NDUFC2'), 'O95298-2', window, [56, 75])
  expect(svg).toContain('69 bases, 23 codons: residues 56–78')
})

test('a window whose bases do not translate to the removed residues is refused', () => {
  const shifted = {
    ...window,
    sequence: `${window.sequence.slice(0, 25)}${window.sequence.slice(25).replaceAll('T', 'G')}`,
  }
  expect(() =>
    acceptorFigure(gene('NDUFC2'), 'O95298-2', shifted, [56, 75]),
  ).toThrow(/translated/)
})

test('the ZDHHC16 drawing puts the palmitate on the active-site cysteine', () => {
  const svg = activeSiteFigure(gene('ZDHHC16'), 'Q969W1-3', 'DHHC')
  expect(svg).toContain('palmitate on C185')
  expect(svg.match(/class="bead motif"/g)).toHaveLength(4)
})

test('an isoform that keeps the active site has no drawing', () => {
  expect(() => activeSiteFigure(gene('ZDHHC16'), 'Q969W1-2', 'DHHC')).toThrow()
})

test('CEBPB start codons derived from UniProt land on the AUGs RefSeq marks', () => {
  const forms = startCodons(gene('CEBPB'), CEBPB_MRNA, CEBPB_NAMES)
  expect(forms.map(f => [f.name, f.base])).toEqual([
    ['LAP*', 452],
    ['LAP', 521],
    ['LIP', 1046],
  ])
})

test('the APP sashimi plot joins exon 6 to exon 7 for APP770 and to exon 9 for APP695', () => {
  const svg = sashimiFigure(gene('APP'), expressionOf('P05067-4'), {
    title: 'APP',
    names: { canonical: 'APP770', isoform: 'APP695' },
    exons: [6, 9],
    absent: ['absent from APP695'],
    tissues: new Map([['Liver', 'Liver']]),
  })
  expect(svg).toContain('APP770: exon 6 → exon 7 → exon 8 → exon 9')
  expect(svg).toContain('APP695: exon 6 → exon 9')
  expect(svg).toContain('27,078 reads')
  expect(svg).toContain('384 reads')
  expect(svg.match(/class="absent"/g)).toHaveLength(5)
})

test('the NDUFC2 sashimi plot lands isoform 4 69 bases into exon 2, skipping only coding bases', () => {
  const svg = sashimiFigure(gene('NDUFC2'), expressionOf('O95298-2'), {
    title: 'NDUFC2',
    names: { canonical: 'canonical', isoform: 'isoform 4' },
    exons: [1, 2],
    absent: ['absent from isoform 4'],
    tissues: new Map([['Liver', 'Liver']]),
  })
  expect(svg).toContain('Isoform 4: exon 1 → 69 bases into exon 2')
  expect(svg).toContain('1 read<')
  expect(svg.match(/class="absent"/g)).toHaveLength(3)
})

test('the ZDHHC16 sashimi plot hatches exon 6 and the first 88 bases of exon 7', () => {
  const svg = sashimiFigure(gene('ZDHHC16'), expressionOf('Q969W1-3'), {
    title: 'ZDHHC16',
    names: { canonical: 'canonical', isoform: 'isoform 3' },
    exons: [5, 8],
    absent: ['absent from isoform 3'],
    tissues: new Map([['Muscle - Skeletal', 'Skeletal muscle']]),
  })
  expect(svg).toContain('Isoform 3: exon 5 → 88 bases into exon 7')
  expect(svg.match(/class="absent"/g)).toHaveLength(5)
})

test('the PKM sashimi plot draws all four junctions of the mutually exclusive exons', () => {
  const svg = sashimiFigure(gene('PKM'), expressionOf('P14618-2'), {
    title: 'PKM',
    names: { canonical: 'M2', isoform: 'M1' },
    exons: [8, 11],
    tissues: new Map([['Muscle - Skeletal', 'Skeletal muscle']]),
  })
  expect(svg).toContain('M2: exon 8 → exon 10 → exon 11')
  expect(svg).toContain('M1: exon 8 → exon 9 → exon 11')
  expect(svg).toContain('2,057,669 reads')
  expect(svg.match(/class="exon only"/g)).toHaveLength(3)
})

test('the F2RL2 sashimi plot marks both start codons and draws exon 2 in part', () => {
  const svg = sashimiFigure(gene('F2RL2'), expressionOf('O00254-2'), {
    title: 'F2RL2',
    names: { canonical: 'canonical', isoform: 'isoform 2' },
    exons: [1, 2],
    longest: 320,
    starts: { canonical: 'M1', isoform: 'M23' },
    tissues: new Map([['Nerve - Tibial', 'Tibial nerve']]),
  })
  expect(svg).toContain(
    'Isoform 2: 130 bases before the end of exon 1 → exon 2',
  )
  expect(svg).toContain('first 320 of 3,161 bases')
  expect(svg).toContain('text-anchor="end">M1<')
  expect(svg).toContain('text-anchor="start">M23<')
  expect(svg.match(/class="absent"/g)).toHaveLength(3)
})

test('exon 2 of CD19 encodes residues 30 to 119, and the figure draws them lost', () => {
  const record = gene('CD19')
  const [from, to] = residuesOfExon(record.exons?.junctions ?? [], 2)
  expect([from, to]).toEqual([30, 119])
  const svg = transcriptSetsFigure(
    record,
    cd19Transcripts().transcripts,
    2,
    CD19_REPORTED,
  )
  expect(svg).toContain('exon 2: 267 nt, in frame, left out')
  expect(svg).toContain('556 residues, 90 lost without exon 2')
  expect(svg).toContain('466 residues, in frame')
  expect(svg.indexOf('without exon 2')).toBeLessThan(
    svg.indexOf('What the lists hold'),
  )
})
