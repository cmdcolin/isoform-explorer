import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getJson, getText } from './cache.ts'
import { number, record, records, text, writeJson } from './json.ts'
import { DATA, ROOT, SITE_DATA } from './paths.ts'
import type { GeneRecord, Isoform } from './types.ts'

export const CASES = [
  { page: 'APP', isoform: 'P05067-4' },
  { page: 'NDUFC2', isoform: 'O95298-2' },
  { page: 'ZDHHC16', isoform: 'Q969W1-3' },
  { page: 'F2RL2', isoform: 'O00254-2' },
]

const SNAPTRON = 'https://snaptron.cs.jhu.edu/gtexv2/snaptron'
const SAMPLES = 'https://snaptron.cs.jhu.edu/data/gtexv2/samples.tsv'
const GTEX = 'https://gtexportal.org/api/v2'
const CACHE = join(DATA, 'expression')
export const OUTPUT = join(
  ROOT,
  'web',
  'content',
  'blog',
  'data',
  'expression.json',
)

type Intron = [start: number, end: number]

export interface Junctions {
  chromosome: string
  isoform: Intron
  canonical: Intron
  shared: 'donor' | 'acceptor'
}

function introns(exons: [number, number][]) {
  const sorted = exons.toSorted((a, b) => a[0] - b[0])
  return sorted
    .slice(1)
    .map(([start], index): Intron => [(sorted[index]?.[1] ?? 0) + 1, start - 1])
}

export function definingJunctions(
  gene: Pick<GeneRecord, 'structures' | 'locus'> & {
    canonical: Pick<Isoform, 'accession'>
  },
  accession: string,
): Junctions | undefined {
  const canonical = gene.structures[gene.canonical.accession]
  const isoform = gene.structures[accession]
  const chromosome = gene.locus?.split(':')[0]
  const known = new Set(
    introns(canonical?.exons ?? []).map(([start, end]) => `${start}-${end}`),
  )
  const donorAt = (strand: number, [start, end]: Intron) =>
    strand < 0 ? end : start
  const acceptorAt = (strand: number, [start, end]: Intron) =>
    strand < 0 ? start : end
  return canonical && isoform && chromosome
    ? introns(isoform.exons)
        .filter(([start, end]) => !known.has(`${start}-${end}`))
        .flatMap((intron): Junctions[] => {
          const others = introns(canonical.exons)
          const strand = canonical.strand
          const donor = others.find(
            other => donorAt(strand, other) === donorAt(strand, intron),
          )
          const acceptor = others.find(
            other => acceptorAt(strand, other) === acceptorAt(strand, intron),
          )
          return donor
            ? [
                {
                  chromosome,
                  isoform: intron,
                  canonical: donor,
                  shared: 'donor',
                },
              ]
            : acceptor
              ? [
                  {
                    chromosome,
                    isoform: intron,
                    canonical: acceptor,
                    shared: 'acceptor',
                  },
                ]
              : []
        })[0]
    : undefined
}

export function tissueKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function readsBySample(samples: string) {
  return samples
    .split(',')
    .filter(Boolean)
    .map(entry => entry.split(':').map(Number))
    .flatMap(([rail, reads]) =>
      rail !== undefined && reads !== undefined ? [[rail, reads] as const] : [],
    )
}

async function junctionReads(chromosome: string, [start, end]: Intron) {
  const body = await getText(
    `${SNAPTRON}?regions=${chromosome}:${start}-${end}&exact=1`,
    join(CACHE, `snaptron-${chromosome}-${start}-${end}.tsv.gz`),
  )
  const row = body
    .split('\n')
    .map(line => line.split('\t'))
    .find(fields => fields[3] === String(start) && fields[4] === String(end))
  return readsBySample(row?.[12] ?? '')
}

async function sampleTissues() {
  const [header = '', ...rows] = (
    await getText(SAMPLES, join(CACHE, 'gtexv2-samples.tsv.gz'))
  ).split('\n')
  const columns = header.split('\t')
  const rail = columns.indexOf('rail_id')
  const tissue = columns.indexOf('SMTSD')
  return new Map(
    rows
      .map(line => line.split('\t'))
      .filter(fields => fields[tissue])
      .map(fields => [Number(fields[rail]), fields[tissue] ?? '']),
  )
}

