import {
  FEATURE_GROUPS,
  type Edit,
  type Feature,
  type FeatureGroup,
  type GeneRecord,
  type Isoform,
  type Model,
  type Segment,
} from '../../src/types.ts'
import {
  FOLDED_PLDDT,
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

const NOUNS: Record<string, string> = {
  Signal: 'signal peptide',
  'DNA binding': 'DNA-binding region',
  Transmembrane: 'transmembrane segment',
  Intramembrane: 'intramembrane segment',
}

const GROUP_COUNTS: Record<FeatureGroup, [string, string]> = {
  targeting: [
    'processing, targeting or topology feature',
    'processing, targeting and topology features',
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

export function featureNoun(feature: Feature) {
  return NOUNS[feature.type] ?? feature.type.toLowerCase()
}

const MEMBRANE: readonly string[] = ['Transmembrane', 'Intramembrane']

export function featureName(feature: Feature) {
  const parts = feature.description.split('; ').filter(Boolean)
  const named = parts.find(p => p.startsWith('Name='))?.slice(5)
  const qualifiers = parts
    .filter(p => !p.startsWith('Name='))
    .map(p => p.replace(/^Note=/, ''))
  const membrane = MEMBRANE.includes(feature.type)
  const main = membrane
    ? named?.replace(/^Segment /, '')
    : (qualifiers[0] ?? named)
  const rest = membrane
    ? qualifiers.filter(q => q !== 'Helical')
    : qualifiers.slice(1)
  return {
    main: main ?? '',
    qualifiers: rest.map(q => `${q.charAt(0).toLowerCase()}${q.slice(1)}`),
  }
}

export function featureLabel(feature: Feature) {
  const noun = featureNoun(feature)
  const { main, qualifiers } = featureName(feature)
  const membrane = MEMBRANE.includes(feature.type)
  const inside = [...qualifiers, featurePlace(feature)].join(', ')
  return !main
    ? `${noun} (${inside})`
    : membrane || /^[\d-]+$/.test(main)
      ? `${noun} ${main} (${inside})`
      : `${main} (${noun}, ${inside})`
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

const IN_SWAP = 'in a replaced stretch'

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
  const swapped = size === 1 || ends ? IN_SWAP : 'replaced'
  return missing === size
    ? whole('missing')
    : replaced === size
      ? whole(swapped)
      : missing && replaced
        ? ends
          ? `one end missing, the other ${IN_SWAP}`
          : `${count(missing)} missing and ${count(replaced)} replaced, of ${count(size)}`
        : missing
          ? part(missing, 'missing')
          : part(replaced, swapped)
}

const PRIORITY: readonly (readonly string[])[] = [
  ['Active site'],
  ['Peptide', 'Chain'],
  ['Signal'],
  ['Transit peptide'],
  ['Propeptide'],
  ['Transmembrane'],
  ['Intramembrane'],
  ['Domain'],
  ['Zinc finger'],
  ['DNA binding'],
  ['Repeat'],
  ['Binding site'],
  ['Disulfide bond'],
  ['Motif'],
  ['Site'],
  ['Coiled coil'],
  ['Region'],
]
const PRODUCTS: readonly string[] = ['Peptide', 'Chain']
const NAMED_PRODUCTS = 2

function rankOf(type: string) {
  return PRIORITY.findIndex(tier => tier.includes(type))
}

function rank(effect: FeatureEffect) {
  return rankOf(effect.feature.type)
}

export function inSentence(effect: FeatureEffect) {
  return effect.feature.type !== 'Topological domain'
}

export function byPriority(a: FeatureEffect, b: FeatureEffect) {
  return (
    rank(a) - rank(b) ||
    a.feature.start - b.feature.start ||
    a.feature.end - b.feature.end
  )
}

export function byShareLost(a: FeatureEffect, b: FeatureEffect) {
  return b.missing / b.size - a.missing / a.size || byPriority(a, b)
}

export function featureClause(
  effects: FeatureEffect[],
  order: (a: FeatureEffect, b: FeatureEffect) => number = byPriority,
) {
  const named = effects
    .filter(e => rank(e) >= 0)
    .toSorted(order)
    .reduce<FeatureEffect[]>(
      (chosen, e) =>
        chosen.length < NAMED &&
        (!PRODUCTS.includes(e.feature.type) ||
          chosen.filter(c => PRODUCTS.includes(c.feature.type)).length <
            NAMED_PRODUCTS)
          ? [...chosen, e]
          : chosen,
      [],
    )
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

function envelope(runs: Run[]): Run {
  return [
    Math.min(...runs.map(([start]) => start)),
    Math.max(...runs.map(([, end]) => end)),
  ]
}

export function swapHost(runs: Run[], features: Feature[]) {
  const total = runLength(runs)
  return features
    .filter(
      f =>
        !isBond(f) &&
        f.type !== 'Topological domain' &&
        f.type !== 'Chain' &&
        rankOf(f.type) >= 0,
    )
    .map(feature => ({
      feature,
      inside: overlap(runs, [feature.start, feature.end]),
    }))
    .filter(h => h.inside === total)
    .toSorted(
      (a, b) =>
        a.feature.end - a.feature.start - (b.feature.end - b.feature.start) ||
        rankOf(a.feature.type) - rankOf(b.feature.type),
    )[0]?.feature
}

export function hostName(feature: Feature) {
  const noun = featureNoun(feature)
  const { main } = featureName(feature)
  return !main
    ? `the ${noun}`
    : MEMBRANE.includes(feature.type) || main.length <= 4
      ? `${noun} ${main}`
      : `the ${main} ${noun}`
}

function swapPhrase(effects: EditEffect[], features: Feature[]) {
  const runs = mergeRuns(effects.flatMap(e => e.absent))
  const removed = runLength(runs)
  const added = effects.reduce((sum, e) => sum + e.novel, 0)
  const [start, end] = envelope(runs)
  const host = swapHost(runs, features)
  const of = host ? ` of ${hostName(host)}` : ''
  return `has ${added === 1 ? 'a different residue' : `${count(added)} different residues`} in place of ${removed === 1 ? `residue ${span(start, end)}${of}` : `${count(removed)} residues${of} (${span(start, end)})`}`
}

export function residueClause(
  effects: EditEffect[],
  length: number,
  features: Feature[] = [],
) {
  const missingRuns = absentOf(effects, 'missing')
  const missing = runLength(missingRuns)
  const tails = effects.filter(
    e => e.fate === 'missing' && e.removed > 0 && e.novel > 0,
  )
  const inserts = effects.filter(e => e.removed === 0 && e.novel > 0)
  const tailNovel = tails.reduce((sum, e) => sum + e.novel, 0)
  const swaps = changes(effects).filter(c => c.replaced > 0)
  const swapPhrases =
    swaps.length <= 2
      ? swaps.map(c =>
          swapPhrase(
            c.effects.filter(e => e.fate === 'replaced'),
            features,
          ),
        )
      : [
          `has ${count(swaps.reduce((sum, c) => sum + c.swappedIn, 0))} different residues in place of ${count(swaps.reduce((sum, c) => sum + c.replaced, 0))} residues in ${swaps.length} stretches`,
        ]
  const inserted = inserts.reduce((sum, e) => sum + e.novel, 0)
  const insertNoun = inserts.length
    ? `${plural(inserted, 'residue')} the canonical lacks, at ${
        inserts.length === 1 && inserts[0]
          ? span(inserts[0].edit.start, inserts[0].edit.end)
          : `${inserts.length} places`
      }`
    : ''
  const insertPhrase = insertNoun ? `has ${insertNoun}` : ''
  const tailPhrase = !tails.length
    ? ''
    : tails.length === 1 && missingRuns.length === 1
      ? `, with ${plural(tailNovel, 'different residue')} in their place`
      : `, with ${plural(tailNovel, 'different residue')} in place of ${tails.length <= 2 ? runsText(tails.flatMap(e => e.absent)) : `${tails.length} of those stretches`}`
  const lacks = missing
    ? `${
        missingRuns.length <= 3
          ? `lacks ${missing === 1 ? 'residue' : 'residues'} ${runsText(missingRuns)} (${count(missing)} of ${count(length)})`
          : `lacks ${count(missing)} of ${count(length)} residues, in ${missingRuns.length} stretches`
      }${tailPhrase}`
    : ''
  return missing
    ? [lacks, ...swapPhrases, insertPhrase].filter(Boolean).join('; ')
    : swapPhrases.length
      ? [
          listText([...swapPhrases, insertPhrase].filter(Boolean)),
          'every other canonical residue is present',
        ].join('; ')
      : inserts.length
        ? `has every canonical residue and ${insertNoun}`
        : 'has every canonical residue'
}

export function answer(record: GeneRecord, isoform: Isoform) {
  const effects = editEffects(isoform)
  const lost = featureEffects(record.features, effects).filter(inSentence)
  const hosts = changes(effects)
    .filter(c => c.replaced > 0)
    .map(c =>
      swapHost(
        mergeRuns(
          c.effects.filter(e => e.fate === 'replaced').flatMap(e => e.absent),
        ),
        record.features,
      ),
    )
  const full = lost.filter(inFull)
  const cut = lost.filter(e => e.missing > 0 && !inFull(e))
  const swapped = lost.filter(
    e => e.replaced > 0 && e.missing === 0 && !hosts.includes(e.feature),
  )
  const clauses = [
    residueClause(effects, record.length, record.features),
    full.length ? `missing in full: ${featureClause(full)}` : '',
    cut.length ? `cut: ${featureClause(cut, byShareLost)}` : '',
    swapped.length ? `in a replaced stretch: ${featureClause(swapped)}` : '',
  ].filter(Boolean)
  const sentence = clauses.join('; ')
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`
}

export function residueBands(plddt: Model['plddt']) {
  return (plddt ?? []).flatMap(([band, length]) =>
    Array<number>(length).fill(band),
  )
}

function confidenceOf(
  runs: Run[],
  bands: number[],
  confident: number,
  which: Fate,
) {
  const total = runLength(runs)
  const low = runs
    .flatMap(([start, end]) => bands.slice(start - 1, end))
    .filter(band => band < UNFOLDED_PLDDT).length
  return total === 1
    ? `The ${which} residue ${
        confident
          ? `is confidently modelled in the canonical model (pLDDT ≥ ${FOLDED_PLDDT})`
          : low
            ? `has pLDDT below ${UNFOLDED_PLDDT} in the canonical model`
            : `has pLDDT between ${UNFOLDED_PLDDT} and ${FOLDED_PLDDT} in the canonical model`
      }.`
    : `Of the ${count(total)} ${which} residues, ${count(confident)} ${confident === 1 ? 'is' : 'are'} confidently modelled in the canonical model (pLDDT ≥ ${FOLDED_PLDDT}) and ${count(low)} ${low === 1 ? 'has' : 'have'} pLDDT below ${UNFOLDED_PLDDT}.`
}

export function confidenceText(record: GeneRecord, isoform: Isoform) {
  const model = record.canonical.model
  const effects = editEffects(isoform)
  const bands = residueBands(model?.plddt ?? null)
  return !model
    ? 'AlphaFold DB has no full-length model of the canonical protein, so absent residues are not counted by confidence.'
    : !model.plddt ||
        isoform.foldedAbsent === null ||
        isoform.foldedMissing === null
      ? `The canonical model's confidence (${model.entry}) is not yet fetched, so absent residues are not counted by it.`
      : !isoform.missing && !isoform.replaced
        ? 'Every canonical residue is present.'
        : [
            isoform.missing
              ? confidenceOf(
                  absentOf(effects, 'missing'),
                  bands,
                  isoform.foldedMissing,
                  'missing',
                )
              : '',
            isoform.replaced
              ? confidenceOf(
                  absentOf(effects, 'replaced'),
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
  name: string
  missing: number
  replaced: number
  total: number
}) {
  return `${row.name}: ${
    row.missing && row.replaced
      ? `${count(row.missing)} missing and ${count(row.replaced)} replaced`
      : row.missing
        ? `${count(row.missing)} missing`
        : `${count(row.replaced)} replaced`
  }, of ${plural(row.total, 'interface residue')}`
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
              ? `Every shared residue with pLDDT ≥ ${FOLDED_PLDDT} in the canonical model has pLDDT ${UNFOLDED_PLDDT} or more in this one.`
              : `${plural(model.losingConfidence, 'shared residue')} ${model.losingConfidence === 1 ? 'has' : 'have'} pLDDT ≥ ${FOLDED_PLDDT} in the canonical model and below ${UNFOLDED_PLDDT} in this one; pLDDT is the model's confidence in each residue.`
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
