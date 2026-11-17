import type { GeneRecord } from '../../src/types.ts'
import {
  contactStates,
  isoformLabel,
  lacksText,
  sharedContacts,
} from './epitope.ts'
import type { Structure } from './epitope.ts'
import { esc } from './html.ts'

const WIDTH = 1400
const HEIGHT = 800
const LEFT = 330
const RIGHT = 1350
const STRIP = 230
const GRID = 410
const ROW = 82
const GAP = 56
const DOT = 6.5

export interface Binder {
  pdb: string
  name: string
  tone: string
}

export function contactGridFigure(
  record: GeneRecord,
  structures: Structure[],
  binders: Binder[],
) {
  const x = (residue: number) =>
    LEFT + ((residue - 1) / (record.length - 1)) * (RIGHT - LEFT)
  const blocks = binders
    .flatMap(binder => {
      const structure = structures.find(s => s.pdb === binder.pdb)
      return structure
        ? [{ ...binder, ...sharedContacts(structure.copies) }]
        : []
    })
    .toSorted((a, b) => (a.contacts[0] ?? 0) - (b.contacts[0] ?? 0))
  const columns = blocks.reduce((sum, block) => sum + block.contacts.length, 0)
  const step = (RIGHT - LEFT - GAP * (blocks.length - 1)) / (columns - 1)
  const placed = blocks.map((block, k) => {
    const before = blocks
      .slice(0, k)
      .reduce((sum, b) => sum + b.contacts.length, 0)
    const left = LEFT + before * step + k * (GAP - step)
    return {
      ...block,
      xs: block.contacts.map((_, i) => left + i * step),
    }
  })
  const domains = record.features
    .filter(f => f.type === 'Domain')
    .map(
      (f, i) =>
        `<rect x="${x(f.start)}" y="${STRIP - 18}" width="${x(f.end) - x(f.start)}" height="36" rx="16" fill="var(--diagram-protein)" stroke="var(--text-2)" stroke-width="1.5" /><text x="${(x(f.start) + x(f.end)) / 2}" y="${STRIP + 6}" class="domain">d${i + 1}</text>`,
    )
    .join('')
  const membrane = record.features
    .filter(f => f.type === 'Transmembrane')
    .map(
      f =>
        `<rect x="${x(f.start) - 4}" y="${STRIP - 46}" width="${x(f.end) - x(f.start) + 8}" height="92" fill="var(--chain)" opacity="0.7" /><text x="${x(f.end) + 12}" y="${STRIP - 30}" class="small left">membrane</text>`,
    )
    .join('')
  const backbone = `<line x1="${x(1)}" y1="${STRIP}" x2="${x(record.length)}" y2="${STRIP}" stroke="var(--text-2)" stroke-width="3" />`
  const labels = placed
    .map(block => {
      const [first = 0, last = 0] = [block.contacts[0], block.contacts.at(-1)]
      return `<path d="M${x(first)} ${STRIP - 30} v-10 H${x(last)} v10" fill="none" stroke="var(--${block.tone})" stroke-width="3" /><text x="${(x(first) + x(last)) / 2}" y="${STRIP - 52}" class="binder" fill="var(--${block.tone})">${esc(block.name)}</text>`
    })
    .join('')
  const fans = placed
    .flatMap(block =>
      block.contacts.map(
        (residue, i) =>
          `<line x1="${x(residue)}" y1="${STRIP + 18}" x2="${block.xs[i]}" y2="${GRID - 26}" stroke="var(--${block.tone})" stroke-width="1" opacity="0.4" />`,
      ),
    )
    .join('')
  const forms = [
    {
      name: `${record.canonical.name} (canonical)`,
      lacks: '',
      states: null,
    },
    ...record.isoforms.map(isoform => ({
      name: isoformLabel(isoform),
      lacks: lacksText(isoform),
      states: placed.map(block =>
        contactStates(block.contacts, block.observed, isoform),
      ),
    })),
  ]
  const rows = forms
    .map((form, r) => {
      const y = GRID + r * ROW
      const dots = placed
        .flatMap((block, k) => {
          const missing = new Set([
            ...(form.states?.[k]?.missing ?? []),
            ...(form.states?.[k]?.replaced ?? []),
          ])
          return block.contacts.map((residue, i) =>
            missing.has(residue)
              ? `<circle cx="${block.xs[i]}" cy="${y}" r="${DOT - 1}" fill="none" stroke="var(--caution)" stroke-width="2.5" />`
              : `<circle cx="${block.xs[i]}" cy="${y}" r="${DOT}" fill="var(--${block.tone})" />`,
          )
        })
        .join('')
      return `<text x="40" y="${y + 1}" class="row">${esc(form.name)}</text>${form.lacks ? `<text x="40" y="${y + 22}" class="small left">${esc(form.lacks)}</text>` : ''}${dots}`
    })
    .join('')
  return `<svg class="contact-grid-figure" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${esc(`${record.gene}'s domains with the residues within 5 Å of two antibodies, and a row per isoform showing which of those residues each isoform has`)}"><style>
.contact-grid-figure text { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; text-anchor: middle; }
.contact-grid-figure .title { font-size: 28px; font-weight: 650; fill: var(--text); text-anchor: start; }
.contact-grid-figure .subtitle { font-size: 18px; fill: var(--text-2); text-anchor: start; }
.contact-grid-figure .domain { font-size: 16px; font-weight: 600; fill: var(--text); }
.contact-grid-figure .binder { font-size: 20px; font-weight: 700; }
.contact-grid-figure .small { font-size: 15px; fill: var(--text-2); }
.contact-grid-figure .left { text-anchor: start; }
.contact-grid-figure .row { font-size: 19px; font-weight: 600; fill: var(--text); text-anchor: start; }
</style><text x="40" y="56" class="title">${esc(record.gene)} residues within 5 Å of two antibodies, isoform by isoform</text><text x="40" y="88" class="subtitle">From crystal structures ${esc(blocks.map(block => block.pdb).join(' and '))}, protein atoms only. Filled: present in that isoform. Open: missing.</text>${membrane}${backbone}${domains}${labels}${fans}${rows}</svg>`
}
