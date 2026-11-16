import { esc } from './html.ts'

export interface TissueShare {
  tissue: string
  label?: string
  isoformReads: number
  canonicalReads: number
  tpmShare: number | null
}

export interface SharePanel {
  title: string
  subtitle: string
  tissues: TissueShare[]
}

const WIDTH = 1400
const PANEL = 700
const LABEL = 260
const PLOT = 380
const ROW = 40
const TOP = 190

export function junctionShare({ isoformReads, canonicalReads }: TissueShare) {
  const reads = isoformReads + canonicalReads
  return reads > 0 ? isoformReads / reads : null
}

export function percent(share: number) {
  return share === 0
    ? '0%'
    : share < 0.0001
      ? '<0.01%'
      : `${(100 * share).toFixed(share < 0.01 ? 2 : 0)}%`
}

function x(share: number) {
  return LABEL + share * PLOT
}

function diamond(cx: number, cy: number, r: number) {
  return `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`
}

function panel({ title, subtitle, tissues }: SharePanel) {
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const bottom = TOP + tissues.length * ROW
  const grid = ticks
    .map(
      t =>
        `<line x1="${x(t)}" y1="${TOP - 10}" x2="${x(t)}" y2="${bottom}" stroke="var(--border)" stroke-width="1" /><text x="${x(t)}" y="${bottom + 26}" text-anchor="middle" font-size="16" fill="var(--text-2)">${t * 100}%</text>`,
    )
    .join('')
  const rows = tissues
    .map((t, index) => {
      const y = TOP + index * ROW + ROW / 2
      const junction = junctionShare(t)
      const tip = `${t.tissue}: junction reads ${junction === null ? 'none' : `${percent(junction)} (${t.isoformReads.toLocaleString()} of ${(t.isoformReads + t.canonicalReads).toLocaleString()})`}; transcript TPM ${t.tpmShare === null ? 'not in GTEx' : percent(t.tpmShare)}`
      return `<g><title>${esc(tip)}</title><rect x="0" y="${y - ROW / 2}" width="${PANEL}" height="${ROW}" fill="transparent" /><text x="${LABEL - 16}" y="${y + 6}" text-anchor="end" font-size="18" fill="var(--text)">${esc(t.label ?? t.tissue)}</text>${
        t.tpmShare !== null
          ? `<path d="${diamond(x(t.tpmShare), y + 7, 9)}" fill="var(--caution)" stroke="var(--surface)" stroke-width="2" />`
          : ''
      }${
        junction !== null
          ? `<circle cx="${x(junction)}" cy="${y - 7}" r="7" fill="var(--interface)" stroke="var(--surface)" stroke-width="2" />`
          : ''
      }</g>`
    })
    .join('')
  return `<text x="20" y="${TOP - 96}" font-size="24" font-weight="650" fill="var(--text)">${esc(title)}</text><text x="20" y="${TOP - 66}" font-size="18" fill="var(--text-2)">${esc(subtitle)}</text>${grid}${rows}`
}

export function shareChart(panels: [SharePanel, SharePanel]) {
  const rows = Math.max(...panels.map(p => p.tissues.length))
  const height = TOP + rows * ROW + 60
  return `<svg class="share-chart" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${esc(`Share of each gene's GTEx reads assigned to an isoform, by tissue, measured two ways: ${panels.map(p => p.title).join(' and ')}`)}"><g font-size="18" fill="var(--text)"><circle cx="30" cy="32" r="7" fill="var(--interface)" stroke="var(--surface)" stroke-width="2" /><text x="46" y="38">reads at the shared splice site that use the isoform’s junction</text><path d="${diamond(700, 32, 9)}" fill="var(--caution)" stroke="var(--surface)" stroke-width="2" /><text x="716" y="38">the isoform’s share of the gene’s median transcript TPM</text></g>${panels
    .map(
      (p, index) =>
        `<g transform="translate(${index * PANEL} 0)">${panel(p)}</g>`,
    )
    .join(
      '',
    )}<line x1="${PANEL}" y1="${TOP - 20}" x2="${PANEL}" y2="${height - 10}" stroke="var(--border)" stroke-width="2" /></svg>`
}
