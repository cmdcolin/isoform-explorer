import { expect, test } from 'vitest'

import type { Example, Feature, Isoform } from '../../src/types.ts'
import { exampleSentence } from './examples.ts'

function record(features: Feature[], losses: Isoform['features']) {
  return { features, isoforms: [{ accession: 'Q1-2', features: losses }] }
}

function example(kind: Example['kind'], feature: Feature, replaced = 0) {
  return {
    kind,
    page: 'GENE',
    gene: 'GENE',
    protein: 'A protein',
    isoform: 'Q1-2',
    name: '2',
    transcript: 'ENST00000000001.1',
    feature,
    missing: 39,
    replaced,
  } satisfies Example
}

const signal: Feature = { type: 'Signal', start: 1, end: 21, description: '' }
const helix = (start: number): Feature => ({
  type: 'Transmembrane',
  start,
  end: start + 19,
  description: 'Helical',
})
const domain: Feature = {
  type: 'Domain',
  start: 155,
  end: 205,
  description: 'DHHC',
}
const site: Feature = {
  type: 'Active site',
  start: 185,
  end: 185,
  description: '',
}

test('a signal peptide example names the transcript, the count and the span', () => {
  expect(
    exampleSentence(example('signal', signal), record([signal], [[0, 21, 0]])),
  ).toBe(
    'GENE isoform 2, encoded by ENST00000000001.1, is missing 39 residues of the canonical sequence, including the whole signal peptide (residues 1–21).',
  )
})

test('a transmembrane example says only or all, from the gene record', () => {
  expect(
    exampleSentence(
      example('transmembrane', helix(56)),
      record([helix(56)], []),
    ),
  ).toContain('the protein’s only transmembrane segment (residues 56–75)')
  expect(
    exampleSentence(
      example('transmembrane', helix(56), 4),
      record([helix(56), helix(100)], []),
    ),
  ).toContain(
    '(and 4 more replaced by other sequence), including all 2 of its transmembrane segments.',
  )
})

test('an active-site example counts the domain residues missing and names the site', () => {
  expect(
    exampleSentence(
      example('activeSite', domain),
      record(
        [domain, site],
        [
          [0, 34, 0],
          [1, 1, 0],
        ],
      ),
    ),
  ).toContain(
    'including 34 of the 51 residues of the DHHC domain (residues 155–205) and its active site at residue 185.',
  )
})
