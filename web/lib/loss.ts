import {
  FEATURE_GROUPS,
  type Edit,
  type Feature,
  type FeatureGroup,
  type FeatureType,
  type GeneRecord,
  type Isoform,
  type Model,
  type Segment,
} from '../../src/types.ts'
import {
  FOLDED_PLDDT,
  INTERFACE_LOST_SHARE,
  SWAP_SHARE,
  UNFOLDED_PLDDT,
  featurePositions,
  lacksInFull,
} from '../../src/isoforms.ts'
import { BONDS } from '../../src/uniprot.ts'
import { GROUPS } from './features.ts'

export { FOLDED_PLDDT, UNFOLDED_PLDDT }
export const JOIN_GAP = 10
const NAMED = 3

export type Run = [start: number, end: number]
export type Fate = 'missing' | 'replaced'

const NOUNS: Partial<Record<FeatureType, string>> = {
  Signal: 'signal peptide',
  'DNA binding': 'DNA-binding region',
}

const GROUP_COUNTS: Record<FeatureGroup, [string, string]> = {
  targeting: [
    'targeting or topology feature',
    'targeting or topology features',
  ],
  domains: ['domain or region', 'domains and regions'],
  sites: ['site', 'sites'],
  modifications: ['modification', 'modifications'],
}

