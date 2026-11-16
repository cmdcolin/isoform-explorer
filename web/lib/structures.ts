import type { GeneRecord, Structure } from '../../src/types.ts'
import { esc } from './html.ts'
import { type Run, span } from './loss.ts'
import {
  LEFT,
  RIGHT,
  WIDTH,
  mapRows,
  mapWidth,
  minWidth,
  rowLabel,
  scale,
  spanData,
} from './maps.ts'

type Bases = [start: number, end: number]

const ROW = 18
const NUMBERS = 14
const INTRON = 12
const BAND = 36
const CHARACTER_WIDTH = 5.6

function fixed(n: number) {
  return Number(n.toFixed(1))
}

function bases([start, end]: Bases) {
  return end - start + 1
}

export function merged(spans: Bases[]) {
  const runs: Bases[] = []
  for (const [start, end] of spans.toSorted((a, b) => a[0] - b[0])) {
    const last = runs.at(-1)
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end)
    } else {
      runs.push([start, end])
    }
  }
  return runs
}

export function genomeScale(structures: Structure[], left: number, right: number) {
  const blocks = merged(structures.flatMap(s => s.exons))
  const total = blocks.reduce((sum, block) => sum + bases(block), 0)
  const step = (right - left - INTRON * (blocks.length - 1)) / total
  const reverse = (structures[0]?.strand ?? 1) < 0
  const starts = blocks.map(
    (_, i) =>
      left +
      i * INTRON +
      step * blocks.slice(0, i).reduce((sum, block) => sum + bases(block), 0),
  )
  const forward = (position: number) => {
    const i = blocks.findIndex(([, end]) => position <= end)
    const [start] = blocks[i] ?? [position]
    return (starts[i] ?? right) + (position - start) * step
  }
  return ([start, end]: Bases) => {
    const from = forward(start)
    const to = forward(end) + step
    return { x: reverse ? left + right - to : from, width: to - from }
  }
}

/** Exons in transcript order, with the coding bases and their offsets in coding nucleotides. */
export function codingParts({ strand, coding, exons }: Structure) {
  const ordered = strand < 0 ? exons.toReversed() : exons
  let before = 0
  return ordered.map((exon, i) => {
    const start = Math.max(exon[0], coding[0])
    const end = Math.min(exon[1], coding[1])
    const part = start <= end ? { bases: [start, end] satisfies Bases, from: before } : null
    before += part ? bases(part.bases) : 0
    return { exon, number: i + 1, coding: part }
  })
}

export function canonicalResidues(
  canonical: Structure,
  [start, end]: Bases,
  length: number,
) {
  return codingParts(canonical).flatMap(({ coding }) => {
    const [low, high] = coding?.bases ?? [0, -1]
    const from = Math.max(low, start)
    const to = Math.min(high, end)
    const offsets =
      coding && from <= to
        ? (canonical.strand < 0 ? [high - to, high - from] : [from - low, to - low]).map(
            n => coding.from + n,
          )
        : []
    const [first = 0, last = -1] = offsets.map(n => Math.floor(n / 3) + 1)
    const run: Run = [first, Math.min(last, length)]
    return run[0] <= run[1] ? [run] : []
  })
}

function transcriptSvg(
  place: ReturnType<typeof genomeScale>,
  structure: Structure,
  canonical: Structure,
  length: number,
  top: number,
) {
  const line = place([
    Math.min(...structure.exons.map(([start]) => start)),
    Math.max(...structure.exons.map(([, end]) => end)),
  ])
  return `<line class="intron" x1="${fixed(line.x)}" x2="${fixed(line.x + line.width)}" y1="${top + 6}" y2="${top + 6}"/>${codingParts(
    structure,
  )
    .map(({ exon, number, coding }) => {
      const whole = place(exon)
      const thick = coding && place(coding.bases)
      const residues = coding ? canonicalResidues(canonical, coding.bases, length) : []
      const title = `Exon ${number} of ${structure.transcript}: ${exon[0].toLocaleString('en')}–${exon[1].toLocaleString('en')}, ${bases(exon)} bp${residues.length ? `; the canonical's residues ${residues.map(([a, b]) => span(a, b)).join(', ')} come from these bases` : ''}`
      return `<g class="exon"${residues.length ? ` data-span="${spanData(residues)}"` : ''}><title>${esc(title)}</title><rect class="utr" x="${fixed(whole.x)}" y="${top + 3}" width="${fixed(whole.width)}" height="6"/>${thick ? `<rect class="cds" x="${fixed(thick.x)}" y="${top + 1}" width="${fixed(thick.width)}" height="10"/>` : ''}</g>`
    })
    .join('')}`
}

