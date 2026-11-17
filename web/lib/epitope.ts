import type { Isoform } from '../../src/types.ts'
import { editEffects, listText, mergeRuns, overlap, span } from './loss.ts'
import type { Fate, Run } from './loss.ts'

export const ABUT = 3

export function isoformLabel(isoform: Pick<Isoform, 'name'>) {
  return /^\d+$/.test(isoform.name) ? `Isoform ${isoform.name}` : isoform.name
}

export function positionsText(positions: number[]) {
  return listText(
    mergeRuns(positions.map((p): Run => [p, p])).map(([start, end]) =>
      span(start, end),
    ),
  )
}

export function absentText(isoform: Pick<Isoform, 'edits' | 'segments'>) {
  return editEffects(isoform)
    .flatMap(effect => effect.absent)
    .map(([start, end]) => span(start, end))
    .join(', ')
}

export function lacksText(isoform: Pick<Isoform, 'edits' | 'segments'>) {
  return `lacks ${absentText(isoform)}`
}

function within(runs: Run[], position: number, reach = 0) {
  return runs.some(
    ([start, end]) => position >= start - reach && position <= end + reach,
  )
}

/**
 * Each contact residue of one structure's copy as present in the isoform,
 * missing or replaced, and whether the isoform's edits touch the residues the
 * structure resolves at all: an isoform differing only outside them cannot be
 * assessed from it.
 */
export function contactStates(
  contacts: number[],
  observed: Run[],
  isoform: Pick<Isoform, 'edits' | 'segments'>,
) {
  const effects = editEffects(isoform)
  const absent = (fate: Fate) =>
    mergeRuns(
      effects.filter(effect => effect.fate === fate).flatMap(e => e.absent),
    )
  const missing = absent('missing')
  const replaced = absent('replaced')
  const edited = mergeRuns([...missing, ...replaced])
  const present = contacts.filter(position => !within(edited, position))
  const span: Run = [observed[0]?.[0] ?? 0, observed.at(-1)?.[1] ?? 0]
  return {
    total: contacts.length,
    present: present.length,
    missing: contacts.filter(position => within(missing, position)),
    replaced: contacts.filter(position => within(replaced, position)),
    abutting: present.filter(position => within(edited, position, ABUT)),
    span,
    where:
      edited.length === 0
        ? 'none'
        : edited.some(run => overlap(observed, run) > 0)
          ? 'resolved'
          : edited.some(run => overlap([span], run) > 0)
            ? 'unresolved'
            : 'outside',
  }
}

export interface Copy {
  chain: string
  binders: string[]
  contacts: number[]
  observed: Run[]
  sugars: { site: number; contact: boolean }[]
}

export interface Structure {
  accession: string
  pdb: string
  title: string
  resolution: number | null
  target: string | null
  construct: Record<string, string>
  binders: string[]
  copies: Copy[]
}

/**
 * The contact residues every copy in the asymmetric unit agrees on, and the
 * residues every copy resolves, so a crystal with several copies gives one
 * set that does not hang on which copy was picked.
 */
function intersect([start, end]: Run, runs: Run[]) {
  return runs.flatMap(([a, b]): Run[] =>
    Math.max(start, a) <= Math.min(end, b)
      ? [[Math.max(start, a), Math.min(end, b)]]
      : [],
  )
}

export function sharedContacts(copies: Copy[]) {
  const [first, ...rest] = copies
  return {
    contacts: (first?.contacts ?? []).filter(position =>
      rest.every(copy => copy.contacts.includes(position)),
    ),
    observed: rest.reduce(
      (runs, copy) => runs.flatMap(run => intersect(run, copy.observed)),
      first?.observed ?? [],
    ),
    sugarContacts: (first?.sugars ?? [])
      .filter(sugar => sugar.contact)
      .map(sugar => sugar.site)
      .filter(site =>
        rest.every(copy =>
          copy.sugars.some(sugar => sugar.site === site && sugar.contact),
        ),
      ),
    sugarSites: (first?.sugars ?? [])
      .map(sugar => sugar.site)
      .filter(site =>
        rest.every(copy => copy.sugars.some(sugar => sugar.site === site)),
      ),
    sizes: copies.map(copy => copy.contacts.length),
    any: new Set(copies.flatMap(copy => copy.contacts)).size,
  }
}