export function count(n: number) {
  return n.toLocaleString('en-US')
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${count(n)} ${n === 1 ? one : many}`
}

export function span(start: number, end: number) {
  return start === end ? `${start}` : `${start}–${end}`
}

export function listText(items: string[]) {
  return items.length <= 2
    ? items.join(' and ')
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

export function runsText(runs: Run[]) {
  return listText(runs.map(([start, end]) => span(start, end)))
}

export function groupOf(feature: Feature) {
  return (
    GROUPS.find(group =>
      FEATURE_GROUPS[group].some(type => type === feature.type),
    ) ?? 'domains'
  )
}

export function isBond(feature: Feature) {
  return BONDS.includes(feature.type)
}

export function featureRuns(feature: Feature): Run[] {
  return isBond(feature)
    ? featurePositions(feature).map(p => [p, p])
    : [[feature.start, feature.end]]
}

export function featureSize(feature: Feature) {
  return featurePositions(feature).length
}

export function featurePlace(feature: Feature) {
  return isBond(feature) && feature.start !== feature.end
    ? `${feature.start} and ${feature.end}`
    : span(feature.start, feature.end)
}

export function featureLabel(feature: Feature) {
  const noun = NOUNS[feature.type] ?? feature.type.toLowerCase()
  const place = featurePlace(feature)
  return /^\d+$/.test(feature.description)
    ? `${noun} ${feature.description} (${place})`
    : feature.description
      ? `${feature.description} (${noun}, ${place})`
      : `${noun} (${place})`
}

export function mergeRuns(runs: Run[]) {
  const merged: Run[] = []
  for (const [start, end] of runs.toSorted((a, b) => a[0] - b[0])) {
    const last = merged.at(-1)
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }
  return merged
}

export function carriedRuns(segments: Segment[]) {
  return mergeRuns(
    segments.map(([, canonicalStart, length]) => [
      canonicalStart,
      canonicalStart + length - 1,
    ]),
  )
}

export function runLength(runs: Run[]) {
  return runs.reduce((sum, [start, end]) => sum + end - start + 1, 0)
}

export function subtractRuns([start, end]: Run, carried: Run[]) {
  const absent: Run[] = []
  let next = start
  for (const [a, b] of carried) {
    if (b >= next && a <= end) {
      if (a > next) {
        absent.push([next, a - 1])
      }
      next = b + 1
    }
  }
  return next <= end ? [...absent, [next, end] satisfies Run] : absent
}

export function overlap(runs: Run[], [start, end]: Run) {
  return runs.reduce(
    (sum, [a, b]) =>
      sum + Math.max(0, Math.min(b, end) - Math.max(a, start) + 1),
    0,
  )
}

export interface EditEffect {
  edit: Edit
  absent: Run[]
  removed: number
  novel: number
  fate: Fate
}

export function editEffect(edit: Edit, carried: Run[]): EditEffect {
  const absent = subtractRuns([edit.start, edit.end], carried)
  const removed = runLength(absent)
  const novel = edit.added - (edit.end - edit.start + 1 - removed)
  return {
    edit,
    absent,
    removed,
    novel,
    fate: removed > 0 && novel >= SWAP_SHARE * removed ? 'replaced' : 'missing',
  }
}

export function editEffects(isoform: Pick<Isoform, 'edits' | 'segments'>) {
  const carried = carriedRuns(isoform.segments)
  return isoform.edits.map(edit => editEffect(edit, carried))
}

function absentOf(effects: EditEffect[], fate: Fate) {
  return mergeRuns(effects.filter(e => e.fate === fate).flatMap(e => e.absent))
}

export interface FeatureEffect {
  index: number
  feature: Feature
  group: FeatureGroup
  size: number
  missing: number
  replaced: number
}

export function featureEffects(features: Feature[], effects: EditEffect[]) {
  const missing = absentOf(effects, 'missing')
  const replaced = absentOf(effects, 'replaced')
  const inRuns = (feature: Feature, runs: Run[]) =>
    featureRuns(feature).reduce((sum, run) => sum + overlap(runs, run), 0)
  return features.flatMap((feature, index): FeatureEffect[] => {
    const lost = {
      missing: inRuns(feature, missing),
      replaced: inRuns(feature, replaced),
    }
    return lost.missing + lost.replaced > 0
      ? [
          {
            index,
            feature,
            group: groupOf(feature),
            size: featureSize(feature),
            ...lost,
          },
        ]
      : []
  })
}

export function inFull(effect: FeatureEffect) {
  return lacksInFull(effect.feature, [
    effect.index,
    effect.missing,
    effect.replaced,
  ])
}

export interface Change {
  start: number
  end: number
  effects: EditEffect[]
  missing: number
  replaced: number
  swappedIn: number
  added: number
}

export function changes(effects: EditEffect[]) {
  const joined: EditEffect[][] = []
  for (const effect of effects.toSorted(
    (a, b) => a.edit.start - b.edit.start,
  )) {
    const last = joined.at(-1)
    const lastEnd = Math.max(...(last ?? []).map(e => e.edit.end))
    if (last && effect.edit.start - lastEnd <= JOIN_GAP) {
      last.push(effect)
    } else {
      joined.push([effect])
    }
  }
  return joined.map((group): Change => {
    const swaps = group.filter(e => e.fate === 'replaced')
    const others = group.filter(e => e.fate === 'missing')
    return {
      start: Math.min(...group.map(e => e.edit.start)),
      end: Math.max(...group.map(e => e.edit.end)),
      effects: group,
      missing: others.reduce((sum, e) => sum + e.removed, 0),
      replaced: swaps.reduce((sum, e) => sum + e.removed, 0),
      swappedIn: swaps.reduce((sum, e) => sum + e.novel, 0),
      added: others.reduce((sum, e) => sum + e.novel, 0),
    }
  })
}

export function changeText(change: Change) {
  const parts = [
    change.missing ? `${plural(change.missing, 'residue')} missing` : '',
    change.replaced
      ? `${plural(change.replaced, 'residue')} replaced by ${plural(change.swappedIn, 'different residue')}`
      : '',
    change.added
      ? change.missing || change.replaced
        ? `${plural(change.added, 'residue')} the canonical lacks added`
        : `inserts ${plural(change.added, 'residue')} the canonical lacks`
      : '',
  ].filter(Boolean)
  return `${span(change.start, change.end)}: ${listText(parts)}`
}

export function editPreview(edit: Edit) {
  const original = edit.end - edit.start + 1
  const before = `${edit.original}${original > edit.original.length ? '…' : ''}`
  const after = edit.replacement
    ? `${edit.replacement}${edit.added > edit.replacement.length ? '…' : ''}`
    : '—'
  return `${span(edit.start, edit.end)} ${before} → ${after}`
}

export function changeFeatures(change: Change, features: Feature[]) {
  return featureEffects(features, change.effects)
}

export function lossText(effect: FeatureEffect) {
  const { missing, replaced, size } = effect
  const ends = isBond(effect.feature) && size === 2
  const whole = (what: string) =>
    size === 1
      ? what
      : ends
        ? `both ends ${what}`
        : `all ${count(size)} ${what}`
  const part = (n: number, what: string) =>
    ends ? `1 of 2 ends ${what}` : `${count(n)} of ${count(size)} ${what}`
  return missing === size
    ? whole('missing')
    : replaced === size
      ? whole('replaced')
      : missing && replaced
        ? ends
          ? 'one end missing, the other replaced'
          : `${count(missing)} missing and ${count(replaced)} replaced, of ${count(size)}`
        : missing
          ? part(missing, 'missing')
          : part(replaced, 'replaced')
}

const PRIORITY: FeatureType[] = [
  'Signal',
  'Transit peptide',
  'Propeptide',
  'Transmembrane',
  'Intramembrane',
  'Domain',
  'Repeat',
  'Zinc finger',
  'DNA binding',
  'Motif',
  'Coiled coil',
  'Topological domain',
  'Region',
]

function featureClause(effects: FeatureEffect[]) {
  const named = effects
    .filter(e => PRIORITY.includes(e.feature.type))
    .toSorted(
      (a, b) =>
        PRIORITY.indexOf(a.feature.type) - PRIORITY.indexOf(b.feature.type) ||
        a.feature.start - b.feature.start,
    )
    .slice(0, NAMED)
  const counted = GROUPS.flatMap(group => {
    const rest = effects.filter(e => e.group === group && !named.includes(e))
    const [one, many] = GROUP_COUNTS[group]
    return rest.length
      ? [
          `${named.some(e => e.group === group) ? `${count(rest.length)} more` : count(rest.length)} ${rest.length === 1 ? one : many}`,
        ]
      : []
  })
  return listText([...named.map(e => featureLabel(e.feature)), ...counted])
}

export function residueClause(
  effects: EditEffect[],
  length: number,
  totals: Pick<Isoform, 'missing' | 'replaced' | 'novel'>,
) {
  const missing = absentOf(effects, 'missing')
  const replaced = absentOf(effects, 'replaced')
  const swappedIn = effects
    .filter(e => e.fate === 'replaced')
    .reduce((sum, e) => sum + e.novel, 0)
  const added = totals.novel - swappedIn
  const insertions = effects.filter(e => e.fate === 'missing' && e.novel > 0)
  const lacks = totals.missing
    ? missing.length <= 3
      ? `lacks ${totals.missing === 1 ? 'residue' : 'residues'} ${runsText(missing)} (${count(totals.missing)} of ${count(length)})`
      : `lacks ${count(totals.missing)} of ${count(length)} residues, in ${missing.length} stretches`
    : ''
  const swaps = totals.replaced
    ? `${
        replaced.length === 1
          ? `${totals.replaced === 1 ? 'residue' : 'residues'} ${runsText(replaced)} ${totals.replaced === 1 ? 'is' : 'are'}`
          : replaced.length <= 3
            ? `residues ${runsText(replaced)} (${count(totals.replaced)}) are`
            : `${count(totals.replaced)} residues in ${replaced.length} stretches are`
      } replaced by ${plural(swappedIn, 'different residue')}`
    : ''
  const adds = added
    ? `${totals.missing || totals.replaced ? 'it also adds' : 'it adds'} ${plural(added, 'residue')} the canonical lacks${
        insertions.length === 1 && insertions[0]
          ? `, at ${span(insertions[0].edit.start, insertions[0].edit.end)}`
          : insertions.length > 1
            ? `, at ${insertions.length} places`
            : ''
      }`
    : ''
  return totals.missing
    ? [lacks, swaps, adds].filter(Boolean).join('; ')
    : totals.replaced
      ? ['nothing is missing', swaps, adds].filter(Boolean).join('; ')
      : added
        ? `nothing is missing or replaced; ${adds}`
        : 'nothing is missing or replaced'
}

export function answer(record: GeneRecord, isoform: Isoform) {
  const effects = editEffects(isoform)
  const lost = featureEffects(record.features, effects)
  const full = lost.filter(inFull)
  const cut = lost.filter(e => e.missing > 0 && !inFull(e))
  const swapped = lost.filter(e => e.replaced > 0 && e.missing === 0)
  const clauses = [
    residueClause(effects, record.length, isoform),
    full.length ? `missing in full: ${featureClause(full)}` : '',
    cut.length ? `cut: ${featureClause(cut)}` : '',
    swapped.length
      ? `replaced in part or in full: ${featureClause(swapped)}`
      : '',
  ].filter(Boolean)
  const sentence = clauses.join('; ')
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`
}

