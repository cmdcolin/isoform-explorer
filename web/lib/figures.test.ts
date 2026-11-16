import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test } from 'vitest'

import { acceptorFigure, acceptors } from './acceptor-figure.ts'
import { activeSiteFigure } from './active-site-figure.ts'
import { gene } from './data.ts'
import { expressionOf } from './expression.ts'
import { CEBPB_MRNA, CEBPB_NAMES } from './posts-data.ts'
import { sashimiFigure } from './sashimi-figure.ts'
import { startCodons } from './start-codons-figure.ts'

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
  expect(svg).toContain('APP770 junction, exon 6 → exon 7')
  expect(svg).toContain('APP695 junction, exon 6 → exon 9')
  expect(svg).toContain('27,078 reads')
  expect(svg).toContain('384 reads')
  expect(svg.match(/class="absent"/g)).toHaveLength(4)
})

test('the NDUFC2 sashimi plot lands isoform 4 69 bases into exon 2, skipping only coding bases', () => {
  const svg = sashimiFigure(gene('NDUFC2'), expressionOf('O95298-2'), {
    title: 'NDUFC2',
    names: { canonical: 'Canonical', isoform: 'Isoform 4' },
    exons: [1, 2],
    absent: ['absent from isoform 4'],
    tissues: new Map([['Liver', 'Liver']]),
  })
  expect(svg).toContain('Isoform 4 junction, exon 1 → 69 bases into exon 2')
  expect(svg).toContain('1 read<')
  expect(svg.match(/class="absent"/g)).toHaveLength(2)
})