function guides(
  place: ReturnType<typeof genomeScale>,
  canonical: Structure,
  top: number,
  bottom: number,
) {
  return `<g class="guides">${canonical.exons
    .flatMap(exon => {
      const { x, width } = place(exon)
      return [x, x + width]
    })
    .map(x => `<line x1="${fixed(x)}" x2="${fixed(x)}" y1="${top}" y2="${bottom}"/>`)
    .join('')}</g>`
}

function numbers(place: ReturnType<typeof genomeScale>, canonical: Structure) {
  return codingParts(canonical)
    .map(({ exon, number }) => {
      const { x, width } = place(exon)
      return width > 4 + String(number).length * CHARACTER_WIDTH
        ? `<text class="number" x="${fixed(x + width / 2)}" y="10" text-anchor="middle">${number}</text>`
        : ''
    })
    .join('')
}

function projection(
  place: ReturnType<typeof genomeScale>,
  canonical: Structure,
  length: number,
  top: number,
) {
  const s = scale(length)
  const at = (nucleotides: number) => s.left + (nucleotides / 3) * s.step
  return `<g class="projection">${codingParts(canonical)
    .flatMap(({ number, coding }, i) => {
      const end = coding && Math.min(coding.from + bases(coding.bases), length * 3)
      const gene = coding && place(coding.bases)
      return coding && gene && end !== null && end > coding.from
        ? [
            `<path class="p${i % 2}" d="M${fixed(gene.x)} ${top}H${fixed(gene.x + gene.width)}L${fixed(at(end))} ${top + BAND}H${fixed(at(coding.from))}z"><title>${esc(`Exon ${number}'s coding bases become the canonical's residues ${span(Math.floor(coding.from / 3) + 1, Math.ceil(end / 3))}`)}</title></path>`,
          ]
        : []
    })
    .join('')}</g>`
}

export function structureMap(
  record: GeneRecord,
  maneAccession: string | undefined,
) {
  const canonical = record.structures[record.canonical.accession]
  const rows = mapRows(record, maneAccession)
  const drawn = rows.flatMap(row => record.structures[row.accession] ?? [])
  const width = mapWidth(record)
  const place = genomeScale(drawn, LEFT, WIDTH - RIGHT)
  const rowsTop = NUMBERS
  const rowsBottom = rowsTop + rows.length * ROW
  const height = rowsBottom + BAND
  return canonical && drawn.length > 1
    ? `<svg class="structure track" viewBox="0 0 ${width} ${height}" style="min-width:${minWidth(width)}px" role="img" aria-label="${esc(`${record.gene}: the exons of a GENCODE transcript for each of ${drawn.length} isoforms, introns shortened, above the canonical's coding exons mapped onto its residues`)}">${numbers(place, canonical)}${guides(place, canonical, rowsTop - 2, rowsBottom)}${rows
        .map((row, index) => {
          const top = rowsTop + index * ROW
          const structure = record.structures[row.accession]
          return `<g class="iso"><title>${esc(structure ? `${row.title}; exons of ${structure.transcript}` : row.title)}</title>${rowLabel(row, index === 0, top)}${
            structure
              ? transcriptSvg(place, structure, canonical, record.length, top)
              : `<text class="none" x="${LEFT}" y="${top + 10}">No GENCODE transcript encodes this isoform's length</text>`
          }</g>`
        })
        .join('')}${projection(place, canonical, record.length, rowsBottom)}</svg>`
    : ''
}
