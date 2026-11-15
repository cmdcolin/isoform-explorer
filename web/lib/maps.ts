import type {
  Feature,
  FeatureGroup,
  FeatureType,
  GeneRecord,
  Isoform,
} from '../../src/types.ts'
import { GROUP_LABELS } from './features.ts'
import { axisLabels, esc } from './html.ts'
import {
  type Run,
  carriedRuns,
  editEffects,
  featureLabel,
  featureName,
  featureRuns,
  groupOf,
  overlap,
  plural,
  runLength,
  span,
} from './loss.ts'

const WIDTH = 1000
const LEFT = 156
const RIGHT = 12
const LANE = 12
const ROW = 18
const TRACK = 14
const COLUMN = 22
const MAP_PARTNERS = 12
const ALIKE = 0.8
const BRIDGE = 4
const CHARACTER_WIDTH = 5.6
const TICKS: FeatureGroup[] = ['sites', 'modifications']

const REGIONS: FeatureType[] = ['Region', 'Coiled coil']
const PROCESSING: FeatureType[] = [
  'Signal',
  'Transit peptide',
  'Propeptide',
  'Chain',
  'Peptide',
]
const PROCESSING_LANES = 3

const FEATURE_ROWS: {
  label: string
  title: string
  ticks: boolean
  maxLanes?: number
  holds: (feature: Feature) => boolean
}[] = [
  {
    label: 'Processing',
    title: 'Signal and transit peptides, propeptides, chains and peptides',
    ticks: false,
    maxLanes: PROCESSING_LANES,
    holds: f => PROCESSING.includes(f.type),
  },
  {
    label: 'Topology',
    title: 'Transmembrane and intramembrane segments, topological domains',
    ticks: false,
    holds: f => groupOf(f) === 'targeting' && !PROCESSING.includes(f.type),
  },
  {
    label: 'Domains',
    title: 'Domains, repeats, zinc fingers, DNA-binding regions and motifs',
    ticks: false,
    holds: f => groupOf(f) === 'domains' && !REGIONS.includes(f.type),
  },
  {
    label: 'Regions',
    title: 'Regions and coiled coils',
    ticks: false,
    holds: f => REGIONS.includes(f.type),
  },
  {
    label: 'Sites',
    title: GROUP_LABELS.sites,
    ticks: true,
    holds: f => groupOf(f) === 'sites',
  },
  {
    label: 'Modifications',
    title: GROUP_LABELS.modifications,
    ticks: true,
    holds: f => groupOf(f) === 'modifications',
  },
]

const FEATURE_CLASSES: Record<string, string> = {
  Chain: 'chain',
  Peptide: 'sig',
  Signal: 'sig',
  'Transit peptide': 'sig',
  Propeptide: 'sig',
  Transmembrane: 'tm',
  Intramembrane: 'tm',
  'Topological domain': 'topo',
  Region: 'reg',
  'Coiled coil': 'reg',
  'Active site': 'site',
  'Binding site': 'site',
  Site: 'site',
}

export function scale(
  length: number,
  width = WIDTH,
  left = LEFT,
  right = RIGHT,
) {
  const step = (width - left - right) / Math.max(length, 1)
  return {
    step,
    left,
    x: (position: number) => left + (position - 1) * step,
    width: ([start, end]: Run) => Math.max((end - start + 1) * step, 1.5),
  }
}

type Scale = ReturnType<typeof scale>

function fixed(n: number) {
  return Number(n.toFixed(1))
}

export function lanes<T extends { start: number; end: number }>(items: T[]) {
  const ends: number[] = []
  return items
    .toSorted((a, b) => a.start - b.start || b.end - a.end)
    .map(item => {
      const free = ends.findIndex(end => end < item.start)
      const lane = free === -1 ? ends.length : free
      ends[lane] = item.end
      return { item, lane }
    })
}

export function blocks(positions: number[], bridge = 1) {
  const runs: Run[] = []
  for (const p of positions.toSorted((a, b) => a - b)) {
    const last = runs.at(-1)
    if (last && p - last[1] <= bridge) {
      last[1] = Math.max(last[1], p)
    } else {
      runs.push([p, p])
    }
  }
  return runs
}

function jaccard(a: Set<number>, b: Set<number>) {
  const shared = [...a].filter(r => b.has(r)).length
  return shared / (a.size + b.size - shared)
}

