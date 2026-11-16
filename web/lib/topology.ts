import type { GeneRecord, Isoform } from '../../src/types.ts'
import { esc } from './html.ts'
import { type Run, carriedRuns, subtractRuns } from './loss.ts'

export interface Mark {
  start: number
  end: number
  name: string
  tone: 'caution' | 'interface'
}

interface Point {
  x: number
  y: number
}

const PANEL = 700
const HEIGHT = 800
const TOP = 470
const BOTTOM = 560
const OVERHANG = 16
const HELIX = 36
const FIRST_HELIX = 250
const HELIX_STEP = 60

function helices(record: Pick<GeneRecord, 'features'>) {
  return record.features
    .filter(f => f.type === 'Transmembrane')
    .toSorted((a, b) => a.start - b.start)
}

function helixX(index: number) {
  return FIRST_HELIX + index * HELIX_STEP
}

function loop(from: Point, to: Point, count: number, up: boolean) {
  const depth = Math.min(28 + count * 3.2, 150)
  return Array.from({ length: count }, (_, k) => {
    const t = ((k + 1) / (count + 1)) * Math.PI
    return {
      x: from.x + ((to.x - from.x) * (1 - Math.cos(t))) / 2,
      y: from.y + (up ? -1 : 1) * depth * Math.sin(t),
    }
  })
}

function tail(from: Point, to: Point, count: number, waves: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  return Array.from({ length: count }, (_, k) => {
    const s = (k + 1) / count
    const wiggle = 18 * Math.sin(s * waves * 2 * Math.PI)
    return {
      x: from.x + dx * s - (dy / length) * wiggle,
      y: from.y + dy * s + (dx / length) * wiggle,
    }
  })
}

export function chainPoints(record: Pick<GeneRecord, 'features' | 'length'>) {
  const segments = helices(record)
  const points: Point[] = Array.from({ length: record.length + 1 }, () => ({
    x: 0,
    y: 0,
  }))
  const place = (start: number, placed: Point[]) =>
    placed.forEach((p, k) => {
      points[start + k] = p
    })
  const ends = segments.map((segment, index) => {
    const down = index % 2 === 0
    const x = helixX(index)
    const top = { x, y: TOP - OVERHANG }
    const bottom = { x, y: BOTTOM + OVERHANG }
    const count = segment.end - segment.start + 1
    place(
      segment.start,
      Array.from({ length: count }, (_, k) => {
        const s = count === 1 ? 0 : k / (count - 1)
        return {
          x,
          y: down
            ? top.y + s * (bottom.y - top.y)
            : bottom.y - s * (bottom.y - top.y),
        }
      }),
    )
    return down ? { first: top, last: bottom } : { first: bottom, last: top }
  })
  const first = segments[0]
  const last = segments.at(-1)
  const firstEnd = ends[0]
  const lastEnd = ends.at(-1)
  if (first && last && firstEnd && lastEnd) {
    place(
      1,
      tail(firstEnd.first, { x: 70, y: 70 }, first.start - 1, 3.5).toReversed(),
    )
    segments.slice(1).forEach((segment, index) => {
      const previous = segments[index]
      const from = ends[index]?.last
      const to = ends[index + 1]?.first
      if (previous && from && to) {
        place(
          previous.end + 1,
          loop(from, to, segment.start - previous.end - 1, from.y < TOP),
        )
      }
    })
    place(
      last.end + 1,
      tail(
        lastEnd.last,
        { x: lastEnd.last.x + 40, y: lastEnd.last.y < TOP ? 120 : 760 },
        record.length - last.end,
        1.5,
      ),
    )
  }
  return points
}

function polyline(points: Point[], run: Run) {
  return points
    .slice(run[0], run[1] + 1)
    .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
}

function membrane() {
  const heads = (y: number) =>
    Array.from(
      { length: 34 },
      (_, k) => `<circle cx="${12 + k * 20}" cy="${y}" r="7" />`,
    ).join('')
  return `<rect x="0" y="${TOP}" width="${PANEL}" height="${BOTTOM - TOP}" fill="var(--surface-2)" /><g fill="var(--chain)" opacity="0.55">${heads(TOP + 7)}${heads(BOTTOM - 7)}</g><g class="side" font-size="17" fill="var(--text-2)"><text x="14" y="${TOP - 14}">outside</text><text x="14" y="${BOTTOM + 30}">cytoplasm</text></g>`
}

