import type { GeneRecord } from '../../src/types.ts'
import type { ExpressionCase } from './expression.ts'
import { esc } from './html.ts'
import { percent } from './share-chart.ts'

export interface SashimiOptions {
  title: string
  names: { canonical: string; isoform: string }
  exons: [first: number, last: number]
  notes?: Record<number, string>
  absent: string[]
  tissues: Map<string, string>
}

type Intron = [number, number]

const WIDTH = 760
const TRACK_X = 205
const TRACK_END = 740
const INTRON = 44
const BOX = 22
const HEADER = 150
const ROWS_TOP = HEADER + 100
const ROW = 172
const ARC = 44
const MAX_STROKE = 14

export function sashimiFigure(
  record: GeneRecord,
  expression: ExpressionCase,
  options: SashimiOptions,
) {
  const canonical = record.structures[record.canonical.accession]
  const isoform = record.structures[expression.isoform]
  if (!canonical || !isoform) {
    throw new Error(`${record.gene}: no exons for ${expression.isoform}`)
  }
  const strand = canonical.strand
  const hatch = `sashimi-hatch-${record.gene}`
  const ordered = canonical.exons
    .toSorted((a, b) => (strand < 0 ? b[0] - a[0] : a[0] - b[0]))
    .map(([low, high], index) => ({ number: index + 1, low, high }))
  const shown = ordered.filter(
    e => e.number >= options.exons[0] && e.number <= options.exons[1],
  )
  const bases = shown.reduce((sum, e) => sum + e.high - e.low + 1, 0)
  const scale =
    (TRACK_END - TRACK_X - INTRON * (shown.length - 1)) / Math.max(bases, 1)
  const placed = shown.reduce<((typeof shown)[number] & { x: number })[]>(
    (list, e) => {
      const previous = list.at(-1)
      const x = previous
        ? previous.x + (previous.high - previous.low + 1) * scale + INTRON
        : TRACK_X
      return [...list, { ...e, x }]
    },
    [],
  )
  const exonAt = (coordinate: number) => {
    const found = placed.find(e => coordinate >= e.low && coordinate <= e.high)
    if (!found) {
      throw new Error(`${record.gene}: ${coordinate} is outside exons shown`)
    }
    return found
  }
  const before = (coordinate: number) => {
    const e = exonAt(coordinate)
    return e.x + (strand < 0 ? e.high - coordinate : coordinate - e.low) * scale
  }
  const after = (coordinate: number) => before(coordinate) + scale
  const ends = ([start, end]: Intron) => {
    const donor = strand < 0 ? end + 1 : start - 1
    const acceptor = strand < 0 ? start - 1 : end + 1
    const into =
      strand < 0
        ? exonAt(acceptor).high - acceptor
        : acceptor - exonAt(acceptor).low
    return {
      from: after(donor),
      to: before(acceptor),
      path: `exon ${exonAt(donor).number} → ${into ? `${into} bases into ` : ''}exon ${exonAt(acceptor).number}`,
    }
  }
  const canonicalJunction = ends(expression.junctions.canonical)
  const isoformJunction = ends(expression.junctions.isoform)
  const [codingLow, codingHigh] = canonical.coding
  const absent = placed.flatMap(e => {
    const kept = [
      ...isoform.exons,
      [e.low, codingLow - 1] satisfies Intron,
      [codingHigh + 1, e.high] satisfies Intron,
    ].filter(([low, high]) => high >= e.low && low <= e.high)
    const missing = kept.reduce<Intron[]>(
      (gaps, [low, high]) =>
        gaps.flatMap(([gl, gh]): Intron[] =>
          [
            [gl, Math.min(gh, low - 1)] satisfies Intron,
            [Math.max(gl, high + 1), gh] satisfies Intron,
          ].filter(([a, b]) => a <= b),
        ),
      [[e.low, e.high]],
    )
    return missing.map(([low, high]) => {
      const xs = [before(low), after(low), before(high), after(high)]
      return { x0: Math.min(...xs), x1: Math.max(...xs) }
    })
  })

  const exonBoxes = (cy: number, named: boolean) =>
    placed
      .map(e => {
        const width = (e.high - e.low + 1) * scale
        return `<rect x="${e.x}" y="${cy - BOX / 2}" width="${width}" height="${BOX}" rx="3" class="exon" />${named ? `<text x="${e.x + width / 2}" y="${cy - BOX / 2 - 8}" class="exon-name">exon ${e.number}</text>${options.notes?.[e.number] ? `<text x="${e.x + width / 2}" y="${cy + BOX / 2 + 18}" class="note">${esc(options.notes[e.number])}</text>` : ''}` : ''}`
      })
      .join('') +
    absent
      .map(
        a =>
          `<rect x="${a.x0}" y="${cy - BOX / 2}" width="${a.x1 - a.x0}" height="${BOX}" class="absent" fill="url(#${hatch})" />`,
      )
      .join('') +
    placed
      .slice(1)
      .map((e, index) => {
        const previous = placed[index]
        const from = previous
          ? previous.x + (previous.high - previous.low + 1) * scale
          : e.x
        return `<line x1="${from}" y1="${cy}" x2="${e.x}" y2="${cy}" class="intron" />`
      })
      .join('')

  const absentFrom = Math.min(...absent.map(a => a.x0))
  const absentTo = Math.max(...absent.map(a => a.x1))
  const absentNote = absent.length
    ? `<path d="M${absentFrom} ${HEADER + 38} v8 H${absentTo} v-8" class="bracket" />${options.absent
        .map(
          (line, index) =>
            `<text x="${(absentFrom + absentTo) / 2}" y="${HEADER + 66 + index * 17}" class="absent-note">${esc(line)}</text>`,
        )
        .join('')}`
    : ''

  const arc = (
    junction: { from: number; to: number },
    cy: number,
    side: -1 | 1,
    stroke: number,
    tone: string,
    reads: number,
  ) => {
    const y = cy + (side * BOX) / 2
    const peak = y + side * ARC * (4 / 3)
    const labelY =
      side < 0 ? y - ARC - stroke / 2 - 6 : y + ARC + stroke / 2 + 18
    return `<path d="M${junction.from} ${y} C ${junction.from} ${peak}, ${junction.to} ${peak}, ${junction.to} ${y}" fill="none" stroke="var(--${tone})" stroke-width="${stroke}" stroke-linecap="round" /><text x="${(junction.from + junction.to) / 2}" y="${labelY}" class="reads" fill="var(--${tone})">${reads.toLocaleString()} read${reads === 1 ? '' : 's'}</text>`
  }

  const rowData = [...options.tissues].flatMap(([name, label]) =>
    expression.tissues
      .filter(t => t.tissue === name)
      .map(t => ({ ...t, label })),
  )
  const rows = rowData
    .map((row, index) => {
      const top = ROWS_TOP + index * ROW
      const cy = top + 82
      const total = row.isoformReads + row.canonicalReads
      const width = (reads: number) =>
        Math.max(1.5, total ? (MAX_STROKE * reads) / total : 0)
      return `<g><line x1="0" y1="${top}" x2="${WIDTH}" y2="${top}" class="rule" /><text x="0" y="${cy - 22}" class="tissue">${esc(row.label)}</text><text x="0" y="${cy - 4}" class="samples">${row.samples.toLocaleString()} samples</text><text x="0" y="${cy + 16}" class="share by-reads">${esc(options.names.isoform)} by reads: ${total ? percent(row.isoformReads / total) : '–'}</text><text x="0" y="${cy + 34}" class="share by-tpm">${esc(options.names.isoform)} by TPM: ${row.tpmShare === null ? 'not in GTEx' : percent(row.tpmShare)}</text>${exonBoxes(cy, false)}${arc(canonicalJunction, cy, -1, width(row.canonicalReads), 'text-2', row.canonicalReads)}${arc(isoformJunction, cy, 1, width(row.isoformReads), 'interface', row.isoformReads)}</g>`
    })
    .join('')

  const height = ROWS_TOP + rowData.length * ROW + 4
  const legend = (y: number, tone: string, text: string) =>
    `<line x1="0" y1="${y - 5}" x2="28" y2="${y - 5}" stroke="var(--${tone})" stroke-width="5" stroke-linecap="round" /><text x="38" y="${y}" class="legend">${esc(text)}</text>`
  const label = `${options.title}. Arcs join the exons each junction connects, labelled with GTEx v8 read counts: ${rowData.map(r => `${r.label}, ${r.canonicalReads.toLocaleString()} reads for ${options.names.canonical} and ${r.isoformReads.toLocaleString()} for ${options.names.isoform}`).join('; ')}.`
  return `<div class="table-wrap sashimi-wrap"><svg class="sashimi" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${esc(label)}"><style>
.sashimi { display: block; width: 100%; max-width: 760px; min-width: 560px; height: auto; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
.sashimi text { fill: var(--text); }
.sashimi .title { font-size: 17px; font-weight: 650; }
.sashimi .subtitle, .sashimi .samples { font-size: 13px; fill: var(--text-2); }
.sashimi .legend { font-size: 14px; }
.sashimi .exon { fill: var(--surface-2); stroke: var(--text-2); stroke-width: 1.5; }
.sashimi .absent { stroke: var(--text-2); stroke-width: 1.5; }
.sashimi .intron { stroke: var(--text-2); stroke-width: 1.5; stroke-dasharray: 3 4; }
.sashimi .exon-name { font-size: 13px; font-weight: 600; text-anchor: middle; }
.sashimi .note { font-size: 12px; fill: var(--text-2); text-anchor: middle; }
.sashimi .bracket { fill: none; stroke: var(--text-2); stroke-width: 1.5; }
.sashimi .absent-note { font-size: 13px; fill: var(--text-2); text-anchor: middle; }
.sashimi .tissue { font-size: 14px; font-weight: 650; }
.sashimi .share { font-size: 13px; font-weight: 600; }
.sashimi .by-reads { fill: var(--interface); }
.sashimi .by-tpm { fill: var(--caution); }
.sashimi .reads { font-size: 13px; font-weight: 600; text-anchor: middle; }
.sashimi .rule { stroke: var(--border); stroke-width: 1; }
</style><defs><pattern id="${hatch}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--surface)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--text-2)" stroke-width="2" /></pattern></defs><text x="0" y="20" class="title">${esc(options.title)}</text><text x="0" y="42" class="subtitle">Read 5′ to 3′ along the transcript; introns shortened. Line width is each junction’s share of reads in its row.</text>${legend(72, 'text-2', `${options.names.canonical} junction, ${canonicalJunction.path}`)}${legend(94, 'interface', `${options.names.isoform} junction, ${isoformJunction.path}`)}${exonBoxes(HEADER, true)}${absentNote}${rows}</svg></div>`
}