export function alikeGroups<T>(
  items: T[],
  residuesOf: (item: T) => Set<number>,
  apart: (item: T) => boolean,
) {
  const groups: { members: T[]; residues: Set<number> }[] = []
  for (const item of items) {
    const residues = residuesOf(item)
    const alike = apart(item)
      ? undefined
      : groups.find(
          g => !g.members.some(apart) && jaccard(g.residues, residues) >= ALIKE,
        )
    if (alike) {
      alike.members.push(item)
    } else {
      groups.push({ members: [item], residues })
    }
  }
  return groups
}

export function partnerTracks(record: Pick<GeneRecord, 'gene' | 'interfaces'>) {
  const partners = Object.entries(record.interfaces).toSorted(
    ([a, x], [b, y]) => y.length - x.length || a.localeCompare(b),
  )
  const groups = alikeGroups(
    partners,
    ([, residues]) => new Set(residues),
    ([partner]) => partner === record.gene,
  ).map(g => {
    const names = g.members.map(([partner]) =>
      partner === record.gene ? 'itself' : partner,
    )
    return {
      label:
        names.length > 1
          ? `${names[0]} +${names.length - 1}`
          : (names[0] ?? ''),
      names,
      residues: [...new Set(g.members.flatMap(([, residues]) => residues))],
    }
  })
  const rest = groups.slice(MAP_PARTNERS)
  return [
    ...groups.slice(0, MAP_PARTNERS),
    ...(rest.length
      ? [
          {
            label: `+${rest.flatMap(g => g.names).length} more`,
            names: rest.flatMap(g => g.names),
            residues: [...new Set(rest.flatMap(g => g.residues))],
          },
        ]
      : []),
  ]
}

export function shortName(isoform: {
  accession: string
  name: string
  synonyms: string[]
}) {
  const named = isoform.accession.endsWith(`-${isoform.name}`)
    ? undefined
    : isoform.name
  return [named, ...isoform.synonyms].find(n => n && n.length <= 9) ?? ''
}

export function spanData(runs: Run[]) {
  return runs.map(([start, end]) => `${start}-${end}`).join(' ')
}

function rect(s: Scale, run: Run, y: number, height: number, attributes = '') {
  return `<rect${attributes} x="${fixed(s.x(run[0]))}" y="${y}" width="${fixed(s.width(run))}" height="${height}"/>`
}

function featureMark(s: Scale, feature: Feature, y: number, height: number) {
  const runs = featureRuns(feature)
  const kind =
    FEATURE_CLASSES[feature.type] ??
    (TICKS.includes(groupOf(feature)) ? 'mod' : 'dom')
  const name = featureName(feature).main
  const first = runs[0] ?? [feature.start, feature.end]
  const room = s.width(first) - 4
  return `<g class="f ${kind}" data-span="${spanData(runs)}"><title>${esc(featureLabel(feature))}</title>${runs
    .map(run => rect(s, run, y, height))
    .join('')}${
    name &&
    !TICKS.includes(groupOf(feature)) &&
    name.length * CHARACTER_WIDTH < room
      ? `<text x="${fixed(s.x(first[0]) + 2.5)}" y="${y + height - 2.5}">${esc(name)}</text>`
      : ''
  }</g>`
}

export function featureRows(features: Feature[]) {
  return FEATURE_ROWS.map(row => {
    const items = features.filter(row.holds)
    const placed = row.ticks
      ? items.map(item => ({ item, lane: 0 }))
      : lanes(items).map(({ item, lane }) => ({
          item,
          lane: Math.min(lane, (row.maxLanes ?? Infinity) - 1),
        }))
    return {
      ...row,
      placed,
      lanes: placed.length ? Math.max(...placed.map(p => p.lane)) + 1 : 0,
    }
  }).filter(row => row.placed.length)
}

export function keptShare(residues: number[], carried: Run[]) {
  return residues.length
    ? residues.filter(r => overlap(carried, [r, r]) > 0).length /
        residues.length
    : 1
}

