import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'

import { GENCODE, gencodeFile } from './ensembl.ts'
import { blogDataPath } from './illustration.ts'
import { writeJson } from './json.ts'

export const GENES = [{ name: 'cd19', gene: 'ENSG00000177455' }]

const GFF_GENE = /(?:^|;)gene_id=(ENSG\d+)\./
const GFF_ID = /(?:^|;)transcript_id=(ENST\d+\.\d+)/
const GFF_PARENT = /(?:^|;)Parent=(ENST\d+\.\d+)/
const GFF_NAME = /(?:^|;)transcript_name=([^;]+)/
const GFF_TYPE = /(?:^|;)transcript_type=([^;]+)/
const GFF_TAG = /(?:^|;)tag=([^;]+)/

export interface GeneTranscript {
  id: string
  name: string
  type: string
  tags: string[]
  strand: string
  exons: [number, number][]
  cds: [number, number] | null
}

/**
 * Every transcript GENCODE 49 lists for one gene, of every type, with its
 * exons and coding span in GRCh38 coordinates.
 */
export function geneTranscripts(lines: string[], gene: string) {
  const found = new Map<string, GeneTranscript>()
  for (const line of lines) {
    const [, , type, start = '', end = '', , strand = '', , attributes = ''] =
      line.split('\t')
    const parent = GFF_PARENT.exec(attributes)?.[1]
    const span: [number, number] = [Number(start), Number(end)]
    if (type === 'transcript' && GFF_GENE.exec(attributes)?.[1] === gene) {
      const id = GFF_ID.exec(attributes)?.[1] ?? ''
      found.set(id, {
        id,
        name: GFF_NAME.exec(attributes)?.[1] ?? id,
        type: GFF_TYPE.exec(attributes)?.[1] ?? '',
        tags: GFF_TAG.exec(attributes)?.[1]?.split(',') ?? [],
        strand,
        exons: [],
        cds: null,
      })
    } else if (type === 'exon' && parent) {
      found.get(parent)?.exons.push(span)
    } else if (type === 'CDS' && parent) {
      const transcript = found.get(parent)
      if (transcript) {
        transcript.cds = transcript.cds
          ? [
              Math.min(transcript.cds[0], span[0]),
              Math.max(transcript.cds[1], span[1]),
            ]
          : span
      }
    }
  }
  return [...found.values()].map(transcript => ({
    ...transcript,
    exons: transcript.exons.toSorted((a, b) => a[0] - b[0]),
  }))
}

if (import.meta.main) {
  if (!(await gencodeFile())) {
    throw new Error("GENCODE's GFF3 is neither cached nor downloadable")
  }
  const wanted = GENES.map(({ gene }) => gene)
  const lines: string[] = []
  for await (const line of createInterface({
    input: createReadStream(GENCODE).pipe(createGunzip()),
    crlfDelay: Infinity,
  })) {
    if (wanted.some(gene => line.includes(gene))) {
      lines.push(line)
    }
  }
  for (const { name, gene } of GENES) {
    const path = blogDataPath(`${name}-transcripts.json`)
    writeJson(
      path,
      {
        gene,
        release: 'GENCODE 49',
        transcripts: geneTranscripts(lines, gene),
      },
      1,
    )
    console.log(path)
  }
}
