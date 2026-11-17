import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { HERO_COLOURS } from './home-hero-colours.ts'

export interface HomeHero {
  gene: string
  accession: string
  isoformId: string
  partnerGene: string
  length: number
  kept: [number, number][]
  contacts: number[]
  anchor: [number, number]
  anchorRmsd: number
}

const LEFT = 170
const RIGHT = 1040
const WIDTH = 1076
const HEIGHT = 150

export function loadHomeHero() {
  const hero: HomeHero = JSON.parse(
    readFileSync(
      join(process.cwd(), 'web', 'content', 'blog', 'data', 'home-hero.json'),
      'utf8',
    ),
  )
  return hero
}

export function isoformName(hero: HomeHero) {
  return `isoform ${hero.isoformId.split('-').pop()}`
}

export function keptContacts(hero: HomeHero) {
  return hero.contacts.filter(residue =>
    hero.kept.some(([start, end]) => residue >= start && residue <= end),
  ).length
}

function runs(positions: number[]) {
  return [...positions]
    .sort((a, b) => a - b)
    .reduce<[number, number][]>((found, position) => {
      const last = found.at(-1)
      return last && position <= last[1] + 1
        ? [...found.slice(0, -1), [last[0], position]]
        : [...found, [position, position]]
    }, [])
}

export function heroSchematic(hero: HomeHero) {
  const x = (residue: number) =>
    LEFT + ((residue - 1) / hero.length) * (RIGHT - LEFT)
  const keptEnd = Math.max(...hero.kept.map(([, end]) => end))
  const boundary = x(keptEnd + 1)
  const { present, lost, contact, ink, muted } = HERO_COLOURS
  const bar = (top: number, from: number, to: number, fill: string) =>
    `<rect x="${x(from)}" y="${top}" width="${x(to + 1) - x(from)}" height="18" fill="${fill}"/>`
  const label = (y: number, text: string, weight = 400) =>
    `<text x="0" y="${y}" font-size="14" font-weight="${weight}" fill="${ink}">${text}</text>`
  const ticks = [1, 50, 100, 150, 200, 250, 300, 350, hero.length]
    .map(
      t =>
        `<line x1="${x(t)}" x2="${x(t)}" y1="118" y2="122" stroke="${ink}"/><text x="${x(t)}" y="136" text-anchor="middle" font-size="12" fill="${muted}">${t}</text>`,
    )
    .join('')
  return `<svg class="home-hero-schematic" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${hero.gene}: the residues that contact ${hero.partnerGene}, the canonical isoform, and ${isoformName(hero)}, which ends at residue ${keptEnd}">
${label(25, `Contacts ${hero.partnerGene}`)}
${runs(hero.contacts)
  .map(
    ([from, to]) =>
      `<rect x="${x(from)}" y="14" width="${Math.max(x(to + 1) - x(from), 3)}" height="16" fill="${contact}"/>`,
  )
  .join('')}
${label(66, `${hero.accession}-1`, 700)}
${bar(52, 1, keptEnd, present)}${bar(52, keptEnd + 1, hero.length, lost)}
${label(100, hero.isoformId)}
${bar(86, 1, keptEnd, present)}
<line x1="${boundary}" x2="${x(hero.length + 1)}" y1="95" y2="95" stroke="${lost}" stroke-width="1.5"/>
<line x1="${boundary}" x2="${boundary}" y1="10" y2="112" stroke="${muted}" stroke-width="1.5" stroke-dasharray="4 3"/>
<text x="${boundary + 6}" y="44" font-size="12.5" fill="${muted}">${isoformName(hero)} ends at residue ${keptEnd}</text>
<line x1="${LEFT}" x2="${RIGHT}" y1="118" y2="118" stroke="${ink}"/>${ticks}
</svg>`
}
