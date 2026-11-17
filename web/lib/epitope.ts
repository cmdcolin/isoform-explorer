import type { Isoform } from '../../src/types.ts'
import { editEffects, mergeRuns, overlap } from './loss.ts'
import type { Fate, Run } from './loss.ts'

export const ABUT = 3

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
