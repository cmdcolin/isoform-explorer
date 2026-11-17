import { describe, expect, it } from 'vitest'

import { geneTranscripts } from './gene-transcripts.ts'

const line = (type: string, start: number, end: number, attributes: string) =>
  ['chr16', 'HAVANA', type, start, end, '.', '+', '.', attributes].join('\t')

describe('geneTranscripts', () => {
  it('collects every transcript of the gene with its exons and coding span', () => {
    const transcripts = geneTranscripts(
      [
        line(
          'transcript',
          100,
          900,
          'ID=ENST1.2;Parent=ENSG1.4;gene_id=ENSG1.4;transcript_id=ENST1.2;transcript_type=protein_coding;transcript_name=GENE-201;tag=basic,MANE_Select',
        ),
        line('exon', 500, 900, 'Parent=ENST1.2;gene_id=ENSG1.4'),
        line('exon', 100, 200, 'Parent=ENST1.2;gene_id=ENSG1.4'),
        line('CDS', 150, 200, 'Parent=ENST1.2;gene_id=ENSG1.4'),
        line('CDS', 500, 700, 'Parent=ENST1.2;gene_id=ENSG1.4'),
        line(
          'transcript',
          100,
          300,
          'ID=ENST9.1;gene_id=ENSG9.1;transcript_id=ENST9.1;transcript_type=lncRNA',
        ),
      ],
      'ENSG1',
    )
    expect(transcripts).toEqual([
      {
        id: 'ENST1.2',
        name: 'GENE-201',
        type: 'protein_coding',
        tags: ['basic', 'MANE_Select'],
        strand: '+',
        exons: [
          [100, 200],
          [500, 900],
        ],
        cds: [150, 700],
      },
    ])
  })
})
