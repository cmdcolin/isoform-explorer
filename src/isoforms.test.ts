import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  alphaFoldDb,
  bandRuns,
  examples,
  fates,
  featureLosses,
  featurePositions,
  indexRow,
  interfaceLosses,
  lacksInFull,
  lacksInterface,
  losingConfidence,
  lookups,
  pageNames,
  readInterfaces,
  segments,
  totals,
  trimmedEdit,
  withinSequence,
} from './isoforms.ts'
import { EDIT_PREVIEW } from './types.ts'
import type { Feature, GeneRecord, Isoform } from './types.ts'

const noTranscripts = { ensembl: [], refseq: [], maneSelect: false }

function isoform(overrides: Partial<Isoform>): Isoform {
  return {
    accession: 'P1-2',
    name: '2',
    synonyms: [],
    notes: [],
    length: 100,
    transcripts: noTranscripts,
    segments: [],
    edits: [],
    missing: 0,
    replaced: 0,
    novel: 0,
    foldedAbsent: null,
    foldedMissing: null,
    features: [],
    interfaces: {},
    model: null,
    ...overrides,
  }
}

function gene(overrides: Partial<GeneRecord>): GeneRecord {
  return {
    page: 'G1',
    gene: 'G1',
    accession: 'P1',
    protein: 'Protein',
    length: 100,
    disease: false,
    events: ['Alternative splicing'],
    canonical: {
      accession: 'P1-1',
      name: '1',
      synonyms: [],
      notes: [],
      transcripts: noTranscripts,
      model: null,
    },
    features: [],
    interfaces: {},
    isoforms: [],
    ...overrides,
  }
}

const signal: Feature = { type: 'Signal', start: 1, end: 20, description: '' }
const domain: Feature = {
  type: 'Domain',
  start: 30,
  end: 60,
  description: 'Kinase',
}
const activeSite: Feature = {
  type: 'Active site',
  start: 40,
  end: 40,
  description: 'Proton acceptor',
}
const bond: Feature = {
  type: 'Disulfide bond',
  start: 10,
  end: 50,
  description: '',
}
const transmembrane: Feature = {
  type: 'Transmembrane',
  start: 70,
  end: 90,
  description: 'Helical',
}

describe('segments', () => {
  it('makes an unchanged isoform one segment', () => {
    expect(segments([1, 2, 3, 4])).toEqual([[1, 1, 4]])
  })

  it('splits a deletion into isoform and canonical starts', () => {
    expect(segments([1, 2, 6, 7, 8])).toEqual([
      [1, 1, 2],
      [3, 6, 3],
    ])
  })

  it('leaves replaced residues out', () => {
    expect(segments([1, 2, 3, null, null, null, 6, 7, 8])).toEqual([
      [1, 1, 3],
      [7, 6, 3],
    ])
  })

  it('finds no segment in an entirely new sequence', () => {
    expect(segments([null, null])).toEqual([])
  })
})

describe('bandRuns', () => {
  it('shares a run between consecutive residues in one confidence band', () => {
    expect(bandRuns([95, 90, 89, 70, 69, 50, 49, 0, 91])).toEqual([
      [90, 2],
      [70, 2],
      [50, 2],
      [0, 2],
      [90, 1],
    ])
  })

  it('makes no runs from no scores', () => {
    expect(bandRuns([])).toEqual([])
  })
})

describe('fates', () => {
  it('calls residues deleted with nothing in their place missing', () => {
    expect(fates('MABCDEFG', [[3, 5, '']])).toEqual([
      'kept',
      'kept',
      'missing',
      'missing',
      'missing',
      'kept',
      'kept',
      'kept',
    ])
  })

  it('calls residues swapped for other sequence replaced', () => {
    expect(fates('MABCDEFG', [[3, 5, 'XYZW']])).toEqual([
      'kept',
      'kept',
      'replaced',
      'replaced',
      'replaced',
      'kept',
      'kept',
      'kept',
    ])
  })

  it('keeps residues a same-length swap leaves unchanged', () => {
    expect(fates('MABCDEFG', [[3, 5, 'BXD']])).toEqual([
      'kept',
      'kept',
      'kept',
      'replaced',
      'kept',
      'kept',
      'kept',
      'kept',
    ])
  })

  it('calls a shortening that adds no new residue missing', () => {
    expect(fates('MABCDEFG', [[3, 6, 'BE']])).toEqual([
      'kept',
      'kept',
      'kept',
      'missing',
      'missing',
      'kept',
      'kept',
      'kept',
    ])
  })
})

