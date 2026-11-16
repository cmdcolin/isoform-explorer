import { codingParts } from '../../src/ensembl.ts'
import type { GeneRecord, Structure } from '../../src/types.ts'
import { esc } from './html.ts'
import { type Run, count, mergeRuns, runLength, span } from './loss.ts'
import {
  CHARACTER_WIDTH,
  LEFT,
  RIGHT,
  WIDTH,
  fixed,
  mapRows,
  mapWidth,
  minWidth,
  partnerTracks,
  rowLabel,
  scale,
  spanData,
} from './maps.ts'

const ROW = 18
const ROWS_TOP = 14
const INTRON = 12
const UNTRANSLATED = 0.2
const BAND = 36

type Place = ReturnType<typeof genomeScale>

function codedParts(structure: Structure) {
  return codingParts(structure).flatMap(({ number, coding }) =>
    coding ? [{ number, ...coding }] : [],
  )
}

function pieces(block: Run, coding: Run[]) {
  const cuts = coding
    .flatMap(([start, end]) => [start, end + 1])
    .filter(cut => cut > block[0] && cut <= block[1])
  const edges = [block[0], ...cuts, block[1] + 1]
  return edges.slice(1).map((end, i) => {
    const start = edges[i] ?? block[0]
    return {
      start,
      end,
      weight: coding.some(([from, to]) => from <= start && end - 1 <= to)
        ? 1
        : UNTRANSLATED,
    }
  })
}

/** Exons at a shared scale, untranslated bases shrunk, introns at a fixed width, 5′ on the left. */
export function genomeScale(structures: Structure[], left: number, right: number) {
  const blocks = mergeRuns(structures.flatMap(s => s.exons))
  const coding = mergeRuns(
    structures.flatMap(s => codedParts(s).map(part => part.bases)),
  )
  const all = blocks.map(block => pieces(block, coding))
  const weighted = (piece: { start: number; end: number; weight: number }) =>
    (piece.end - piece.start) * piece.weight
  const step =
    (right - left - INTRON * (blocks.length - 1)) /
    all.flat().reduce((sum, piece) => sum + weighted(piece), 0)
  let x = left - INTRON
  const placed = all.flatMap(block => {
    x += INTRON
    return block.map(piece => {
      const at = x
      x += weighted(piece) * step
      return { ...piece, x: at }
    })
  })
  const forward = (position: number) => {
    const piece = placed.find(({ end }) => position <= end)
    return piece
      ? piece.x + (position - piece.start) * piece.weight * step
      : right
  }
  const reverse = (structures[0]?.strand ?? 1) < 0
  return ([start, end]: Run) => {
    const from = forward(start)
    const to = forward(end + 1)
    return { x: reverse ? left + right - to : from, width: to - from }
  }
}

/** The canonical residues whose codons lie in the given bases. */
export function canonicalResidues(canonical: Structure, length: number) {
  const coded = codedParts(canonical)
  return ([start, end]: Run) =>
    coded.flatMap(({ bases: [low, high], from }) => {
      const first = Math.max(low, start)
      const last = Math.min(high, end)
      const [a, b] =
        canonical.strand < 0
          ? [high - last, high - first]
          : [first - low, last - low]
      const run: Run = [
        Math.floor((from + a) / 3) + 1,
        Math.min(Math.floor((from + b) / 3) + 1, length),
      ]
      return first <= last && run[0] <= run[1] ? [run] : []
    })
}

function transcriptSvg(
  place: Place,
  structure: Structure,
  residuesOf: ReturnType<typeof canonicalResidues>,
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
      const residues = coding ? residuesOf(coding.bases) : []
      const untranslated =
        !coding || coding.bases[0] !== exon[0] || coding.bases[1] !== exon[1]
      return `<g class="exon"${residues.length ? ` data-span="${spanData(residues)}"` : ''}><title>${esc(`Exon ${number} of ${structure.transcript}: ${count(exon[0])}–${count(exon[1])}, ${runLength([exon])} bp`)}</title>${untranslated ? `<rect class="utr" x="${fixed(whole.x)}" y="${top + 3}" width="${fixed(whole.width)}" height="6"/>` : ''}${thick ? `<rect class="cds" x="${fixed(thick.x)}" y="${top + 1}" width="${fixed(thick.width)}" height="10"/>` : ''}</g>`
    })
    .join('')}`
}

function guides(place: Place, canonical: Structure, top: number, bottom: number) {
  return `<g class="guides">${canonical.exons
    .flatMap(exon => {
      const { x, width } = place(exon)
      return [x, x + width]
    })
    .map(x => `<line x1="${fixed(x)}" x2="${fixed(x)}" y1="${top}" y2="${bottom}"/>`)
    .join('')}</g>`
}

function numbers(place: Place, canonical: Structure) {
  return codingParts(canonical)
    .map(({ exon, number }) => {
      const { x, width } = place(exon)
      return width > 6 + String(number).length * CHARACTER_WIDTH
        ? `<text class="number" x="${fixed(x + width / 2)}" y="10" text-anchor="middle">${number}</text>`
        : ''
    })
    .join('')
}

function projection(place: Place, canonical: Structure, length: number, top: number) {
  const s = scale(length)
  const at = (nucleotides: number) => s.left + (nucleotides / 3) * s.step
  return `<g class="projection">${codedParts(canonical)
    .map(({ number, bases, from }, i) => {
      const end = Math.min(from + runLength([bases]), length * 3)
      const gene = place(bases)
      return end > from
        ? `<path class="p${i % 2}" d="M${fixed(gene.x)} ${top}H${fixed(gene.x + gene.width)}L${fixed(at(end))} ${top + BAND}H${fixed(at(from))}z"><title>${esc(`Exon ${number}'s coding bases become the canonical's residues ${span(Math.floor(from / 3) + 1, Math.ceil(end / 3))}`)}</title></path>`
        : ''
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
  const width = mapWidth(partnerTracks(record))
  const place = genomeScale(drawn, LEFT, WIDTH - RIGHT)
  const rowsBottom = ROWS_TOP + rows.length * ROW
  const residuesOf = canonical && canonicalResidues(canonical, record.length)
  return canonical && residuesOf && drawn.length > 1
    ? `<svg class="structure track" viewBox="0 0 ${width} ${rowsBottom + BAND}" style="min-width:${minWidth(width)}px" role="img" aria-label="${esc(`${record.gene}: the exons of a GENCODE transcript for each of ${drawn.length} isoforms, introns shortened, above the canonical's coding exons mapped onto its residues`)}">${numbers(place, canonical)}${guides(place, canonical, ROWS_TOP - 2, rowsBottom)}${rows
        .map((row, index) => {
          const top = ROWS_TOP + index * ROW
          const structure = record.structures[row.accession]
          return `<g class="iso"><title>${esc(structure ? `${row.title}; exons of ${structure.transcript}` : row.title)}</title>${rowLabel(row, index === 0, top)}${
            structure
              ? transcriptSvg(place, structure, residuesOf, top)
              : `<text class="none" x="${LEFT}" y="${top + 10}">No GENCODE transcript has a coding length that fits this isoform</text>`
          }</g>`
        })
        .join('')}${projection(place, canonical, record.length, rowsBottom)}</svg>`
    : ''
}
