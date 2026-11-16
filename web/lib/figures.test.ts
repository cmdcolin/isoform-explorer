import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test } from 'vitest'

import { acceptorFigure, acceptors } from './acceptor-figure.ts'
import { activeSiteFigure } from './active-site-figure.ts'
import { gene } from './data.ts'
import { CEBPB_MRNA, CEBPB_NAMES } from './posts-data.ts'
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
