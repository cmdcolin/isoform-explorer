import type { GeneTranscript } from '../../src/gene-transcripts.ts'
import type { GeneRecord } from '../../src/types.ts'
import { esc } from './html.ts'

const WIDTH = 1400
const LEFT = 500
const RIGHT = 1300
const ROW = 58
const UTR = 14
const CODING = 28

const STYLE = `
.exon-figure text { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
.exon-figure .title { font-size: 30px; font-weight: 650; fill: var(--text); }
.exon-figure .subtitle { font-size: 18px; fill: var(--text-2); }
.exon-figure .subset { font-size: 18px; font-weight: 650; }
.exon-figure .name { font-size: 18px; font-weight: 600; fill: var(--text); }
.exon-figure .small { font-size: 15px; fill: var(--text-2); }
.exon-figure .bar-label { font-size: 13px; font-weight: 600; text-anchor: middle; fill: var(--surface); }
.exon-figure .mid { text-anchor: middle; fill: var(--caution); font-weight: 600; }
.exon-figure .note { font-size: 17px; font-weight: 600; fill: var(--caution); }
`

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

/** Transcripts whose exon before `exon` is spliced straight to the one after. */
export function skipsExon(
  transcripts: GeneTranscript[],
  canonical: GeneTranscript,
  exon: number,
) {
  const before = canonical.exons[exon - 2]
  const after = canonical.exons[exon]
  return transcripts.filter(t =>
    t.exons.some(
      (piece, i) =>
        piece[1] === before?.[1] && t.exons[i + 1]?.[0] === after?.[0],
    ),
  )
}

function geometry(
  record: GeneRecord,
  transcripts: GeneTranscript[],
  exon: number,
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
  return { coding, others, canonical, skip, highlight, x, glyph, label, row }
}

function svg(height: number, label: string, body: string) {
  return `<svg class="exon-figure" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${esc(label)}"><style>${STYLE}</style>${body}</svg>`
}

/** The canonical mRNA, the one that skips `exon`, and what the protein loses. */
export function exonSkipFigure(
  record: GeneRecord,
  transcripts: GeneTranscript[],
  exon: number,
  reported: Reported,
) {
  const { canonical, skip, highlight, x, glyph, label, row } = geometry(
    record,
    transcripts,
    exon,
  )
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
  const bracket = (y: number, from: number, to: number, text: string) =>
    `<path d="M${proteinX(from)} ${y - 8} V${y - 14} H${proteinX(to + 1)} V${y - 8}" fill="none" stroke="var(--text)" stroke-width="1.5" /><text x="${proteinX(from)}" y="${y - 20}" class="small">${esc(text)}</text>`
  const top = 116
  const canonicalY = top + 64
  const skipY = canonicalY + 112
  const proteinY = skipY + 104
  const bottom = proteinY + 78
  const grey = 'var(--text-2)'
  const orange = 'var(--caution)'
  const arc =
    skip && canonical && highlight
      ? (() => {
          const before = canonical.exons[exon - 2]
          const after = canonical.exons[exon]
          return before && after
            ? `<path d="M${x(before[1])} ${skipY - CODING / 2} Q ${(x(before[1]) + x(after[0])) / 2} ${skipY - 56} ${x(after[0])} ${skipY - CODING / 2}" fill="none" stroke="${orange}" stroke-width="2.5" /><text x="${(x(highlight[0]) + x(highlight[1])) / 2}" y="${skipY - 60}" class="small mid">exon ${exon - 1} joins exon ${exon + 1}</text>`
            : ''
        })()
      : ''
  const ghost = highlight
    ? `<rect x="${x(highlight[0])}" y="${skipY - CODING / 2}" width="${x(highlight[1] + 1) - x(highlight[0])}" height="${CODING}" fill="none" stroke="${orange}" stroke-width="2" stroke-dasharray="4 3" /><text x="${(x(highlight[0]) + x(highlight[1])) / 2}" y="${skipY + 34}" class="small mid">exon ${exon}: ${highlight[1] - highlight[0] + 1} nt, ${skip?.inFrame ? 'in frame' : 'out of frame'}, left out</text>`
    : ''
  const proteins = `<line x1="64" y1="${proteinY - 46}" x2="${WIDTH - 64}" y2="${proteinY - 46}" stroke="${orange}" stroke-opacity="0.4" stroke-width="1.5" />${label(`${record.gene} protein`, `${record.length} residues, ${lost} lost without exon ${exon}`, proteinY + 4)}${domain ? bracket(proteinY, domain.start, domain.end, `${domain.description} (${domain.start}–${domain.end})`) : ''}${bar(proteinY, 1, lostFrom - 1, grey, false)}${bar(proteinY, lostFrom, lostTo, orange, false)}${bar(proteinY, lostTo + 1, record.length, grey, false)}<text x="${(proteinX(lostFrom) + proteinX(lostTo + 1)) / 2}" y="${proteinY + 4.5}" class="bar-label">residues ${lostFrom}–${lostTo}</text>${bar(proteinY + 42, 1, lostFrom - 1, grey, true)}${bar(proteinY + 42, lostTo + 1, record.length, grey, true)}<line x1="${shiftedX(lostTo + 1)}" x2="${shiftedX(lostTo + 1)}" y1="${proteinY + 30}" y2="${proteinY + 54}" stroke="${orange}" stroke-width="2.5" /><text x="${shiftedX(record.length + 1) + 10}" y="${proteinY + 47}" class="small">${record.length - lost} residues, in frame</text>`
  const panel =
    skip && canonical
      ? `<rect x="40" y="${top}" width="${WIDTH - 70}" height="${bottom - top}" rx="28" fill="${orange}" fill-opacity="0.06" stroke="${orange}" stroke-width="2.5" />${row(canonical, canonicalY)}${label(`${record.gene} without exon ${exon}`, reported.cite, skipY)}${ghost}${glyph(skip.exons, skip.cds, skipY, true)}${arc}${proteins}`
      : ''
  return svg(
    bottom + 20,
    `${record.gene} drawn twice: the canonical transcript with exon ${exon}, and the mRNA without it, which leaves ${lost} residues out of the protein`,
    `<text x="40" y="52" class="title">${esc(record.gene)} without exon ${exon}: ${lost} residues fewer, ${skip?.inFrame ? 'in frame' : 'out of frame'}</text><text x="40" y="86" class="subtitle">${esc(reported.summary)}</text>${panel}`,
  )
}

