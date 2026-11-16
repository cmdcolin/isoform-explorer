import type { GeneRecord } from '../../src/types.ts'
import type { ExpressionCase } from './expression.ts'
import { esc } from './html.ts'
import { percent } from './share-chart.ts'

export interface SashimiOptions {
  title: string
  names: { canonical: string; isoform: string }
  exons: [first: number, last: number]
  notes?: Record<number, string>
  absent?: string[]
  tissues: Map<string, string>
}

type Intron = [number, number]
type Kind = 'canonical' | 'isoform'

const WIDTH = 760
const TRACK_X = 205
const TRACK_END = 740
const INTRON = 44
const BOX = 22
const HEADER = 150
const ROW = 196
const MAX_STROKE = 14
const TONE: Record<Kind, string> = { canonical: 'text-2', isoform: 'interface' }

function overlaps([low, high]: Intron, [otherLow, otherHigh]: Intron) {
  return high >= otherLow && low <= otherHigh
}

function reads(count: number) {
  return `${count.toLocaleString()} read${count === 1 ? '' : 's'}`
}

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
  const isoformOnly = isoform.exons.filter(
    exon => !canonical.exons.some(other => overlaps(exon, other)),
  )
  const ordered = [
    ...canonical.exons.map(exon => ({ exon, only: false })),
    ...isoformOnly.map(exon => ({ exon, only: true })),
  ]
    .toSorted((a, b) =>
      strand < 0 ? b.exon[0] - a.exon[0] : a.exon[0] - b.exon[0],
    )
    .map(({ exon: [low, high], only }, index) => ({
      number: index + 1,
      low,
      high,
      only,
    }))
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
  const exonAt = (coordinate: number) =>
    placed.find(e => coordinate >= e.low && coordinate <= e.high)
  const before = (coordinate: number) => {
    const e = exonAt(coordinate)
    return e
      ? e.x + (strand < 0 ? e.high - coordinate : coordinate - e.low) * scale
      : 0
  }
  const after = (coordinate: number) => before(coordinate) + scale

  const arcs = (['canonical', 'isoform'] as const).flatMap(kind =>
    expression.differing[kind].flatMap(([start, end]) => {
      const donor = strand < 0 ? end + 1 : start - 1
      const acceptor = strand < 0 ? start - 1 : end + 1
      const donorExon = exonAt(donor)
      const acceptorExon = exonAt(acceptor)
      if (!donorExon || !acceptorExon) {
        return []
      }
      const short = strand < 0 ? donor - donorExon.low : donorExon.high - donor
      const into =
        strand < 0 ? acceptorExon.high - acceptor : acceptor - acceptorExon.low
      return [
        {
          kind,
          key: `${start}-${end}`,
          from: after(donor),
          to: before(acceptor),
          donor: short
            ? `${short} bases before the end of exon ${donorExon.number}`
            : `exon ${donorExon.number}`,
          acceptor: `${into ? `${into} bases into ` : ''}exon ${acceptorExon.number}`,
        },
      ]
    }),
  )
  const path = (kind: Kind) =>
    arcs
      .filter(a => a.kind === kind)
      .toSorted((a, b) => a.from - b.from)
      .reduce(
        (text, a, index) => `${text}${index ? '' : a.donor} → ${a.acceptor}`,
        '',
      )
  const longest = Math.max(...arcs.map(a => a.to - a.from), 1)
  const rise = (a: (typeof arcs)[number]) =>
    28 + 30 * ((a.to - a.from) / longest)

  const [codingLow, codingHigh] = canonical.coding
  const absent = placed
    .filter(e => !e.only)
    .flatMap(e => {
      const kept = [
        ...isoform.exons,
        [e.low, codingLow - 1] satisfies Intron,
        [codingHigh + 1, e.high] satisfies Intron,
      ].filter(range => overlaps(range, [e.low, e.high]))
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
      .slice(1)
      .map((e, index) => {
        const previous = placed[index]
        const from = previous
          ? previous.x + (previous.high - previous.low + 1) * scale
          : e.x
        return `<line x1="${from}" y1="${cy}" x2="${e.x}" y2="${cy}" class="intron" />`
      })
      .join('') +
    placed
      .map(e => {
        const width = (e.high - e.low + 1) * scale
        const note = options.notes?.[e.number]
        return `<rect x="${e.x}" y="${cy - BOX / 2}" width="${width}" height="${BOX}" rx="3" class="exon${e.only ? ' only' : ''}" />${named ? `<text x="${e.x + width / 2}" y="${cy - BOX / 2 - 8}" class="exon-name">exon ${e.number}</text>${note ? `<text x="${e.x + width / 2}" y="${cy + BOX / 2 + 18}" class="note">${esc(note)}</text>` : ''}` : ''}`
      })
      .join('') +
    absent
      .map(
        a =>
          `<rect x="${a.x0}" y="${cy - BOX / 2}" width="${a.x1 - a.x0}" height="${BOX}" class="absent" fill="url(#${hatch})" />`,
      )
      .join('')

  const absentFrom = Math.min(...absent.map(a => a.x0))
  const absentTo = Math.max(...absent.map(a => a.x1))
  const absentLines = options.absent ?? []
  const absentNote =
    absent.length && absentLines.length
      ? `<path d="M${absentFrom} ${HEADER + 38} v8 H${absentTo} v-8" class="bracket" />${absentLines
          .map(
            (line, index) =>
              `<text x="${(absentFrom + absentTo) / 2}" y="${HEADER + 66 + index * 17}" class="absent-note">${esc(line)}</text>`,
          )
          .join('')}`
      : ''
  const rowsTop =
    HEADER + 50 + 17 * absentLines.length + (absentLines.length ? 30 : 0)

  const rowData = [...options.tissues].flatMap(([name, label]) =>
    expression.tissues
      .filter(t => t.tissue === name)
      .map(t => ({ ...t, label })),
  )
  const rows = rowData
    .map((row, index) => {
      const top = rowsTop + index * ROW
      const cy = top + 94
      const counts = arcs.map(a => row.junctionReads[a.key] ?? 0)
      const most = Math.max(...counts, 1)
      const total = row.isoformReads + row.canonicalReads
      const drawn = arcs
        .map((a, k) => {
          const count = counts[k] ?? 0
          const stroke = Math.max(1.5, (MAX_STROKE * count) / most)
          const side = a.kind === 'canonical' ? -1 : 1
          const y = cy + (side * BOX) / 2
          const height = rise(a)
          const peak = y + side * height * (4 / 3)
          const labelY =
            side < 0
              ? y - height - stroke / 2 - 6
              : y + height + stroke / 2 + 16
          return `<path d="M${a.from} ${y} C ${a.from} ${peak}, ${a.to} ${peak}, ${a.to} ${y}" fill="none" stroke="var(--${TONE[a.kind]})" stroke-width="${stroke}" stroke-linecap="round" /><text x="${(a.from + a.to) / 2}" y="${labelY}" class="reads">${reads(count)}</text>`
        })
        .join('')
      return `<g><line x1="0" y1="${top}" x2="${WIDTH}" y2="${top}" class="rule" /><text x="0" y="${cy - 22}" class="tissue">${esc(row.label)}</text><text x="0" y="${cy - 4}" class="samples">${row.samples.toLocaleString()} samples</text><text x="0" y="${cy + 16}" class="share by-reads">${esc(options.names.isoform)} by reads: ${total ? percent(row.isoformReads / total) : '–'}</text><text x="0" y="${cy + 34}" class="share by-tpm">${esc(options.names.isoform)} by TPM: ${row.tpmShare === null ? 'not in GTEx' : percent(row.tpmShare)}</text>${exonBoxes(cy, false)}${drawn}</g>`
    })
    .join('')

  const height = rowsTop + rowData.length * ROW + 4
  const legend = (y: number, kind: Kind) =>
    `<line x1="0" y1="${y - 5}" x2="28" y2="${y - 5}" stroke="var(--${TONE[kind]})" stroke-width="5" stroke-linecap="round" /><text x="38" y="${y}" class="legend">${esc(`${options.names[kind]}: ${path(kind)}`)}</text>`
  const swatches = [
    ...(absent.length
      ? [
          {
            fill: `fill="url(#${hatch})" class="absent"`,
            text: `not in ${options.names.isoform}`,
          },
        ]
      : []),
    ...(placed.some(e => e.only)
      ? [
          {
            fill: 'class="exon only"',
            text: `only in ${options.names.isoform}`,
          },
        ]
      : []),
  ]
    .map(
      ({ fill, text }, index) =>
        `<rect x="500" y="${58 + 22 * index}" width="28" height="16" rx="2" ${fill} /><text x="538" y="${72 + 22 * index}" class="legend">${esc(text)}</text>`,
    )
    .join('')
  const label = `${options.title}. Arcs join the exons each junction connects, ${options.names.canonical}'s above and ${options.names.isoform}'s below, labelled with GTEx v8 read counts. ${rowData.map(r => `${r.label}: ${arcs.map(a => `${a.kind === 'canonical' ? options.names.canonical : options.names.isoform} ${a.donor} → ${a.acceptor}, ${reads(r.junctionReads[a.key] ?? 0)}`).join('; ')}`).join('. ')}.`
  return `<div class="table-wrap sashimi-wrap"><svg class="sashimi" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${esc(label)}"><style>
.sashimi { display: block; width: 100%; max-width: 760px; min-width: 560px; height: auto; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
.sashimi text { fill: var(--text); }
.sashimi .title { font-size: 17px; font-weight: 650; }
.sashimi .subtitle, .sashimi .samples { font-size: 13px; fill: var(--text-2); }
.sashimi .legend { font-size: 14px; }
.sashimi .exon { fill: var(--surface-2); stroke: var(--text-2); stroke-width: 1.5; }
.sashimi .exon.only { fill: color-mix(in srgb, var(--interface) 30%, var(--surface)); stroke: var(--interface); }
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
.sashimi .reads { font-size: 12.5px; font-weight: 600; text-anchor: middle; }
.sashimi .rule { stroke: var(--border); stroke-width: 1; }
</style><defs><pattern id="${hatch}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--surface)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--text-2)" stroke-width="2" /></pattern></defs><text x="0" y="20" class="title">${esc(options.title)}</text><text x="0" y="42" class="subtitle">Read 5′ to 3′ along the transcript; introns shortened. Line width is proportional to reads within each row.</text>${legend(72, 'canonical')}${legend(94, 'isoform')}${swatches}${exonBoxes(HEADER, true)}${absentNote}${rows}</svg></div>`
}