function panel(
  record: Pick<GeneRecord, 'features' | 'length'>,
  title: [string, string],
  marks: Mark[],
  absent: Run[],
) {
  const points = chainPoints(record)
  const all: Run = [1, record.length]
  const shown = absent.reduce<Run[]>(
    (runs, gap) => runs.flatMap(run => subtractRuns(run, [gap])),
    [all],
  )
  const helixRects = helices(record)
    .map(
      (_, index) =>
        `<rect x="${helixX(index) - HELIX / 2}" y="${TOP - OVERHANG - 6}" width="${HELIX}" height="${BOTTOM - TOP + 2 * OVERHANG + 12}" rx="${HELIX / 2}" fill="var(--diagram-protein)" stroke="var(--text-2)" stroke-width="1.5" /><text x="${helixX(index)}" y="${(TOP + BOTTOM) / 2 + 7}" text-anchor="middle" font-size="19" font-weight="600" fill="var(--text)">${index + 1}</text>`,
    )
    .join('')
  const kept = shown
    .map(
      run =>
        `<polyline points="${polyline(points, run)}" fill="none" stroke="var(--chain)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />`,
    )
    .join('')
  const marked = marks
    .flatMap(mark =>
      shown.flatMap(run => {
        const start = Math.max(run[0], mark.start)
        const end = Math.min(run[1], mark.end)
        return start <= end
          ? [
              `<polyline points="${polyline(points, [start, end])}" fill="none" stroke="var(--${mark.tone})" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />`,
            ]
          : []
      }),
    )
    .join('')
  const missing = absent
    .map(
      run =>
        `<polyline points="${polyline(points, run)}" fill="none" stroke="var(--caution)" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round" />`,
    )
    .join('')
  const ends = shown
    .map(
      run =>
        `<circle cx="${points[run[0]]?.x}" cy="${points[run[0]]?.y}" r="7" fill="var(--text)" />`,
    )
    .join('')
  const labels = [
    ...marks.flatMap(mark => {
      const visible = shown
        .map(
          run =>
            [
              Math.max(run[0], mark.start),
              Math.min(run[1], mark.end),
            ] satisfies Run,
        )
        .filter(([start, end]) => start <= end)
      const first = visible[0]?.[0] ?? 0
      const last = visible.at(-1)?.[1] ?? 0
      return visible.length
        ? [
            {
              at: points[first],
              text: `${mark.name}, ${first}–${last}`,
              tone: mark.tone,
            },
          ]
        : []
    }),
    ...absent.map(run => ({
      at: points[run[0]],
      text: `absent: residues ${run[0]}–${run[1]}`,
      tone: 'caution',
    })),
  ]
    .map(
      ({ at, text, tone }) =>
        `<text x="${(at?.x ?? 0) + 24}" y="${(at?.y ?? 0) + 6}" font-size="19" font-weight="600" fill="var(--${tone})">${esc(text)}</text>`,
    )
    .join('')
  return `${membrane()}<text x="${PANEL - 20}" y="40" text-anchor="end" font-size="24" font-weight="650" fill="var(--text)">${esc(title[0])}</text><text x="${PANEL - 20}" y="70" text-anchor="end" font-size="18" fill="var(--text-2)">${esc(title[1])}</text>${missing}${kept}${marked}${helixRects}${ends}${labels}`
}

export function topologyFigure(
  record: GeneRecord,
  isoform: Isoform,
  marks: Mark[],
) {
  const absent = subtractRuns([1, record.length], carriedRuns(isoform.segments))
  return `<svg class="topology" viewBox="0 0 ${PANEL * 2} ${HEIGHT}" role="img" aria-label="${esc(`${record.gene} drawn across the membrane, canonical on the left and isoform ${isoform.name} on the right, with the residues the isoform lacks dashed`)}"><g>${panel(record, [`Canonical ${record.gene}`, `${record.canonical.accession} · ${record.length} residues`], marks, [])}</g><g transform="translate(${PANEL} 0)">${panel(record, [`Isoform ${isoform.name}`, `${isoform.accession} · ${isoform.length} residues`], marks, absent)}</g><line x1="${PANEL}" y1="20" x2="${PANEL}" y2="${HEIGHT - 20}" stroke="var(--border)" stroke-width="2" /></svg>`
}
