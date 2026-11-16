import type { GeneRecord } from '../../src/types.ts'
import { esc } from './html.ts'

const WIDTH = 1400
const HEIGHT = 520
const FLANK = 8
const SPACING = 23.5
const RADIUS = 10.5
const CANONICAL_Y = 270
const ISOFORM_Y = 460
const CARBONS = 16

interface Bead {
  residue: number
  letter: string
  x: number
  y: number
}

function chain(
  residues: number[],
  letters: Map<number, string>,
  left: number,
  y: number,
  wave: number,
) {
  return residues.map((residue, k): Bead => ({
    residue,
    letter: letters.get(residue) ?? '',
    x: left + k * SPACING,
    y: y + wave * Math.sin(k * 0.42),
  }))
}

function range(from: number, to: number) {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k)
}

function palmitate(at: Bead) {
  const sulfur = { x: at.x, y: at.y - 46 }
  const carbonyl = { x: at.x + 24, y: at.y - 62 }
  const oxygen = { x: at.x + 24, y: at.y - 100 }
  const tail = Array.from({ length: CARBONS - 1 }, (_, k) => ({
    x: carbonyl.x + (k + 1) * 21,
    y: carbonyl.y + (k % 2 === 0 ? 12 : 0),
  }))
  const bonds = [
    [at.x, at.y - RADIUS, sulfur.x, sulfur.y + 11],
    [sulfur.x + 9, sulfur.y - 5, carbonyl.x, carbonyl.y],
    [carbonyl.x - 4, carbonyl.y, oxygen.x - 4, oxygen.y + 12],
    [carbonyl.x + 4, carbonyl.y, oxygen.x + 4, oxygen.y + 12],
    ...[carbonyl, ...tail]
      .slice(0, -1)
      .map((p, k) => [p.x, p.y, tail[k]?.x ?? p.x, tail[k]?.y ?? p.y]),
  ]
  const end = tail.at(-1) ?? carbonyl
  return {
    svg: `<g stroke="var(--text)" stroke-width="2.5" stroke-linecap="round">${bonds.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`).join('')}</g><text x="${sulfur.x}" y="${sulfur.y + 7}" class="atom">S</text><text x="${oxygen.x}" y="${oxygen.y + 7}" class="atom">O</text>`,
    end,
  }
}

export function activeSiteFigure(
  record: GeneRecord,
  accession: string,
  motif: string,
) {
  const isoform = record.isoforms.find(i => i.accession === accession)
  const edit = isoform?.edits[0]
  const site = record.features.find(
    f =>
      f.type === 'Active site' &&
      edit &&
      f.start >= edit.start &&
      f.start <= edit.end,
  )
  const motifAt = edit ? edit.original.indexOf(motif) : -1
  if (!isoform || !edit || !site || motifAt < 0) {
    throw new Error(
      `${record.gene} ${accession}: no active site in a removed stretch`,
    )
  }
  const letters = new Map(
    edit.original.split('').map((letter, k) => [edit.start + k, letter]),
  )
  const motifStart = edit.start + motifAt
  const before = range(edit.start - FLANK, edit.start - 1)
  const after = range(edit.end + 1, edit.end + FLANK)
  const canonical = chain(
    [...before, ...range(edit.start, edit.end), ...after],
    letters,
    70,
    CANONICAL_Y,
    14,
  )
  const kept = [...before, ...after]
  const isoformLeft =
    70 +
    (FLANK - 0.5) * SPACING +
    ((edit.end - edit.start + 1) * SPACING) / 2 -
    (kept.length * SPACING) / 2 +
    SPACING / 2
  const shortened = chain(kept, letters, isoformLeft, ISOFORM_Y, 0)
  const helix = record.features.find(
    f =>
      f.type === 'Transmembrane' && f.start <= edit.end && f.end >= edit.start,
  )
  const inHelix = canonical.filter(
    b => helix && b.residue >= helix.start && b.residue <= helix.end,
  )
  const helixBand =
    helix && inHelix.length
      ? `<path d="M${inHelix.map(b => `${b.x} ${b.y}`).join(' L')}" fill="none" stroke="var(--surface-2)" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" /><path d="M${inHelix.map(b => `${b.x} ${b.y}`).join(' L')}" fill="none" stroke="var(--border)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" opacity="0.45" /><text x="${WIDTH - 20}" y="${CANONICAL_Y + 64}" class="note" style="text-anchor: end">transmembrane helix ${helix.start}–${helix.end}</text>`
      : ''
  const tone = (b: Bead) =>
    b.residue >= motifStart && b.residue < motifStart + motif.length
      ? 'motif'
      : b.residue >= edit.start && b.residue <= edit.end
        ? 'removed'
        : 'kept'
  const backbone = (beads: Bead[]) =>
    `<path d="M${beads.map(b => `${b.x} ${b.y}`).join(' L')}" fill="none" stroke="var(--text-2)" stroke-width="3" />`
  const draw = (beads: Bead[]) =>
    beads
      .map(
        b =>
          `<circle cx="${b.x}" cy="${b.y}" r="${tone(b) === 'motif' ? RADIUS + 2.5 : RADIUS}" class="bead ${tone(b)}" />${b.letter ? `<text x="${b.x}" y="${b.y + 5}" class="residue ${tone(b)}">${esc(b.letter)}</text>` : ''}`,
      )
      .join('')
  const number = (
    beads: Bead[],
    residues: number[],
    dy: number,
    anchors = ['middle'],
  ) =>
    beads
      .filter(b => residues.includes(b.residue))
      .map(
        (b, k) =>
          `<text x="${b.x}" y="${b.y + dy}" class="number" style="text-anchor: ${anchors[k] ?? 'middle'}">${b.residue}</text>`,
      )
      .join('')
  const cysteine = canonical.find(b => b.residue === site.start)
  const acyl = cysteine ? palmitate(cysteine) : undefined
  const joins = [edit.start - 1, edit.end + 1]
    .map(residue => [
      canonical.find(b => b.residue === residue),
      shortened.find(b => b.residue === residue),
    ])
    .map(([from, to]) =>
      from && to
        ? `<line x1="${from.x}" y1="${from.y + RADIUS + 4}" x2="${to.x}" y2="${to.y - RADIUS - 4}" stroke="var(--text-2)" stroke-width="1.5" stroke-dasharray="4 5" />`
        : '',
    )
    .join('')
  return `<svg class="active-site-figure" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${esc(`${record.gene} residues ${before[0]} to ${after.at(-1)} drawn as beads: the canonical chain with a palmitate on cysteine ${site.start}, and isoform ${isoform.name}'s chain without residues ${edit.start}–${edit.end}`)}"><style>
