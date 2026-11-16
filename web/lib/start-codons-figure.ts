import type { GeneRecord } from '../../src/types.ts'
import { esc } from './html.ts'

export interface Mrna {
  refseq: string
  length: number
  start: number
  stop: number
  uorf: [number, number]
  polyA: number
}

const WIDTH = 1400
const HEIGHT = 570
const LEFT = 110
const RIGHT = 1250
const LINE = 270
const FIRST_BAR = 400
const BAR_STEP = 62
const TONES = ['interface', 'partner', 'caution']
const COUNTS = ['', 'one', 'two', 'three', 'four', 'five']

export function startCodons(
  record: GeneRecord,
  mrna: Mrna,
  names: Record<string, string>,
) {
  return [
    {
      name: names[record.canonical.accession] ?? record.canonical.name,
      accession: record.canonical.accession,
      first: 1,
      length: record.length,
    },
    ...record.isoforms
      .filter(
        i =>
          i.edits.length === 1 &&
          i.edits[0]?.start === 1 &&
          i.edits[0].added === 0,
      )
      .map(i => ({
        name: names[i.accession] ?? i.name,
        accession: i.accession,
        first: (i.edits[0]?.end ?? 0) + 1,
        length: i.length,
      })),
  ].map(form => ({ ...form, base: mrna.start + 3 * (form.first - 1) }))
}

function ribosome(x: number, tone: string, chain: number) {
  const beads = Array.from({ length: chain }, (_, k) => {
    const t = k / 3
    return `<circle cx="${x + 9 * Math.sin(t * 2.2)}" cy="${LINE - 46 - k * 11}" r="5.5" fill="var(--${tone})" />`
  }).join('')
  return `${beads}<ellipse cx="${x}" cy="${LINE - 17}" rx="24" ry="17" fill="var(--diagram-protein)" stroke="var(--text-2)" stroke-width="2" /><ellipse cx="${x}" cy="${LINE + 12}" rx="20" ry="10" fill="var(--diagram-protein)" stroke="var(--text-2)" stroke-width="2" />`
}

export function startCodonsFigure(
  record: GeneRecord,
  mrna: Mrna,
  names: Record<string, string>,
) {
  const forms = startCodons(record, mrna, names)
  const x = (base: number) =>
    LEFT + ((base - 1) / (mrna.length - 1)) * (RIGHT - LEFT)
  const residueX = (residue: number) => x(mrna.start + 3 * (residue - 1))
  const named = (pattern: RegExp) =>
    record.features.find(
      f => pattern.test(f.description) || pattern.test(f.type),
    )
  const bzip = named(/^bZIP$/)
  const tad = named(/9aaTAD/)
  const strand = `<line x1="${x(1)}" y1="${LINE}" x2="${x(mrna.polyA)}" y2="${LINE}" stroke="var(--text-2)" stroke-width="4" /><line x1="${x(mrna.start)}" y1="${LINE}" x2="${x(mrna.stop)}" y2="${LINE}" stroke="var(--text)" stroke-width="9" stroke-linecap="butt" /><circle cx="${x(1) - 16}" cy="${LINE}" r="14" fill="var(--text-2)" /><text x="${x(1) - 16}" y="${LINE + 46}" class="small">cap</text><text x="${x(mrna.polyA) + 8}" y="${LINE + 7}" class="tail">AAAAAA</text><path d="M${x(mrna.uorf[0])} ${LINE + 28} v8 H${x(mrna.uorf[1])} v-8" fill="none" stroke="var(--text-2)" stroke-width="2" /><text x="${x(mrna.start) - 10}" y="${LINE + 52}" class="small" style="text-anchor: end">uORF, ${(mrna.uorf[1] - mrna.uorf[0] + 1) / 3 - 1} codons</text><text x="${x(mrna.stop)}" y="${LINE + 46}" class="small">stop</text>`
  const chainLengths = [7, 5, 3]
  const ribosomes = forms
    .map((form, k) =>
      ribosome(x(form.base), TONES[k] ?? 'chain', chainLengths[k] ?? 3),
    )
    .join('')
  const flags = forms
    .map(
      (form, k) =>
        `<text x="${x(form.base)}" y="${LINE - 46 - (chainLengths[k] ?? 3) * 11 - 10}" class="flag" fill="var(--${TONES[k] ?? 'chain'})">${esc(form.name)}</text>`,
    )
    .join('')
  const bars = forms
    .map((form, k) => {
      const y = FIRST_BAR + k * BAR_STEP
      const tone = TONES[k] ?? 'chain'
      const domain = (feature: typeof bzip, label: string) =>
        feature && feature.start >= form.first
          ? `<rect x="${residueX(feature.start)}" y="${y - 13}" width="${Math.max(4, residueX(feature.end + 1) - residueX(feature.start))}" height="26" rx="4" fill="var(--text)" opacity="0.55" />${k === 0 ? `<text x="${(residueX(feature.start) + residueX(feature.end + 1)) / 2}" y="${FIRST_BAR - 22}" class="small">${esc(label)}</text>` : ''}`
          : ''
      return `<line x1="${x(form.base)}" y1="${LINE + 22}" x2="${x(form.base)}" y2="${y - 13}" stroke="var(--${tone})" stroke-width="1.5" stroke-dasharray="4 5" /><rect x="${x(form.base)}" y="${y - 10}" width="${x(mrna.stop) - x(form.base)}" height="20" rx="10" fill="var(--${tone})" />${domain(tad, '9aaTAD')}${domain(bzip, 'bZIP')}<text x="${x(mrna.stop) + 16}" y="${y + 6}" class="bar-label">${esc(form.name)}, ${form.length} residues from M${form.first}</text>`
    })
    .join('')
  return `<svg class="start-codons-figure" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${esc(`One ${record.gene} mRNA with ${forms.length} start codons, a ribosome on each, and the ${forms.length} proteins they make drawn to scale below`)}"><style>
.start-codons-figure text { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; text-anchor: middle; }
.start-codons-figure .title { font-size: 28px; font-weight: 650; fill: var(--text); text-anchor: start; }
.start-codons-figure .subtitle { font-size: 18px; fill: var(--text-2); text-anchor: start; }
.start-codons-figure .small { font-size: 16px; fill: var(--text-2); }
.start-codons-figure .tail { font-size: 18px; font-weight: 600; fill: var(--text-2); text-anchor: start; letter-spacing: 1px; }
.start-codons-figure .flag { font-size: 20px; font-weight: 700; }
.start-codons-figure .bar-label { font-size: 17px; fill: var(--text); text-anchor: start; }
</style><text x="40" y="56" class="title">One ${esc(record.gene)} mRNA, ${COUNTS[forms.length] ?? forms.length} start codons</text><text x="40" y="88" class="subtitle">RefSeq ${esc(mrna.refseq)}, ${mrna.length.toLocaleString()} bases, to scale; the proteins below are aligned codon by codon</text>${strand}${bars}${ribosomes}${flags}</svg>`
}
