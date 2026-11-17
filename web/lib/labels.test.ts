import { describe, expect, it } from 'vitest'

import { codingNote } from './labels.ts'

describe('codingNote', () => {
  it('says nothing when every coding transcript is mapped', () => {
    expect(codingNote({ genes: 1, gencode: 2, mapped: 2 })).toBe('')
  })

  it('says nothing for an entry with no Ensembl gene in GENCODE', () => {
    expect(codingNote({ genes: 0, gencode: 0, mapped: 0 })).toBe('')
  })

  it('counts the mapped ones and the rest', () => {
    const note = codingNote({ genes: 1, gencode: 12, mapped: 8 })
    expect(note).toContain('lists 12 complete protein-coding transcripts')
    expect(note).toContain('of this gene, 8 of them mapped to an isoform')
    expect(note).toContain('The other 4 have no page here')
  })

  it('does not call them the other ones when none is mapped', () => {
    const note = codingNote({ genes: 1, gencode: 9, mapped: 0 })
    expect(note).toContain('none of them mapped to an isoform above')
    expect(note).toContain('They have no page here')
    expect(note).not.toContain('The other')
  })

  it('keeps the singular when the gene has one coding transcript', () => {
    const note = codingNote({ genes: 1, gencode: 1, mapped: 0 })
    expect(note).toContain(
      'lists 1 complete protein-coding transcript of this gene, mapped to no isoform above',
    )
    expect(note).toContain('It has no page here')
    expect(note).toContain("it is in JBrowse's GENCODE track")
    expect(note).not.toContain('The other')
    expect(note).not.toContain('none of them')
  })

  it('keeps the singular for one unmapped transcript of several', () => {
    expect(codingNote({ genes: 1, gencode: 7, mapped: 6 })).toContain(
      'The other one has no page here',
    )
  })

  it('names several genes when UniProt lists several', () => {
    expect(codingNote({ genes: 2, gencode: 57, mapped: 35 })).toContain(
      'of these genes',
    )
  })
})
