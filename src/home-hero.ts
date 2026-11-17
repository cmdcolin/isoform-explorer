import { join } from 'node:path'

import { getText } from './cache.ts'
import type { Point } from './contacts.ts'
import {
  list,
  number,
  readJson,
  record,
  records,
  text,
  writeJson,
} from './json.ts'
import { DATA, ROOT, SITE_DATA } from './paths.ts'
import type { Segment } from './types.ts'
import {
  type Residue,
  contactFrame,
  parseBackbone,
  rmsd,
  superposition,
} from './structure.ts'

export const HOME_HERO = {
  gene: 'RAD51C',
  isoform: 'O43502-2',
  partner: 'XRCC3',
  complex: 'AF-0000000210436430',
  anchor: [90, 134],
} as const

const TENTHS = 10

export interface HeroInput {
  complexCif: string
  isoformCif: string
  segments: Segment[]
  anchor: readonly [number, number]
}

function canonicalPosition(segments: Segment[], position: number) {
  const segment = segments.find(
    ([start, , length]) => position >= start && position < start + length,
  )
  return segment ? segment[1] + position - segment[0] : undefined
}

export function keptRanges(segments: Segment[]) {
  return segments.map(([, start, length]): [number, number] => [
    start,
    start + length - 1,
  ])
}

function flat(residues: Residue[], place: (p: Point) => Point) {
  return residues.flatMap(({ position, coord, plddt }) => [
    position,
    ...place(coord).map(c => Math.round(c * TENTHS)),
    Math.round(plddt),
  ])
}

export function heroTraces({
  complexCif,
  isoformCif,
  segments,
  anchor,
}: HeroInput) {
  const canonical = parseBackbone(complexCif, 'A')
  const partner = parseBackbone(complexCif, 'B')
  const isoform = parseBackbone(isoformCif).flatMap(residue => {
    const position = canonicalPosition(segments, residue.position)
    return position === undefined ? [] : [{ ...residue, position }]
  })
  const canonicalAt = new Map(canonical.map(r => [r.position, r]))
  const shared = isoform.flatMap(residue => {
    const same = canonicalAt.get(residue.position)
    return same &&
      residue.position >= anchor[0] &&
      residue.position <= anchor[1]
      ? [{ moved: residue.coord, fixed: same.coord }]
      : []
  })
  const place = superposition(
    shared.map(s => s.moved),
    shared.map(s => s.fixed),
  )
  const frame = contactFrame(
    canonical.filter(r => r.plddt >= 70).map(r => r.coord),
    partner.filter(r => r.plddt >= 70).map(r => r.coord),
  )
  return {
    anchorRmsd:
      Math.round(
        rmsd(
          shared.map(s => place(s.moved)),
          shared.map(s => s.fixed),
        ) * TENTHS,
      ) / TENTHS,
    canonical: flat(canonical, frame),
    partner: flat(partner, frame),
    isoform: flat(isoform, p => frame(place(p))),
  }
}

if (import.meta.main) {
  const { gene, isoform, partner, complex, anchor } = HOME_HERO
  const data = record(readJson(join(SITE_DATA, 'genes', `${gene}.json`)))
  const entry = records(data.isoforms).find(i => i.accession === isoform)
  const cif = text(record(entry?.model).cif)
  const segments = list(entry?.segments).flatMap(s => {
    const [start, canonicalStart, length] = list(s).map(number)
    return start !== undefined &&
      canonicalStart !== undefined &&
      length !== undefined
      ? [[start, canonicalStart, length] satisfies Segment]
      : []
  })
  const contacts = list(record(data.interfaces)[partner]).flatMap(n =>
    typeof n === 'number' ? [n] : [],
  )
  if (cif) {
    const traces = heroTraces({
      complexCif: await getText(
        `https://alphafold.ebi.ac.uk/files/${complex}-model_v1.cif`,
        join(DATA, 'cif', `${complex}.cif.gz`),
      ),
      isoformCif: await getText(
        cif,
        join(DATA, 'cif', `${cif.split('/').pop()}.gz`),
      ),
      segments,
      anchor,
    })
    const path = join(ROOT, 'web', 'content', 'blog', 'data', 'home-hero.json')
    writeJson(path, {
      gene,
      accession: text(data.accession),
      isoformId: isoform,
      partnerGene: partner,
      length: number(data.length),
      kept: keptRanges(segments),
      anchor,
      contacts,
      ...traces,
    })
    console.log(path, `anchor RMSD ${traces.anchorRmsd} Å`)
  }
}