export function residueBands(plddt: Model['plddt']) {
  return (plddt ?? []).flatMap(([band, length]) =>
    Array<number>(length).fill(band),
  )
}

function foldOf(
  runs: Run[],
  bands: number[],
  folded: number,
  which: 'missing' | 'replaced',
) {
  const total = runLength(runs)
  const unfolded = runs
    .flatMap(([start, end]) => bands.slice(start - 1, end))
    .filter(band => band < UNFOLDED_PLDDT).length
  return unfolded > total / 2
    ? `The canonical model shows no fold where residues are ${which}: ${count(unfolded)} of the ${count(total)} have pLDDT below ${UNFOLDED_PLDDT}.`
    : folded === 0
      ? `${total === 1 ? `The ${which} residue is not` : `None of the ${count(total)} ${which} residues is`} folded in the canonical model (pLDDT below ${FOLDED_PLDDT}).`
      : `${
          folded === total
            ? total === 1
              ? `The ${which} residue is`
              : `All ${count(total)} ${which} residues are`
            : `${count(folded)} of the ${count(total)} ${which} residues ${folded === 1 ? 'is' : 'are'}`
        } folded in the canonical model (pLDDT ≥ ${FOLDED_PLDDT}).`
}

export function foldText(record: GeneRecord, isoform: Isoform) {
  const model = record.canonical.model
  const effects = editEffects(isoform)
  const bands = residueBands(model?.plddt ?? null)
  const missing = absentOf(effects, 'missing')
  const replaced = absentOf(effects, 'replaced')
  return !model
    ? 'AlphaFold DB has no full-length model of the canonical protein, so folded residues are not counted.'
    : !model.plddt ||
        isoform.foldedAbsent === null ||
        isoform.foldedMissing === null
      ? `The canonical model's confidence (${model.entry}) is not yet fetched, so folded residues are not counted.`
      : !isoform.missing && !isoform.replaced
        ? 'Every canonical residue is present.'
        : [
            isoform.missing
              ? foldOf(missing, bands, isoform.foldedMissing, 'missing')
              : '',
            isoform.replaced
              ? foldOf(
                  replaced,
                  bands,
                  isoform.foldedAbsent - isoform.foldedMissing,
                  'replaced',
                )
              : '',
          ]
            .filter(Boolean)
            .join(' ')
}