async function medianTpm(symbol: string) {
  const reference = await getJson(
    `${GTEX}/reference/gene`,
    join(CACHE, `gtex-gene-${symbol}.json`),
    { geneId: symbol, gencodeVersion: 'v26', genomeBuild: 'GRCh38/hg38' },
  )
  const gencodeId = text(records(record(reference).data)[0]?.gencodeId)
  const medians = gencodeId
    ? await getJson(
        `${GTEX}/expression/medianTranscriptExpression`,
        join(CACHE, `gtex-transcripts-${symbol}.json`),
        { gencodeId, datasetId: 'gtex_v8', itemsPerPage: '100000' },
      )
    : null
  return records(record(medians).data).map(row => ({
    transcript: (text(row.transcriptId) ?? '').split('.')[0] ?? '',
    tissue: tissueKey(text(row.tissueSiteDetailId) ?? ''),
    median: number(row.median) ?? 0,
  }))
}

function sumBy<T>(items: T[], value: (item: T) => number) {
  return items.reduce((sum, item) => sum + value(item), 0)
}

async function expressionCase(
  { page, isoform }: (typeof CASES)[number],
  tissues: Map<number, string>,
) {
  const gene: GeneRecord = JSON.parse(
    readFileSync(join(SITE_DATA, 'genes', `${page}.json`), 'utf8'),
  )
  const junctions = definingJunctions(gene, isoform)
  if (!junctions) {
    throw new Error(`${page} ${isoform}: no junction defines the isoform`)
  }
  const isoformReads = await junctionReads(
    junctions.chromosome,
    junctions.isoform,
  )
  const canonicalReads = await junctionReads(
    junctions.chromosome,
    junctions.canonical,
  )
  const tpm = await medianTpm(gene.gene)
  const ids = new Set(
    [
      ...(gene.isoforms.find(i => i.accession === isoform)?.transcripts
        .ensembl ?? []),
      gene.structures[isoform]?.transcript ?? '',
    ].map(id => id.split('.')[0]),
  )
  const names = [...new Set(tissues.values())].toSorted()
  const inTissue = (reads: (readonly [number, number])[], name: string) =>
    reads.filter(([rail]) => tissues.get(rail) === name)
  return {
    page,
    gene: gene.gene,
    isoform,
    junctions,
    transcriptsInGtex: [
      ...new Set(tpm.filter(t => ids.has(t.transcript)).map(t => t.transcript)),
    ],
    isoformReads: sumBy(isoformReads, ([, reads]) => reads),
    canonicalReads: sumBy(canonicalReads, ([, reads]) => reads),
    isoformSamples: isoformReads.length,
    samples: tissues.size,
    tissues: names.map(name => {
      const rows = tpm.filter(t => t.tissue === tissueKey(name))
      const total = sumBy(rows, t => t.median)
      const own = sumBy(
        rows.filter(t => ids.has(t.transcript)),
        t => t.median,
      )
      return {
        tissue: name,
        samples: [...tissues.values()].filter(t => t === name).length,
        isoformReads: sumBy(inTissue(isoformReads, name), ([, reads]) => reads),
        canonicalReads: sumBy(
          inTissue(canonicalReads, name),
          ([, reads]) => reads,
        ),
        isoformSamples: inTissue(isoformReads, name).length,
        tpmShare: rows.length && total > 0 ? own / total : null,
      }
    }),
  }
}

if (import.meta.main) {
  const tissues = await sampleTissues()
  const cases = []
  for (const c of CASES) {
    cases.push(await expressionCase(c, tissues))
  }
  writeJson(
    OUTPUT,
    {
      fetched: new Date().toISOString().slice(0, 10),
      sources: {
        junctions: `${SNAPTRON} (GTEx v8 RNA-seq realigned by recount, ${tissues.size} samples)`,
        tpm: `${GTEX}/expression/medianTranscriptExpression (gtex_v8)`,
      },
      cases,
    },
    1,
  )
  console.log(OUTPUT)
}
