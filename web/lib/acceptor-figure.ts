import type { GeneRecord } from '../../src/types.ts'
import { esc } from './html.ts'

export interface SequenceWindow {
  chromosome: string
  start: number
  end: number
  strand: 1 | -1
  sequence: string
}

const CODONS: Record<string, string> = Object.fromEntries(
  'TTTF TTCF TTAL TTGL CTTL CTCL CTAL CTGL ATTI ATCI ATAI ATGM GTTV GTCV GTAV GTGV TCTS TCCS TCAS TCGS CCTP CCCP CCAP CCGP ACTT ACCT ACAT ACGT GCTA GCCA GCAA GCGA TATY TACY TAA* TAG* CATH CACH CAAQ CAGQ AATN AACN AAAK AAGK GATD GACD GAAE GAGE TGTC TGCC TGA* TGGW CGTR CGCR CGAR CGGR AGTS AGCS AGAR AGGR GGTG GGCG GGAG GGGG'
    .split(' ')
    .map(entry => [entry.slice(0, 3), entry.slice(3)]),
)

const WIDTH = 1400
const HEIGHT = 530
const ROW = 300
const STEP = 12.6
const INTRON_SHOWN = 10

type Exon = [number, number]

function transcriptOrder(exons: Exon[], strand: number) {
  return exons.toSorted((a, b) => (strand < 0 ? b[0] - a[0] : a[0] - b[0]))
}

export function acceptors(record: GeneRecord, accession: string) {
  const canonical = record.structures[record.canonical.accession]
  const isoform = record.structures[accession]
  const strand = canonical?.strand ?? 1
  const five = ([low, high]: Exon) => (strand < 0 ? high : low)
  const three = ([low, high]: Exon) => (strand < 0 ? low : high)
  const ordered = transcriptOrder(canonical?.exons ?? [], strand)
  const index = ordered.findIndex(
    (exon, k) =>
      k > 0 &&
      (isoform?.exons ?? []).some(
        other => three(other) === three(exon) && five(other) !== five(exon),
      ),
  )
  const exon = ordered[index]
  const shifted = (isoform?.exons ?? []).find(
    other => exon && three(other) === three(exon),
  )
  const coding = canonical?.coding ?? [0, 0]
  const codingStart = strand < 0 ? coding[1] : coding[0]
  const before = ordered.slice(0, index).reduce((sum, [low, high]) => {
    const from =
      strand < 0 ? Math.min(high, codingStart) : Math.max(low, codingStart)
    const to = strand < 0 ? low : high
    return sum + Math.max(0, Math.abs(from - to) + 1)
  }, 0)
  const previous = ordered[index - 1]
  return exon && shifted && previous
    ? {
        strand,
        exonNumber: index + 1,
        canonical: five(exon),
        isoform: five(shifted),
        intron: Math.abs(three(previous) - five(exon)) - 1,
        codingBefore: before,
      }
    : undefined
}