/** Every transcript the annotation lists hold, and which are UniProt isoforms. */
export function transcriptSetsFigure(
  record: GeneRecord,
  transcripts: GeneTranscript[],
  exon: number,
) {
  const { coding, others, canonical, row } = geometry(record, transcripts, exon)
  const across = canonical ? skipsExon(transcripts, canonical, exon) : []
  const frameTop = 58
  const codingTop = frameTop + 36
  const codingBottom = codingTop + 66 + coding.length * ROW
  const otherTop = codingBottom + 26
  const otherBottom = otherTop + 60 + others.length * ROW
  const frameBottom = otherBottom + 22
  const types = sentenceCase(
    [...new Set(others.map(t => t.type.replace(/_/g, ' ')))].join(', '),
  )
  const sets = `<rect x="40" y="${frameTop}" width="${WIDTH - 70}" height="${frameBottom - frameTop}" rx="28" fill="none" stroke="var(--text-2)" stroke-width="2" /><rect x="66" y="${codingTop}" width="${WIDTH - 122}" height="${codingBottom - codingTop}" rx="22" fill="var(--interface)" fill-opacity="0.08" stroke="var(--interface)" stroke-width="2.5" /><rect x="72" y="${codingTop + 6}" width="${WIDTH - 134}" height="${codingBottom - codingTop - 12}" rx="18" fill="none" stroke="var(--partner)" stroke-width="2.5" stroke-dasharray="10 6" /><text x="96" y="${codingTop + 36}" class="subset"><tspan fill="var(--interface)">Complete protein-coding: ${coding.length}</tspan><tspan fill="var(--text-2)"> = </tspan><tspan fill="var(--partner)">UniProt ${esc(record.accession)}'s ${record.isoforms.length + 1} isoforms</tspan></text><rect x="66" y="${otherTop}" width="${WIDTH - 122}" height="${otherBottom - otherTop}" rx="22" fill="var(--chain)" fill-opacity="0.15" stroke="var(--chain)" stroke-width="2" /><text x="96" y="${otherTop + 36}" class="subset" fill="var(--text-2)">${esc(types)}: ${others.length}</text>`
  const rows = [
    ...coding.map((t, i) => row(t, codingTop + 78 + i * ROW)),
    ...others.map((t, i) => row(t, otherTop + 78 + i * ROW)),
  ].join('')
  const footer =
    across.length === 0
      ? `None of the ${transcripts.length} joins exon ${exon - 1} to exon ${exon + 1}`
      : `${across.map(t => t.name).join(', ')} joins exon ${exon - 1} to exon ${exon + 1}`
  return svg(
    frameBottom + 56,
    `The ${transcripts.length} transcripts GENCODE 49 lists for ${record.gene}, of which the ${coding.length} complete protein-coding ones are UniProt's isoforms, the rest typed ${types.toLowerCase()}`,
    `<text x="40" y="36" class="subtitle">GENCODE 49's ${transcripts.length} transcripts of ${esc(record.gene)}, to scale on ${esc(record.locus?.split(':')[0] ?? '')}; tall boxes are coding, short boxes are UTR, exon ${exon} in orange</text>${sets}${rows}<text x="40" y="${frameBottom + 38}" class="note">${esc(footer)}</text>`,
  )
}