describe('featurePositions', () => {
  it('spans a range feature', () => {
    expect(featurePositions(signal)).toHaveLength(20)
  })

  it('takes only the two residues of a bond', () => {
    expect(featurePositions(bond)).toEqual([10, 50])
  })

  it('takes one residue of an interchain bond', () => {
    expect(featurePositions({ ...bond, end: 10 })).toEqual([10])
  })
})

describe('featureLosses', () => {
  const fate = fates('M'.repeat(100), [
    [1, 20, ''],
    [45, 50, 'QQQQQQ'],
  ])

  it('counts missing and replaced residues of each feature touched', () => {
    expect(featureLosses([signal, domain, activeSite, bond], fate)).toEqual([
      [0, 20, 0],
      [1, 0, 6],
      [3, 1, 1],
    ])
  })

  it('lacks a range feature in full only when every residue is missing', () => {
    expect(lacksInFull(signal, [0, 20, 0])).toBe(true)
    expect(lacksInFull(domain, [1, 30, 1])).toBe(false)
    expect(lacksInFull(domain, [1, 0, 31])).toBe(false)
  })

  it('lacks a bond when either residue is missing', () => {
    expect(lacksInFull(bond, [3, 1, 1])).toBe(true)
    expect(lacksInFull(bond, [3, 0, 2])).toBe(false)
  })
})

describe('interfaces', () => {
  const fate = fates('M'.repeat(100), [
    [1, 20, ''],
    [45, 50, 'QQQQQQ'],
  ])

  it('counts missing, replaced and total residues per partner touched', () => {
    expect(
      interfaceLosses(
        { A: [5, 6, 30], B: [46, 47, 80, 81], C: [90, 91] },
        fate,
      ),
    ).toEqual({ A: [2, 0, 3], B: [0, 2, 4] })
  })

  it('lacks an interface when at least half of it is missing', () => {
    expect(lacksInterface({ interfaces: { A: [2, 0, 4] } })).toBe(true)
    expect(lacksInterface({ interfaces: { A: [1, 3, 4] } })).toBe(false)
  })

  it('drops interface residues outside the sequence', () => {
    expect(withinSequence({ A: [5, 101], B: [0, 200] }, 100)).toEqual({
      A: [5],
    })
  })

  it('reads no interfaces when the file is absent', () => {
    expect(
      readInterfaces(join(tmpdir(), 'absent', 'interfaces.json')).size,
    ).toBe(0)
  })

  it('reads a hand-made interfaces file sorted and deduplicated', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'interfaces-')), 'i.json')
    writeFileSync(
      path,
      JSON.stringify({ P1: { ZB: [9, 3, 3], AA: [1], EMPTY: [] } }),
    )
    expect([...readInterfaces(path)]).toEqual([['P1', { AA: [1], ZB: [3, 9] }]])
  })
})

describe('trimmedEdit', () => {
  it('keeps a short edit whole', () => {
    expect(trimmedEdit('MABCDEFG', [3, 5, 'XY'])).toEqual({
      start: 3,
      end: 5,
      original: 'BCD',
      replacement: 'XY',
      added: 2,
    })
  })

  it('previews a long replacement and keeps its length', () => {
    const edit = trimmedEdit('MAB', [2, 2, 'Q'.repeat(500)])
    expect(edit.replacement).toHaveLength(EDIT_PREVIEW)
    expect(edit.added).toBe(500)
  })
})

describe('losingConfidence', () => {
  it('counts shared residues that fall from at least 70 to below 50', () => {
    expect(
      losingConfidence([1, 2, null, 4], [40, 80, 30, 49], [90, 90, 90, 60]),
    ).toBe(1)
  })
})