function pie(x: number, y: number, radius: number, share: number) {
  const angle = 2 * Math.PI * share
  const endX = x + radius * Math.sin(angle)
  const endY = y - radius * Math.cos(angle)
  return share >= 1
    ? `<circle class="kept" cx="${x}" cy="${y}" r="${radius}"/>`
    : share > 0
      ? `<path class="kept" d="M${x} ${y}V${y - radius}A${radius} ${radius} 0 ${share > 0.5 ? 1 : 0} 1 ${fixed(endX)} ${fixed(endY)}z"/>`
      : ''
}

interface Row {
  accession: string
  label: string
  name: string
  title: string
  tag: string
  isoform: Pick<Isoform, 'edits' | 'segments'>
}

function isoformBar(s: Scale, row: Row, y: number, length: number) {
  const effects = editEffects(row.isoform)
  const kept = carriedRuns(row.isoform.segments)
  const added = effects.filter(e => e.novel > 0 && e.fate === 'missing')
  return `<line class="base" x1="${s.left}" x2="${fixed(s.x(length + 1))}" y1="${y + 6}" y2="${y + 6}"/>${kept
    .map(run => rect(s, run, y + 1, 10, ' class="k"'))
    .join('')}${effects
    .filter(e => e.fate === 'replaced')
    .map(
      e =>
        `<g class="r" data-span="${spanData(e.absent)}"><title>${esc(`${span(e.edit.start, e.edit.end)}: ${runLength(e.absent)} replaced by ${plural(e.novel, 'different residue')}`)}</title>${e.absent.map(run => rect(s, run, y, 12)).join('')}</g>`,
    )
    .join('')}${added
    .map(
      e =>
        `<rect class="n" x="${fixed(s.x(e.edit.start) - 1)}" y="${y - 2}" width="2.2" height="14"><title>${esc(`${plural(e.novel, 'residue')} the canonical lacks, at ${span(e.edit.start, e.edit.end)}`)}</title></rect>`,
    )
    .join('')}`
}

