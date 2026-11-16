import { expect, test } from 'vitest'

import { diseasesOf, slugOf } from './diseases.ts'

const comment = (id: string, name: string, note: string) => ({
  commentType: 'DISEASE',
  disease: {
    diseaseId: name,
    diseaseAccession: id,
    acronym: 'X',
    description: 'A disease.',
    diseaseCrossReference: { database: 'MIM', id: '100000' },
  },
  note: { texts: [{ value: note }] },
})

const rows = [
  { page: 'BBB', gene: 'BBB', accession: 'P00002' },
  { page: 'AAA', gene: 'AAA', accession: 'P00001' },
]

test('a disease lists every protein on the site that UniProt links to it, with the note verbatim', () => {
  const diseases = diseasesOf(
    [
      {
        primaryAccession: 'P00002',
        comments: [comment('DI-1', 'Some disease 1', 'May be caused')],
      },
      {
        primaryAccession: 'P00001',
        comments: [comment('DI-1', 'Some disease 1', 'Caused')],
      },
      {
        primaryAccession: 'P99999',
        comments: [comment('DI-2', 'Off-site disease', 'Caused')],
      },
    ],
    rows,
  )
  expect(diseases).toHaveLength(1)
  expect(diseases[0]?.slug).toBe('some-disease-1')
  expect(diseases[0]?.omim).toBe('100000')
  expect(diseases[0]?.genes).toEqual([
    { page: 'AAA', gene: 'AAA', note: 'Caused' },
    { page: 'BBB', gene: 'BBB', note: 'May be caused' },
  ])
})

test('two diseases with the same slug keep apart by accession', () => {
  const diseases = diseasesOf(
    [
      {
        primaryAccession: 'P00001',
        comments: [
          comment('DI-1', 'Type 1, A', ''),
          comment('DI-2', 'Type 1 a', ''),
        ],
      },
    ],
    rows,
  )
  expect(diseases.map(d => d.slug).toSorted()).toEqual([
    'type-1-a-di-1',
    'type-1-a-di-2',
  ])
})

test('a slug keeps letters and digits only', () => {
  expect(slugOf('Cerebral amyloid angiopathy, APP-related')).toBe(
    'cerebral-amyloid-angiopathy-app-related',
  )
})
