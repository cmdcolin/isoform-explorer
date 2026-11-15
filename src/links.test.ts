import { describe, expect, test } from 'vitest'

import {
  isoformAtLocusUrl,
  isoformSpec,
  isoformUrl,
  jbrowseUrl,
  sessionUrl,
  transcriptsUrl,
} from './links.ts'

const JBROWSE = jbrowseUrl('https://x.io/iso/jbrowse/config.json')

function sessionOf(url: string) {
  return JSON.parse(
    (new URL(url).searchParams.get('session') ?? '').replace(/^spec-/, ''),
  )
}

describe('links', () => {
  test('urls open the hosted JBrowse on our config', () => {
    expect(JBROWSE).toBe(
      'https://jbrowse.org/code/jb2/main/?config=https%3A%2F%2Fx.io%2Fiso%2Fjbrowse%2Fconfig.json',
    )
    expect(sessionUrl({ views: [] }, JBROWSE)).toBe(
      `${JBROWSE}&session=spec-%7B%22views%22%3A%5B%5D%7D`,
    )
  })

  test('transcripts on the genome are found by gene symbol, RefSeq above GENCODE', () => {
    expect(sessionOf(transcriptsUrl('TP53', JBROWSE))).toEqual({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'TP53',
          tracks: ['hg38-ncbiRefSeqCurated', 'hg38-gencodeComp'],
        },
      ],
    })
  })

  test('an isoform opens superposed on the canonical, its transcript looked up in the first track', () => {
    const structures = [{ url: 'isoform.cif' }, { url: 'canonical.cif' }]
    expect(
      sessionOf(isoformUrl('TP53', 'NM_001126114.3', structures, JBROWSE)),
    ).toEqual({
      views: [
        {
          type: 'ProteinView',
          gene: 'TP53',
          transcriptId: 'NM_001126114.3',
          structures,
          connectedView: {
            assembly: 'hg38',
            tracks: ['hg38-ncbiRefSeqCurated', 'hg38-gencodeComp'],
          },
        },
      ],
    })
    expect(
      isoformSpec('TP53', 'ENST00000269305', structures).views[0]?.connectedView
        .tracks,
    ).toEqual(['hg38-gencodeComp', 'hg38-ncbiRefSeqCurated'])
    expect(
      isoformSpec('TP53', undefined, structures).views[0],
    ).not.toHaveProperty('transcriptId')
  })

  test('with a locus, the superposed view opens its genome view there', () => {
    const structures = [{ url: 'isoform.cif' }]
    expect(
      sessionOf(
        isoformAtLocusUrl(
          'TP53',
          'NM_001126114.3',
          structures,
          'chr17:7668402-7687546',
          JBROWSE,
        ),
      ).views[0].connectedView,
    ).toEqual({
      assembly: 'hg38',
      tracks: ['hg38-ncbiRefSeqCurated', 'hg38-gencodeComp'],
      loc: 'chr17:7668402-7687546',
    })
  })
})