export function isoformMap(
  record: GeneRecord,
  maneAccession: string | undefined,
) {
  const tracks = partnerTracks(record)
  const s = scale(record.length)
  const rows = featureRows(record.features)
  const plddt = record.canonical.model?.plddt ?? null
  let y = 4
  const featureSvg = rows
    .map(row => {
      const top = y
      y += row.lanes * LANE + 6
      const height = row.ticks ? 10 : LANE - 2
      return `<g><text class="label" x="0" y="${top + 9}">${row.label}<title>${row.title}</title></text>${row.placed
        .map(({ item, lane }) =>
          featureMark(s, item, top + lane * LANE, height),
        )
        .join('')}</g>`
    })
    .join('')
  const plddtTop = y
  y += plddt ? TRACK + 2 : 0
  let position = 1
  const plddtSvg = plddt
    ? `<g class="plddt"><text class="label" x="0" y="${plddtTop + 9}">pLDDT</text>${plddt
        .map(([band, length]) => {
          const run: Run = [position, position + length - 1]
          position += length
          return rect(s, run, plddtTop + 1, 10, ` class="b${band}"`)
        })
        .join('')}</g>`
    : ''
  const tracksTop = y
  y += tracks.length * TRACK + (tracks.length ? 4 : 0)
  const trackSvg = tracks
    .map((track, index) => {
      const top = tracksTop + index * TRACK
      const runs = blocks(track.residues, BRIDGE)
      return `<g class="partner" data-span="${spanData(runs)}"><rect class="hit" x="0" y="${top - 1}" width="${WIDTH}" height="${TRACK}"/><text class="label" x="0" y="${top + 9}">${esc(track.label)}<title>${esc(track.names.join(', '))}</title></text>${runs.map(run => rect(s, run, top + 1, 9, ' class="if"')).join('')}</g>`
    })
    .join('')
  const headerHeight = tracks.length
    ? Math.max(...tracks.map(t => t.label.length)) * 4.4 + 10
    : 0
  const rowsTop = Math.max(y + 8, headerHeight)
  const width =
    WIDTH +
    (tracks.length ? 10 + tracks.length * COLUMN + headerHeight * 0.7 : 0)
  const isoformRows: Row[] = [
    {
      accession: record.canonical.accession,
      label: record.canonical.accession,
      name: shortName(record.canonical),
      title: `Canonical isoform ${record.canonical.name}, ${record.length} residues`,
      tag: maneAccession === record.canonical.accession ? 'MANE' : '',
      isoform: { edits: [], segments: [[1, 1, record.length]] },
    },
    ...record.isoforms.map(i => ({
      accession: i.accession,
      label: i.accession,
      name: shortName(i),
      title: `Isoform ${i.name}${i.synonyms.length ? ` (${i.synonyms.join(', ')})` : ''}, ${i.length} residues`,
      tag: i.accession === maneAccession ? 'MANE' : '',
      isoform: i,
    })),
  ]
  const headers = tracks
    .map((track, index) => {
      const x = WIDTH + 10 + index * COLUMN + COLUMN / 2
      return `<text class="label" transform="translate(${x - 2} ${rowsTop - 6}) rotate(-50)">${esc(track.label)}<title>${esc(track.names.join(', '))}</title></text>`
    })
    .join('')
  const isoformSvg = isoformRows
    .map((row, index) => {
      const top = rowsTop + index * ROW
      const carried = carriedRuns(row.isoform.segments)
      const dots = tracks
        .map((track, k) => {
          const x = WIDTH + 10 + k * COLUMN + COLUMN / 2
          const share = keptShare(track.residues, carried)
          return `<g class="dot"><title>${esc(`${row.label} has ${Math.round(share * track.residues.length)} of ${track.residues.length} interface residues of ${track.names.join(', ')}`)}</title><circle class="ring" cx="${x}" cy="${top + 6}" r="6.5"/>${pie(x, top + 6, 6.5, share)}</g>`
        })
        .join('')
      return `<a href="#${esc(row.accession)}"><g class="iso" data-isoform="${esc(row.accession)}"><title>${esc(row.title)}</title><rect class="hit" x="0" y="${top - 3}" width="${width}" height="${ROW}"/><text class="label${index === 0 ? ' canon' : ''}" x="0" y="${top + 10}">${esc(row.label)}${row.name ? `<tspan class="name" dx="4">${esc(row.name)}</tspan>` : ''}${row.tag ? `<tspan class="tag" dx="4">${row.tag}</tspan>` : ''}</text>${isoformBar(s, row, top, record.length)}${dots}</g></a>`
    })
    .join('')
  const rowsBottom = rowsTop + isoformRows.length * ROW
  const axisY = rowsBottom + 2
  const height = axisY + 18
  return `<div class="map-wrap"><svg class="map track" viewBox="0 0 ${width} ${height}" style="min-width:${Math.round(width * 0.76)}px" data-left="${LEFT}" data-step="${Number(s.step.toFixed(5))}" data-top="${rowsTop - 4}" data-bottom="${rowsBottom}" role="img" aria-label="${esc(`${record.gene}: features of the canonical protein above ${isoformRows.length} isoforms drawn on its ${record.length} residues`)}">${featureSvg}${plddtSvg}${trackSvg}${headers}${isoformSvg}${axis(s, record.length, axisY)}</svg></div>`
}

function axis(
  s: Scale,
  length: number,
  y: number,
  labels = axisLabels(length),
) {
  return `<line class="axis" x1="${s.left}" x2="${fixed(s.x(length + 1))}" y1="${y}" y2="${y}"/>${labels
    .map(
      x =>
        `<text class="tick" x="${fixed(s.x(x) + s.step / 2)}" y="${y + 3}" dominant-baseline="hanging" text-anchor="${x === 1 ? 'start' : x === length ? 'end' : 'middle'}">${x}</text>`,
    )
    .join('')}`
}

export function isoformStrip(record: GeneRecord, isoform: Isoform) {
  const width = 640
  const left = 124
  const s = scale(record.length, width, left, 6)
  const row = (
    label: string,
    value: Pick<Isoform, 'edits' | 'segments'>,
    top: number,
  ) =>
    `<text class="label" x="0" y="${top + 11}">${esc(label)}</text>${isoformBar(s, { accession: '', label, name: '', title: '', tag: '', isoform: value }, top, record.length)}`
  return `<svg class="strip track" viewBox="0 0 ${width} 86" data-left="${left}" data-step="${Number(s.step.toFixed(5))}" data-top="0" data-bottom="52" role="img" aria-label="${esc(`${isoform.accession} drawn on the ${record.length} residues of the canonical protein`)}">${row('Canonical', { edits: [], segments: [[1, 1, record.length]] }, 6)}${row('Isoform', isoform, 34)}${axis(s, record.length, 56, [1, record.length])}</svg>`
}
