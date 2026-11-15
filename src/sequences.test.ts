import { describe, expect, it } from 'vitest'

import {
  applyEdits,
  displayedIsoform,
  editsByIsoform,
  ensemblByIsoform,
  maneIsoform,
  replacedPositions,
  sharedEnds,
  unversioned,
} from './sequences.ts'

describe('sharedEnds', () => {
  it('counts matching prefix and suffix', () => {
    expect(sharedEnds('ABCDE', 'ABXDE')).toEqual([2, 2])
  })

  it('treats identical sequences as all prefix', () => {
    expect(sharedEnds('ABC', 'ABC')).toEqual([3, 0])
  })

  it('does not overlap the suffix with the prefix', () => {
    expect(sharedEnds('AAA', 'AA')).toEqual([2, 0])
  })

  it('finds nothing shared', () => {
    expect(sharedEnds('ABC', 'XYZW')).toEqual([0, 0])
  })
})

describe('replacedPositions', () => {
  it('keeps no positions for a deletion', () => {
    expect(replacedPositions('MABCDEF', 3, 5, '')).toEqual([])
  })

  it('keeps unchanged residues of a same-length replacement', () => {
    expect(replacedPositions('MABCDEF', 3, 5, 'BXD')).toEqual([3, null, 5])
  })

  it('keeps shared ends of a different-length replacement', () => {
    expect(replacedPositions('MABCDEFG', 3, 6, 'BXYZE')).toEqual([
      3,
      null,
      null,
      null,
      6,
    ])
  })
})

describe('applyEdits', () => {
  it('returns the canonical sequence without edits', () => {
    expect(applyEdits('MAB', [])).toEqual({
      sequence: 'MAB',
      positions: [1, 2, 3],
    })
  })

  it('applies a deletion', () => {
    expect(applyEdits('MABCDEFG', [[3, 5, '']])).toEqual({
      sequence: 'MAEFG',
      positions: [1, 2, 6, 7, 8],
    })
  })

  it('applies a same-length replacement', () => {
    expect(applyEdits('MABCDEFG', [[3, 5, 'BXD']])).toEqual({
      sequence: 'MABXDEFG',
      positions: [1, 2, 3, null, 5, 6, 7, 8],
    })
  })

  it('applies a different-length replacement with shared ends', () => {
    expect(applyEdits('MABCDEFG', [[3, 6, 'BXYZE']])).toEqual({
      sequence: 'MABXYZEFG',
      positions: [1, 2, 3, null, null, null, 6, 7, 8],
    })
  })

  it('keeps canonical coordinates across several edits', () => {
    expect(
      applyEdits('MABCDEFG', [
        [2, 2, 'Q'],
        [6, 8, ''],
      ]),
    ).toEqual({ sequence: 'MQBCD', positions: [1, null, 3, 4, 5] })
  })
})

describe('transcripts', () => {
  const entry = {
    primaryAccession: 'P1',
    comments: [
      {
        commentType: 'ALTERNATIVE PRODUCTS',
        isoforms: [
          {
            name: { value: '1' },
            isoformIds: ['Q9-1', 'P1-1'],
            isoformSequenceStatus: 'Displayed',
          },
          {
            name: { value: '2' },
            synonyms: [{ value: 'Short' }],
            isoformIds: ['P1-2'],
            sequenceIds: ['VSP_1'],
            isoformSequenceStatus: 'Described',
          },
        ],
      },
    ],
    uniProtKBCrossReferences: [
      { database: 'Ensembl', id: 'ENST01.3', isoformId: 'P1-1' },
      { database: 'Ensembl', id: 'ENST02.1', isoformId: 'P1-2' },
      {
        database: 'RefSeq',
        id: 'NP_2.1',
        properties: [{ key: 'NucleotideSequenceId', value: 'NM_2.4' }],
        isoformId: 'P1-2',
      },
      {
        database: 'MANE-Select',
        id: 'ENST02.2',
        properties: [{ key: 'RefSeqNucleotideId', value: 'NM_2.4' }],
      },
    ],
  }

  it('takes the isoform id that belongs to the entry', () => {
    expect(displayedIsoform(entry)).toBe('P1-1')
    expect([...editsByIsoform(entry).keys()]).toEqual(['P1-1', 'P1-2'])
  })

  it('keeps isoform synonyms', () => {
    expect(editsByIsoform(entry).get('P1-2')?.synonyms).toEqual(['Short'])
  })

  it('groups Ensembl transcripts by isoform', () => {
    expect([...ensemblByIsoform(entry)]).toEqual([
      ['P1-1', ['ENST01.3']],
      ['P1-2', ['ENST02.1']],
    ])
  })

  it('finds the isoform MANE Select encodes, whatever the version', () => {
    expect(maneIsoform(entry)).toBe('P1-2')
  })

  it('finds no MANE isoform without a MANE Select transcript', () => {
    expect(maneIsoform({ uniProtKBCrossReferences: [] })).toBeUndefined()
  })

  it('drops a version suffix', () => {
    expect(unversioned('ENST00000269305.9')).toBe('ENST00000269305')
    expect(unversioned('NM_000546')).toBe('NM_000546')
  })
})
