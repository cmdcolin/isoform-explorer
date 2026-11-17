import { describe, expect, it } from 'vitest'

import type { GencodeGene } from '../../src/types.ts'
import { codingNote } from './labels.ts'

const gene = (name: string, more: Partial<GencodeGene> = {}) => ({
  id: `ID-${name}`,
  name,
  chromosome: 'chr1',
  readthrough: false,
  ...more,
})

describe('codingNote', () => {
  it('says nothing when every coding transcript is mapped', () => {
    expect(codingNote({ genes: [gene('A')], gencode: 2, mapped: 2 }, 'A')).toBe(
      '',
    )
  })

  it('says nothing for an entry with no Ensembl gene in GENCODE', () => {
    expect(codingNote({ genes: [], gencode: 0, mapped: 0 }, 'A')).toBe('')
  })

  it('counts the mapped ones and the rest', () => {
    const note = codingNote({ genes: [gene('A')], gencode: 12, mapped: 8 }, 'A')
    expect(note).toContain('lists 12 complete protein-coding transcripts')
    expect(note).toContain('of this gene, 8 of them mapped to an isoform')
    expect(note).toContain('The other 4 have no page here')
    expect(note).toContain("they are in JBrowse's GENCODE track")
  })

  it('does not call them the other ones when none is mapped', () => {
    const note = codingNote({ genes: [gene('A')], gencode: 9, mapped: 0 }, 'A')
    expect(note).toContain('none of them mapped to an isoform above')
    expect(note).toContain('They have no page here')
    expect(note).not.toContain('The other')
  })

  it('keeps the singular when the gene has one coding transcript', () => {
    const note = codingNote({ genes: [gene('A')], gencode: 1, mapped: 0 }, 'A')
    expect(note).toContain(
      'lists 1 complete protein-coding transcript of this gene, mapped to no isoform above',
    )
    expect(note).toContain('It has no page here')
    expect(note).toContain("it is in JBrowse's GENCODE track")
    expect(note).not.toContain('The other')
    expect(note).not.toContain('none of them')
  })

  it('keeps the singular for one unmapped transcript of several', () => {
    const note = codingNote({ genes: [gene('A')], gencode: 7, mapped: 6 }, 'A')
    expect(note).toContain('The other one has no page here')
    expect(note).toContain("it is in JBrowse's GENCODE track")
    expect(note).not.toContain('they are')
  })

  it('writes one mapped transcript as a word', () => {
    expect(
      codingNote({ genes: [gene('A')], gencode: 7, mapped: 1 }, 'A'),
    ).toContain('of this gene, one of them mapped')
  })

  it('names the genes when UniProt lists several, the page’s own first', () => {
    expect(
      codingNote(
        { genes: [gene('HSPA1B'), gene('HSPA1A')], gencode: 3, mapped: 2 },
        'HSPA1A',
      ),
    ).toContain('transcripts of HSPA1A and HSPA1B, 2 of them mapped')
  })

  it('sorts three or more genes and lists them with commas', () => {
    expect(
      codingNote(
        {
          genes: [gene('TP53TG3'), gene('TP53TG3D'), gene('TP53TG3B')],
          gencode: 12,
          mapped: 11,
        },
        'TP53TG3',
      ),
    ).toContain('of TP53TG3, TP53TG3B and TP53TG3D,')
  })

  it('says which gene GENCODE tags as a readthrough', () => {
    expect(
      codingNote(
        {
          genes: [gene('FXYD6'), gene('FXYD6-FXYD2', { readthrough: true })],
          gencode: 57,
          mapped: 35,
        },
        'FXYD6',
      ),
    ).toContain('of FXYD6 and the readthrough gene FXYD6-FXYD2, 35 of them')
  })

  it('names a readthrough by its id when it shares the page gene’s name', () => {
    expect(
      codingNote(
        {
          genes: [
            gene('PDE4C', { id: 'ENSG1' }),
            gene('PDE4C', { id: 'ENSG2', readthrough: true }),
          ],
          gencode: 6,
          mapped: 5,
        },
        'PDE4C',
      ),
    ).toContain('of PDE4C and the readthrough gene ENSG2,')
  })

  it('names copies on the X and Y chromosomes once, with both places', () => {
    expect(
      codingNote(
        {
          genes: [
            gene('AKAP17A', { chromosome: 'chrX' }),
            gene('AKAP17A', { chromosome: 'chrY' }),
          ],
          gencode: 14,
          mapped: 12,
        },
        'AKAP17A',
      ),
    ).toContain('transcripts of AKAP17A on chrX and chrY, 12 of them mapped')
  })

  it('tells same-named genes on one chromosome apart by id', () => {
    expect(
      codingNote(
        {
          genes: [gene('A', { id: 'ENSG1' }), gene('A', { id: 'ENSG2' })],
          gencode: 6,
          mapped: 5,
        },
        'A',
      ),
    ).toContain('of A (ENSG1) and A (ENSG2),')
  })
})