describe('summaries', () => {
  const lacking = isoform({
    accession: 'P1-2',
    missing: 61,
    transcripts: { ensembl: ['ENST1.1'], refseq: ['NM_1.2'], maneSelect: true },
    features: [
      [0, 20, 0],
      [1, 31, 0],
      [2, 1, 0],
    ],
    interfaces: { A: [3, 0, 4] },
    foldedAbsent: 12,
    foldedMissing: 12,
    model: {
      entry: 'AF-P1-2-F1',
      cif: '',
      meanPlddt: 80,
      plddt: [],
      losingConfidence: 0,
    },
  })
  const swapped = isoform({
    accession: 'P1-3',
    replaced: 20,
    features: [[0, 0, 20]],
    foldedAbsent: 5,
    foldedMissing: 0,
  })
  const record = gene({
    features: [signal, domain, activeSite, transmembrane],
    canonical: {
      ...gene({}).canonical,
      model: { entry: 'AF-P1-F1', cif: '', meanPlddt: 80, plddt: [] },
    },
    isoforms: [lacking, swapped],
  })

  it('counts lost features from missing residues only', () => {
    expect(indexRow(record)).toEqual({
      page: 'G1',
      gene: 'G1',
      accession: 'P1',
      protein: 'Protein',
      length: 100,
      isoforms: 2,
      withTranscript: 1,
      mostAbsent: 61,
      foldedAbsent: 12,
      lost: { targeting: 1, domains: 1, sites: 1, modifications: 0 },
      interfacesLost: 1,
    })
  })

  it('totals isoforms across proteins', () => {
    expect(totals([record, gene({ page: 'G2', isoforms: [swapped] })])).toEqual(
      {
        proteins: 2,
        isoforms: 3,
        withTranscript: 1,
        withModel: 1,
        canonicalModels: 1,
        modelsPending: 0,
        maneSelectNotCanonical: 1,
        lacking: {
          targeting: 1,
          domains: 1,
          sites: 1,
          modifications: 0,
          interface: 1,
          folded: 1,
        },
      },
    )
  })

  it('maps genes, accessions and versionless transcripts to pages', () => {
    const found = lookups([record])
    expect(found.genes).toEqual({ G1: ['G1'] })
    expect(found.accessions).toEqual({
      P1: ['G1'],
      'P1-1': ['G1#P1-1'],
      'P1-2': ['G1#P1-2'],
      'P1-3': ['G1#P1-3'],
    })
    expect(found.ensembl).toEqual({ ENST1: ['G1#P1-2'] })
    expect(found.refseq).toEqual({ NM_1: ['G1#P1-2'] })
  })

  it('picks worked examples by rule, smallest change first', () => {
    const tm = gene({
      page: 'TM',
      gene: 'TM',
      features: [transmembrane],
      isoforms: [
        isoform({
          accession: 'P2-2',
          missing: 21,
          transcripts: { ensembl: ['ENST2.1'], refseq: [], maneSelect: false },
          features: [[0, 21, 0]],
        }),
      ],
    })
    expect(
      examples([record, tm]).map(e => [e.kind, e.page, e.feature.type]),
    ).toEqual([
      ['signal', 'G1', 'Signal'],
      ['transmembrane', 'TM', 'Transmembrane'],
    ])
  })
})

describe('pageNames', () => {
  const entry = (accession: string, gene: string) => ({
    primaryAccession: accession,
    genes: [{ geneName: { value: gene } }],
  })

  it('adds the accession only when two entries share a symbol', () => {
    expect([
      ...pageNames([entry('P1', 'A'), entry('P2', 'B'), entry('P3', 'B')]),
    ]).toEqual([
      ['P1', 'A'],
      ['P2', 'B_P2'],
      ['P3', 'B_P3'],
    ])
  })

  it('makes a symbol with a slash safe as a path', () => {
    expect([...pageNames([entry('P1', 'CNK3/IPCEF1')])]).toEqual([
      ['P1', 'CNK3-IPCEF1'],
    ])
  })
})

describe('alphaFoldDb', () => {
  const entry = {
    entryId: 'AF-P1-2-F1',
    cifUrl: 'https://example.org/AF-P1-2-F1-model_v6.cif',
    plddtDocUrl: '',
    uniprotAccession: 'P1-2',
    sequence: 'MAB',
  }

  it('gives no model for a model of a different sequence', () => {
    const alphaFold = alphaFoldDb(() => [90, 90, 90])
    expect(alphaFold.scored(entry, 'MABC')).toBeUndefined()
    expect(alphaFold.pendingModels.size).toBe(0)
  })

  it('reads a cached pLDDT into bands', () => {
    expect(alphaFoldDb(() => [95, 72, 40]).scored(entry, 'MAB')?.model).toEqual(
      {
        entry: 'AF-P1-2-F1',
        cif: entry.cifUrl,
        meanPlddt: 69,
        plddt: [
          [90, 1],
          [70, 1],
          [0, 1],
        ],
      },
    )
  })

  it('keeps a model whose pLDDT is not cached, as pending', () => {
    const alphaFold = alphaFoldDb(() => undefined)
    expect(alphaFold.scored(entry, 'MAB')?.model).toEqual({
      entry: 'AF-P1-2-F1',
      cif: entry.cifUrl,
      meanPlddt: null,
      plddt: null,
    })
    expect([...alphaFold.pendingModels]).toEqual(['AF-P1-2-F1'])
  })
})
