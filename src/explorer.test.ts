import { describe, expect, it } from 'vitest'

import { pagesByAccession } from './explorer.ts'

describe('pagesByAccession', () => {
  it('maps accessions to page names, skipping incomplete rows', () => {
    expect([
      ...pagesByAccession([
        { gene: 'AAAS', page: 'AAAS', accession: 'Q9NRG9' },
        { gene: 'X', page: 'X' },
      ]),
    ]).toEqual([['Q9NRG9', 'AAAS']])
  })
})
