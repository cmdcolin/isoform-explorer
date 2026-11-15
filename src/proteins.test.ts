import { expect, test } from 'vitest'

import { checksumOf, hasAlternativeIsoform } from './proteins.ts'

const isoforms = (...statuses: string[]) => ({
  comments: [
    {
      commentType: 'ALTERNATIVE PRODUCTS',
      isoforms: statuses.map(isoformSequenceStatus => ({
        isoformSequenceStatus,
      })),
    },
  ],
})

test('a protein has an alternative isoform when any isoform is not the displayed one', () => {
  expect(hasAlternativeIsoform(isoforms('Displayed', 'Described'))).toBe(true)
  expect(hasAlternativeIsoform(isoforms('Displayed', 'External'))).toBe(true)
  expect(hasAlternativeIsoform(isoforms('Displayed'))).toBe(false)
  expect(hasAlternativeIsoform({})).toBe(false)
})

test('checksums are compared in upper case', () => {
  expect(checksumOf({ sequence: { md5: 'f233ab' } })).toBe('F233AB')
})