export function acceptorFigure(
  record: GeneRecord,
  accession: string,
  window: SequenceWindow,
  helix: [number, number],
) {
  const sites = acceptors(record, accession)
  const isoform = record.isoforms.find(i => i.accession === accession)
  const edit = isoform?.edits[0]
  if (!sites || !edit) {
    throw new Error(`${record.gene} ${accession}: no shifted acceptor`)
  }
  const at = (coordinate: number) =>
    window.strand < 0 ? window.end - coordinate : coordinate - window.start
  const first = at(sites.canonical)
  const second = at(sites.isoform)
  const shownFrom = first - INTRON_SHOWN
  const letters = window.sequence.slice(shownFrom)
  const x0 = 215
  const xOf = (index: number) => x0 + (index - shownFrom) * STEP + STEP / 2
  const offset = (3 - (sites.codingBefore % 3)) % 3
  const firstResidue = Math.floor(sites.codingBefore / 3) + 1
  const codons = Array.from(
    { length: Math.floor((window.sequence.length - first - offset) / 3) },
    (_, k) => {
      const from = first + offset + 3 * k
      return {
        residue: firstResidue + (offset ? 1 : 0) + k,
        from,
        to: from + 3,
        amino: CODONS[window.sequence.slice(from, from + 3)] ?? '?',
      }
    },
  )
  const beads = [
    ...(offset
      ? [
          {
            residue: firstResidue,
            from: first,
            to: first + offset,
            amino: edit.start === firstResidue ? (edit.original[0] ?? '') : '',
          },
        ]
      : []),
    ...codons,
  ]
  const inEdit = beads.filter(
    b => b.residue >= edit.start && b.residue <= edit.end,
  )
  const translated = inEdit.map(b => b.amino).join('')
  if (translated !== edit.original) {
    throw new Error(
      `${record.gene}: translated ${translated}, UniProt has ${edit.original}`,
    )
  }
  const centre = (b: { from: number; to: number }) =>
    (xOf(b.from) + xOf(b.to - 1)) / 2
  const letterRow = letters
    .split('')
    .map((base, k) => {
      const index = shownFrom + k
      const intron = index < first
      return `<text x="${xOf(index)}" y="${ROW}" class="${intron ? 'intron' : 'exon'}">${intron ? base.toLowerCase() : base}</text>`
    })
    .join('')
  const ag = (acceptor: number, tone: string) =>
    `<rect x="${xOf(acceptor - 2) - STEP / 2 - 2}" y="${ROW - 22}" width="${2 * STEP + 4}" height="30" rx="6" fill="none" stroke="var(--${tone})" stroke-width="2.5" />`
  const exonBar = (from: number, y: number, tone: string) =>
    `<line x1="${xOf(from) - STEP / 2}" y1="${y}" x2="${xOf(window.sequence.length - 1) + STEP / 2}" y2="${y}" stroke="var(--${tone})" stroke-width="8" stroke-linecap="round" />`
  const arc = (to: number, y: number, peak: number, tone: string) =>
    `<path d="M150 ${ROW - 30} C 170 ${peak}, ${xOf(to) - STEP / 2 - 20} ${peak}, ${xOf(to) - STEP / 2} ${y}" fill="none" stroke="var(--${tone})" stroke-width="3" />`
  const arcLabel = (x: number, y: number, tone: string, label: string) =>
    `<text x="${x}" y="${y}" class="arc-label" fill="var(--${tone})">${esc(label)}</text>`
  const helixBeads = beads.filter(
    b => b.residue >= helix[0] && b.residue <= helix[1],
  )
  const helixFirst = helixBeads[0]
  const helixLast = helixBeads.at(-1)
  const helixBand =
    helixFirst && helixLast
      ? `<rect x="${centre(helixFirst) - 20}" y="${ROW + 52}" width="${centre(helixLast) - centre(helixFirst) + 40}" height="44" rx="22" fill="var(--surface-2)" stroke="var(--border)" stroke-width="2" /><text x="${centre(helixFirst)}" y="${ROW + 128}" class="note">transmembrane helix, residues ${helix[0]}–${helix[1]}</text>`
      : ''
  const brackets = beads
    .map(
      b =>
        `<path d="M${xOf(b.from) - STEP / 2 + 2} ${ROW + 12} v6 H${xOf(b.to - 1) + STEP / 2 - 2} v-6" fill="none" stroke="var(--border)" stroke-width="1.5" />`,
    )
    .join('')
  const beadMarks = beads
    .map(b => {
      const missing = b.residue >= edit.start && b.residue <= edit.end
      return `<circle cx="${centre(b)}" cy="${ROW + 74}" r="${STEP * 1.25}" fill="var(--${missing ? 'caution' : 'chain'})" /><text x="${centre(b)}" y="${ROW + 81}" class="amino${missing ? ' missing' : ''}">${esc(b.amino)}</text>`
    })
    .join('')
  const numbered = beads
    .filter(b => [edit.start, edit.end, edit.end + 1].includes(b.residue))
    .map(
      b =>
        `<text x="${centre(b)}" y="${ROW + 40}" class="number">${b.residue}</text>`,
    )
    .join('')
  const firstMissing = inEdit[0]
  const lastMissing = inEdit.at(-1)
  const absent =
    firstMissing && lastMissing
      ? `<path d="M${centre(firstMissing) - 16} ${ROW + 150} v10 H${centre(lastMissing) + 16} v-10" fill="none" stroke="var(--caution)" stroke-width="2.5" /><text x="${(centre(firstMissing) + centre(lastMissing)) / 2}" y="${ROW + 188}" class="absent">${second - first} bases, ${(second - first) / 3} codons: residues ${edit.start}–${edit.end}, absent from isoform ${esc(isoform?.name ?? '')}</text>`
      : ''
  const exon1 = `<rect x="40" y="${ROW - 30}" width="110" height="40" rx="6" fill="var(--diagram-protein)" stroke="var(--text-2)" stroke-width="1.5" /><text x="95" y="${ROW - 3}" class="exon-name">exon ${sites.exonNumber - 1}</text><line x1="150" y1="${ROW - 10}" x2="${x0 - 6}" y2="${ROW - 10}" stroke="var(--text-2)" stroke-width="2" stroke-dasharray="3 5" /><text x="${(150 + x0) / 2}" y="${ROW + 30}" class="note small">intron ${sites.exonNumber - 1}, ${sites.intron.toLocaleString()} bases</text>`
  return `<svg class="acceptor-figure" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${esc(`${record.gene} exon ${sites.exonNumber} with its two splice acceptors, ${second - first} bases apart, and the residues the bases between them encode`)}"><style>
.acceptor-figure text { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; text-anchor: middle; }
.acceptor-figure .intron { font-size: 19px; fill: var(--text-2); }
.acceptor-figure .exon { font-size: 19px; font-weight: 600; fill: var(--text); }
.acceptor-figure .amino { font-size: 17px; font-weight: 700; fill: var(--text); }
.acceptor-figure .amino.missing { fill: var(--chip-text); }
.acceptor-figure .number { font-size: 14px; fill: var(--text-2); }
.acceptor-figure .note, .acceptor-figure .absent, .acceptor-figure .arc-label, .acceptor-figure .exon-name, .acceptor-figure .title, .acceptor-figure .subtitle { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
.acceptor-figure .note { font-size: 18px; fill: var(--text-2); text-anchor: start; }
.acceptor-figure .note.small { font-size: 15px; text-anchor: middle; }
.acceptor-figure .absent { font-size: 19px; font-weight: 600; fill: var(--caution); }
.acceptor-figure .arc-label { font-size: 20px; font-weight: 650; text-anchor: start; }
.acceptor-figure .exon-name { font-size: 16px; font-weight: 600; fill: var(--text); }
.acceptor-figure .title { font-size: 28px; font-weight: 650; fill: var(--text); text-anchor: start; }
.acceptor-figure .subtitle { font-size: 18px; fill: var(--text-2); text-anchor: start; }
</style><text x="40" y="56" class="title">${esc(record.gene)} exon ${sites.exonNumber}: two splice acceptors</text><text x="40" y="88" class="subtitle">GRCh38 chr${esc(window.chromosome)}, read along the transcript${window.strand < 0 ? ' (minus strand)' : ''}</text>${arc(first, ROW - 38, ROW - 110, 'interface')}${arc(second, ROW - 52, ROW - 230, 'caution')}${arcLabel(xOf(first) + 10, ROW - 52, 'interface', 'canonical')}${arcLabel((xOf(first) + xOf(second)) / 2, ROW - 190, 'caution', `isoform ${isoform?.name ?? ''}`)}${exonBar(first, ROW - 38, 'interface')}${exonBar(second, ROW - 52, 'caution')}${exon1}${ag(first, 'interface')}${ag(second, 'caution')}${letterRow}${brackets}${numbered}${helixBand}${beadMarks}${absent}</svg>`
}
