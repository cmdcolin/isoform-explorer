import { describe, expect, it } from 'vitest'

import type { Edit, Segment } from '../../src/types.ts'
import { contactStates, positionsText, sharedContacts } from './epitope.ts'

const deletion = (start: number, end: number, length: number) => ({
  edits: [
    {
      start,
      end,
      original: '',
      replacement: '',
      added: 0,
    },
  ] satisfies Edit[],
  segments: [
    [1, 1, start - 1],
    [start, end + 1, length - end],
  ] satisfies Segment[],
})

describe('contactStates', () => {
  it('counts contact residues the isoform keeps and lacks', () => {
    const states = contactStates(
      [100, 120, 150, 160],
      [[90, 200]],
      deletion(140, 170, 300),
    )
    expect(states).toMatchObject({
      total: 4,
      present: 2,
      missing: [150, 160],
      replaced: [],
      where: 'resolved',
    })
  })

  it('counts present residues within three of a missing stretch', () => {
    const states = contactStates(
      [136, 137, 171, 174, 175],
      [[90, 200]],
      deletion(140, 170, 300),
    )
    expect(states.abutting).toEqual([137, 171])
  })

  it('marks an isoform that differs only outside the structure', () => {
    const states = contactStates(
      [100, 120],
      [[90, 200]],
      deletion(240, 260, 300),
    )
    expect(states).toMatchObject({ present: 2, abutting: [], where: 'outside' })
  })

  it('tells an edit in an unresolved loop from one outside the structure', () => {
    const states = contactStates(
      [100, 180],
      [
        [90, 130],
        [160, 200],
      ],
      deletion(140, 150, 300),
    )
    expect(states.where).toBe('unresolved')
  })

  it('counts a swapped stretch as replaced, not missing', () => {
    const states = contactStates([100, 145], [[90, 200]], {
      edits: [
        {
          start: 140,
          end: 150,
          original: '',
          replacement: 'ABCDEFGHIJK',
          added: 11,
        },
      ],
      segments: [
        [1, 1, 139],
        [151, 151, 150],
      ],
    })
    expect(states).toMatchObject({ present: 1, missing: [], replaced: [145] })
  })
})

describe('sharedContacts', () => {
  it('keeps the contacts, resolved residues and sugars every copy has', () => {
    const shared = sharedContacts([
      {
        chain: 'Q',
        binders: ['H', 'L'],
        contacts: [10, 11, 12],
        observed: [[1, 50]],
        sugars: [
          { site: 5, contact: true },
          { site: 40, contact: true },
        ],
      },
      {
        chain: 'R',
        binders: ['A', 'B'],
        contacts: [11, 12, 13],
        observed: [
          [3, 20],
          [30, 60],
        ],
        sugars: [
          { site: 5, contact: true },
          { site: 40, contact: false },
        ],
      },
    ])
    expect(shared).toEqual({
      contacts: [11, 12],
      observed: [
        [3, 20],
        [30, 50],
      ],
      sugarContacts: [5],
      sugarSites: [5, 40],
      sizes: [3, 3],
      any: 4,
    })
  })
})

describe('positionsText', () => {
  it('joins consecutive residues into spans', () => {
    expect(positionsText([245, 247, 266, 267, 268])).toBe(
      '245, 247 and 266–268',
    )
  })
})