export function partnerName(record: GeneRecord, partner: string) {
  return partner === record.gene ? `${partner} (itself)` : partner
}

export function interfaceRows(record: GeneRecord, isoform: Isoform) {
  return Object.entries(record.interfaces)
    .map(([partner, residues]) => {
      const [missing, replaced] = isoform.interfaces[partner] ?? [0, 0]
      return {
        partner,
        name: partnerName(record, partner),
        residues,
        missing,
        replaced,
        total: residues.length,
      }
    })
    .toSorted(
      (a, b) =>
        b.missing / b.total - a.missing / a.total ||
        b.replaced / b.total - a.replaced / a.total ||
        a.partner.localeCompare(b.partner),
    )
}

export function interfaceLossText(row: {
  missing: number
  replaced: number
  total: number
}) {
  return [
    row.missing ? `${count(row.missing)} missing` : '',
    row.replaced ? `${count(row.replaced)} replaced` : '',
  ]
    .filter(Boolean)
    .join(', ')
    .concat(` of ${plural(row.total, 'interface residue')}`)
}

export function interfaceSummary(record: GeneRecord, isoform: Isoform) {
  const rows = interfaceRows(record, isoform)
  const half = rows.filter(r => r.missing >= INTERFACE_LOST_SHARE * r.total)
  const touched = rows.filter(r => r.missing + r.replaced > 0)
  return !rows.length
    ? ''
    : half.length
      ? `Missing at least half of the predicted interface with ${listText(half.map(r => r.name))}.`
      : touched.length
        ? `Missing or replaced under half of the predicted interface with ${listText(touched.map(r => r.name))}.`
        : `Every predicted interface residue is present, for ${plural(rows.length, 'partner')}.`
}

export function modelText(record: GeneRecord, isoform: Isoform) {
  const model = isoform.model
  return !model
    ? "AlphaFold DB has no model of this isoform's exact sequence."
    : model.meanPlddt === null
      ? `AlphaFold DB has a model, ${model.entry}; its confidence is not yet fetched.`
      : `${model.entry}, mean pLDDT ${model.meanPlddt.toFixed(1)}. ${
          model.losingConfidence === null
            ? record.canonical.model?.plddt
              ? "Its confidence is not compared with the canonical model's."
              : 'Not compared with the canonical protein, which has no full-length model with confidence fetched.'
            : model.losingConfidence === 0
              ? `No shared residue falls from pLDDT ≥ ${FOLDED_PLDDT} in the canonical model to below ${UNFOLDED_PLDDT} in this one.`
              : `${plural(model.losingConfidence, 'shared residue')} ${model.losingConfidence === 1 ? 'falls' : 'fall'} from pLDDT ≥ ${FOLDED_PLDDT} in the canonical model to below ${UNFOLDED_PLDDT} in this one: the model's confidence, not a measurement of folding.`
        }`
}

export function maneIsoform(record: GeneRecord) {
  return record.canonical.transcripts.maneSelect
    ? record.canonical
    : record.isoforms.find(i => i.transcripts.maneSelect)
}

export function transcriptOf(isoform: Pick<Isoform, 'transcripts'>) {
  return isoform.transcripts.refseq[0] ?? isoform.transcripts.ensembl[0]
}