.active-site-figure text { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; text-anchor: middle; }
.active-site-figure .bead.kept { fill: var(--chain); }
.active-site-figure .bead.removed { fill: var(--caution); }
.active-site-figure .bead.motif { fill: var(--interface); }
.active-site-figure .residue { font-size: 13px; font-weight: 700; fill: var(--chip-text); }
.active-site-figure .number { font-size: 14px; fill: var(--text-2); }
.active-site-figure .atom { font-size: 21px; font-weight: 650; fill: var(--text); }
.active-site-figure .note { font-size: 17px; fill: var(--text-2); }
.active-site-figure .row { font-size: 22px; font-weight: 650; fill: var(--text); text-anchor: start; }
.active-site-figure .label { font-size: 18px; fill: var(--text-2); text-anchor: start; }
.active-site-figure .absent { font-size: 18px; font-weight: 600; fill: var(--caution); }
.active-site-figure .title { font-size: 28px; font-weight: 650; fill: var(--text); text-anchor: start; }
</style><text x="40" y="56" class="title">${esc(record.gene)}: a palmitate on the ${esc(motif)} motif</text><text x="40" y="${CANONICAL_Y - 130}" class="row">Canonical</text><text x="40" y="${CANONICAL_Y - 104}" class="label">${esc(record.canonical.accession)}, residues ${before[0]}–${after.at(-1)}</text><text x="40" y="${ISOFORM_Y - 40}" class="row">Isoform ${esc(isoform.name)}</text><text x="40" y="${ISOFORM_Y - 14}" class="label">${esc(accession)}, residues ${edit.start}–${edit.end} absent</text>${helixBand}${backbone(canonical)}${draw(canonical)}${number(canonical, [edit.start, edit.end], -18)}${acyl ? `${acyl.svg}<text x="${acyl.end.x + 16}" y="${acyl.end.y + 4}" class="label">palmitate on C${site.start}, the active site</text>` : ''}${backbone(shortened)}${draw(shortened)}${number(shortened, [edit.start - 1, edit.end + 1], 34, ['end', 'start'])}${joins}</svg>`
}
