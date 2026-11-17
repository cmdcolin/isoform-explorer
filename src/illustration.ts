import { join } from 'node:path'

import { getJson, getText } from './cache.ts'
import type { Point } from './contacts.ts'
import { record, text, writeJson } from './json.ts'
import { DATA, ROOT } from './paths.ts'
import { centre, cross, dot, largestAxis } from './structure.ts'

export const KIND = { protein: 0, highlight: 1, ligand: 2 } as const

export interface Illustration {
  name: string
  pdb: string
  highlight: [start: number, end: number]
  ligand: string
}

export const ILLUSTRATIONS: Illustration[] = [
  {
    name: 'pkm',
    pdb: '3BJF',
    highlight: [389, 433],
    ligand: 'FBP',
  },
]

interface Atom {
  coord: Point
  chain: string
  kind: number
}

export function structTitle(cif: string) {
  const match = /^_struct\.title\s+'(.*)'\s*$/m.exec(cif)
  return match?.[1] ?? ''
}

export function parseAtoms(cif: string, { highlight, ligand }: Illustration) {
  const header: string[] = []
  const atoms: Atom[] = []
  for (const line of cif.split(/\r?\n/)) {
    if (line.startsWith('_atom_site.')) {
      header.push(line.slice('_atom_site.'.length).trim())
    } else if (
      header.length &&
      (line.startsWith('ATOM') || line.startsWith('HETATM'))
    ) {
      const row = line.trim().split(/\s+/)
      const field = (tag: string) => row[header.indexOf(tag)] ?? ''
      const residue = Number(field('auth_seq_id'))
      const het = row[0] === 'HETATM'
      const kept =
        field('type_symbol') !== 'H' &&
        ['.', 'A'].includes(field('label_alt_id')) &&
        (!het || field('label_comp_id') === ligand)
      if (kept) {
        atoms.push({
          coord: [
            Number(field('Cartn_x')),
            Number(field('Cartn_y')),
            Number(field('Cartn_z')),
          ],
          chain: field('auth_asym_id'),
          kind: het
            ? KIND.ligand
            : residue >= highlight[0] && residue <= highlight[1]
              ? KIND.highlight
              : KIND.protein,
        })
      }
    }
  }
  return atoms
}

export function flatten(atoms: Atom[]) {
  const middle = centre(atoms.map(a => a.coord))
  const points = atoms.map(({ coord }): Point => [
    coord[0] - middle[0],
    coord[1] - middle[1],
    coord[2] - middle[2],
  ])
  const across = largestAxis(points, [])
  const down = largestAxis(points, [across])
  const toward = cross(across, down)
  const chains = [...new Set(atoms.map(a => a.chain))]
  return atoms.flatMap((atom, i) => {
    const p = points[i] ?? [0, 0, 0]
    return [
      Math.round(dot(p, across) * 10),
      Math.round(dot(p, down) * 10),
      Math.round(dot(p, toward) * 10),
      chains.indexOf(atom.chain),
      atom.kind,
    ]
  })
}

export interface GenomicWindow {
  name: string
  chromosome: string
  start: number
  end: number
  strand: 1 | -1
}

export const WINDOWS: GenomicWindow[] = [
  {
    name: 'ndufc2-exon2',
    chromosome: '11',
    start: 78073061,
    end: 78073160,
    strand: -1,
  },
]

export function blogDataPath(file: string) {
  return join(ROOT, 'web', 'content', 'blog', 'data', file)
}

if (import.meta.main) {
  for (const illustration of ILLUSTRATIONS) {
    const cif = await getText(
      `https://files.rcsb.org/download/${illustration.pdb}.cif`,
      join(DATA, 'pdb', `${illustration.pdb}.cif.gz`),
    )
    const path = blogDataPath(`${illustration.name}-atoms.json`)
    writeJson(path, {
      pdb: illustration.pdb,
      title: structTitle(cif),
      highlight: illustration.highlight,
      ligand: illustration.ligand,
      atoms: flatten(parseAtoms(cif, illustration)),
    })
    console.log(path)
  }
  for (const window of WINDOWS) {
    const region = `${window.chromosome}:${window.start}..${window.end}:${window.strand}`
    const response = record(
      await getJson(
        `https://rest.ensembl.org/sequence/region/human/${region}`,
        join(DATA, 'genomic', `${window.name}.json`),
        { 'content-type': 'application/json' },
      ),
    )
    const path = blogDataPath(`${window.name}.json`)
    writeJson(path, { ...window, sequence: text(response.seq) ?? '' })
    console.log(path)
  }
}
