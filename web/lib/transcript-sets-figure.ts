import type { GeneTranscript } from '../../src/gene-transcripts.ts'
import type { GeneRecord } from '../../src/types.ts'
import { esc } from './html.ts'

const WIDTH = 1400
const LEFT = 500
const RIGHT = 1300
const ROW = 58
const UTR = 14
const CODING = 28

export interface Reported {
  summary: string
  cite: string
}

function sentenceCase(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function unversioned(id: string) {
  return id.replace(/\.\d+$/, '')
}

/**
 * The canonical's exons with its second one left out, for drawing the mRNA
 * Sotillo et al. report; its coding span is kept only when the skipped exon is
 * a whole number of codons.
 */
export function skipping(canonical: GeneTranscript, exon: number) {
  const skipped = canonical.exons[exon - 1]
  const inFrame = skipped ? (skipped[1] - skipped[0] + 1) % 3 === 0 : false
  return {
    exons: canonical.exons.filter((_, i) => i !== exon - 1),
    cds: inFrame ? canonical.cds : null,
    skipped,
    inFrame,
  }
}

/**
 * The canonical residues the coding nucleotides of exon `exon` fall in, given
 * the canonical's exon junctions in coding nucleotides from the start codon.
 */
export function residuesOfExon(junctions: number[], exon: number) {
  const edges = [0, ...junctions]
  const from = edges[exon - 1] ?? 0
  const to = edges[exon] ?? from
  return [Math.ceil((from + 1) / 3), Math.ceil(to / 3)] as const
}

export function transcriptSetsFigure(
  record: GeneRecord,
  transcripts: GeneTranscript[],
  exon: number,
  reported: Reported,
) {
  const forms = [
    {
      name: `${record.canonical.name} (canonical)`,
      transcripts: record.canonical.transcripts,
    },
    ...record.isoforms.map(i => ({ name: i.name, transcripts: i.transcripts })),
  ]
  const mapped = new Map(
    forms.flatMap(form =>
      form.transcripts.ensembl.map((id): [string, (typeof forms)[number]] => [
        unversioned(id),
        form,
      ]),
    ),
  )
  const coding = transcripts.filter(
    t =>
      t.type === 'protein_coding' &&
      !t.tags.includes('cds_start_NF') &&
      !t.tags.includes('cds_end_NF'),
  )
  const others = transcripts.filter(t => !coding.includes(t))
  const canonical = coding.find(t => t.tags.includes('MANE_Select'))
  const skip = canonical ? skipping(canonical, exon) : null
  const starts = transcripts.flatMap(t => t.exons.map(([s]) => s))
  const ends = transcripts.flatMap(t => t.exons.map(([, e]) => e))
  const [low, high] = [Math.min(...starts), Math.max(...ends)]
  const x = (position: number) =>
    LEFT + ((position - low) / (high - low)) * (RIGHT - LEFT)
  const highlight = skip?.skipped
  const cuts = (s: number, e: number): [number, number, boolean][] =>
    highlight && s <= highlight[1] && e >= highlight[0]
      ? [
          [s, highlight[0] - 1, false],
          [Math.max(s, highlight[0]), Math.min(e, highlight[1]), true],
          [highlight[1] + 1, e, false],
        ]
      : [[s, e, false]]
  const glyph = (
    exons: [number, number][],
    cds: [number, number] | null,
    y: number,
    hollow: boolean,
  ) => {
    const intron = `<line x1="${x(exons[0]?.[0] ?? low)}" y1="${y}" x2="${x(exons.at(-1)?.[1] ?? low)}" y2="${y}" stroke="var(--text-2)" stroke-width="2" />`
    const parts = (a: number, b: number): [number, number, number][] =>
      cds
        ? [
            [a, Math.min(b, cds[0] - 1), UTR],
            [Math.max(a, cds[0]), Math.min(b, cds[1]), CODING],
            [Math.max(a, cds[1] + 1), b, UTR],
          ]
        : [[a, b, UTR]]
    const boxes = exons
      .flatMap(([s, e]) =>
        cuts(s, e).flatMap(([a, b, marked]) =>
          parts(a, b)
            .filter(([from, to]) => to >= from)
            .map(([from, to, h]) => {
              const tone = marked ? 'var(--caution)' : 'var(--text-2)'
              return `<rect x="${x(from)}" y="${y - h / 2}" width="${Math.max(2, x(to + 1) - x(from))}" height="${h}" fill="${hollow ? 'var(--surface)' : tone}" stroke="${tone}" stroke-width="${hollow ? 2 : 0}" />`
            }),
        ),
      )
      .join('')
    return `${intron}${boxes}`
  }
  const label = (title: string, detail: string, y: number) =>
    `<text x="96" y="${y - 2}" class="name">${esc(title)}</text><text x="96" y="${y + 20}" class="small">${esc(detail)}</text>`
  const row = (t: GeneTranscript, y: number) => {
    const form = mapped.get(unversioned(t.id))
    const detail = [
      unversioned(t.id),
      form ? `isoform ${form.name}` : t.type.replace(/_/g, ' '),
      ...(t.tags.includes('MANE_Select') ? ['MANE Select'] : []),
    ].join(' · ')
    return `${label(t.name, detail, y)}${glyph(t.exons, t.cds, y, false)}`
  }
  const [lostFrom, lostTo] = residuesOfExon(record.exons?.junctions ?? [], exon)
  const lost = lostTo - lostFrom + 1
  const domain = record.features.find(
    f => f.type === 'Domain' && f.start <= lostTo && f.end >= lostFrom,
  )
  const proteinX = (residue: number) =>
    LEFT + ((residue - 1) / record.length) * (RIGHT - LEFT)
  const shiftedX = (residue: number) =>
    proteinX(residue > lostTo ? residue - lost : residue)
  const bar = (
    y: number,
    from: number,
    to: number,
    fill: string,
    shifted: boolean,
  ) => {
    const place = shifted ? shiftedX : proteinX
    return `<rect x="${place(from)}" y="${y - 9}" width="${place(to + 1) - place(from)}" height="18" fill="${fill}" />`
  }
  const bracket = (
    y: number,
    from: number,
    to: number,
    shifted: boolean,
    text: string,
  ) => {
    const place = shifted ? shiftedX : proteinX
    return `<path d="M${place(from)} ${y - 8} V${y - 14} H${place(to + 1)} V${y - 8}" fill="none" stroke="var(--text)" stroke-width="1.5" />${text ? `<text x="${place(from)}" y="${y - 20}" class="small">${esc(text)}</text>` : ''}`
  }
  const leadTop = 116
  const canonicalY = leadTop + 64
  const skipY = canonicalY + 112
  const proteinTop = skipY + 104
  const leadBottom = proteinTop + 78
  const setsTop = leadBottom + 38
  const codingTop = setsTop + 62
  const codingBottom = codingTop + 66 + coding.length * ROW
  const otherTop = codingBottom + 26
  const otherBottom = otherTop + 60 + others.length * ROW
  const height = otherBottom + 42
  const proteinRows = (y: number) => {
    const grey = 'var(--text-2)'
    const orange = 'var(--caution)'
    return `<line x1="64" y1="${y - 46}" x2="${WIDTH - 64}" y2="${y - 46}" stroke="var(--caution)" stroke-opacity="0.4" stroke-width="1.5" />${label(`${record.gene} protein`, `${record.length} residues, ${lost} lost without exon ${exon}`, y + 4)}${domain ? bracket(y, domain.start, domain.end, false, `${domain.description} (${domain.start}–${domain.end})`) : ''}${bar(y, 1, lostFrom - 1, grey, false)}${bar(y, lostFrom, lostTo, orange, false)}${bar(y, lostTo + 1, record.length, grey, false)}<text x="${(proteinX(lostFrom) + proteinX(lostTo + 1)) / 2}" y="${y + 4.5}" class="bar-label">residues ${lostFrom}–${lostTo}</text>${bar(y + 42, 1, lostFrom - 1, grey, true)}${bar(y + 42, lostTo + 1, record.length, grey, true)}<line x1="${shiftedX(lostTo + 1)}" x2="${shiftedX(lostTo + 1)}" y1="${y + 30}" y2="${y + 54}" stroke="${orange}" stroke-width="2.5" /><text x="${shiftedX(record.length + 1) + 10}" y="${y + 47}" class="small">${record.length - lost} residues, in frame</text>`
  }
  const arc =
    skip && canonical && highlight
      ? (() => {
          const before = canonical.exons[exon - 2]
          const after = canonical.exons[exon]
          return before && after
            ? `<path d="M${x(before[1])} ${skipY - CODING / 2} Q ${(x(before[1]) + x(after[0])) / 2} ${skipY - 56} ${x(after[0])} ${skipY - CODING / 2}" fill="none" stroke="var(--caution)" stroke-width="2.5" /><text x="${(x(highlight[0]) + x(highlight[1])) / 2}" y="${skipY - 60}" class="small mid">exon ${exon - 1} joins exon ${exon + 1}</text>`
            : ''
        })()
      : ''
  const ghost = highlight
    ? `<rect x="${x(highlight[0])}" y="${skipY - CODING / 2}" width="${x(highlight[1] + 1) - x(highlight[0])}" height="${CODING}" fill="none" stroke="var(--caution)" stroke-width="2" stroke-dasharray="4 3" /><text x="${(x(highlight[0]) + x(highlight[1])) / 2}" y="${skipY + 34}" class="small mid">exon ${exon}: ${highlight[1] - highlight[0] + 1} nt, ${skip?.inFrame ? 'in frame' : 'out of frame'}, left out</text>`
    : ''
  const lead =
    skip && canonical
      ? `<rect x="40" y="${leadTop}" width="${WIDTH - 70}" height="${leadBottom - leadTop}" rx="28" fill="var(--caution)" fill-opacity="0.06" stroke="var(--caution)" stroke-width="2.5" />${row(canonical, canonicalY)}${label(`${record.gene} without exon ${exon}`, reported.cite, skipY)}${ghost}${glyph(skip.exons, skip.cds, skipY, true)}${arc}${proteinRows(proteinTop)}`
      : ''
  const sets = `<rect x="40" y="${setsTop}" width="${WIDTH - 70}" height="${otherBottom + 22 - setsTop}" rx="28" fill="none" stroke="var(--text-2)" stroke-width="2" /><text x="64" y="${setsTop + 34}" class="set">What the lists hold: GENCODE 49's ${transcripts.length} transcripts of ${esc(record.gene)}</text><text x="${64 + 1}" y="${setsTop + 56}" class="small">To scale on ${esc(record.locus?.split(':')[0] ?? '')}; tall boxes are coding, short boxes are UTR, exon ${exon} in orange</text><rect x="66" y="${codingTop}" width="${WIDTH - 122}" height="${codingBottom - codingTop}" rx="22" fill="var(--interface)" fill-opacity="0.08" stroke="var(--interface)" stroke-width="2.5" /><rect x="72" y="${codingTop + 6}" width="${WIDTH - 134}" height="${codingBottom - codingTop - 12}" rx="18" fill="none" stroke="var(--partner)" stroke-width="2.5" stroke-dasharray="10 6" /><text x="96" y="${codingTop + 36}" class="subset"><tspan fill="var(--interface)">Complete protein-coding: ${coding.length}</tspan><tspan fill="var(--text-2)"> = </tspan><tspan fill="var(--partner)">UniProt ${esc(record.accession)}'s ${record.isoforms.length + 1} isoforms</tspan></text><rect x="66" y="${otherTop}" width="${WIDTH - 122}" height="${otherBottom - otherTop}" rx="22" fill="var(--chain)" fill-opacity="0.15" stroke="var(--chain)" stroke-width="2" /><text x="96" y="${otherTop + 36}" class="subset" fill="var(--text-2)">${esc(sentenceCase([...new Set(others.map(t => t.type.replace(/_/g, ' ')))].join(', ')))}: ${others.length}</text>`
  const rows = [
    ...coding.map((t, i) => row(t, codingTop + 78 + i * ROW)),
    ...others.map((t, i) => row(t, otherTop + 78 + i * ROW)),
  ].join('')
  return `<svg class="transcript-sets-figure" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${esc(`${record.gene} without exon ${exon}, drawn above the ${transcripts.length} transcripts GENCODE 49 lists: the skipped exon leaves ${lost} residues out of the protein, and neither GENCODE nor UniProt lists the mRNA`)}"><style>
.transcript-sets-figure text { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
.transcript-sets-figure .title { font-size: 30px; font-weight: 650; fill: var(--text); }
.transcript-sets-figure .subtitle { font-size: 18px; fill: var(--text-2); }
.transcript-sets-figure .set { font-size: 21px; font-weight: 700; fill: var(--text); }
.transcript-sets-figure .subset { font-size: 18px; font-weight: 650; }
.transcript-sets-figure .name { font-size: 18px; font-weight: 600; fill: var(--text); }
.transcript-sets-figure .small { font-size: 15px; fill: var(--text-2); }
.transcript-sets-figure .bar-label { font-size: 13px; font-weight: 600; text-anchor: middle; fill: var(--surface); }
.transcript-sets-figure .mid { text-anchor: middle; fill: var(--caution); font-weight: 600; }
</style><text x="40" y="52" class="title">${esc(record.gene)} without exon ${exon}: ${lost} residues fewer, ${skip?.inFrame ? 'in frame' : 'out of frame'}</text><text x="40" y="86" class="subtitle">${esc(reported.summary)}</text>${lead}${sets}${rows}</svg>`
}
