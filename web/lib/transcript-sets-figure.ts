import type { GeneTranscript } from '../../src/gene-transcripts.ts'
import type { GeneRecord } from '../../src/types.ts'
import { esc } from './html.ts'

const WIDTH = 1400
const HEIGHT = 800
const LEFT = 560
const RIGHT = 1300
const ROW = 58
const UTR = 14
const CODING = 28

function sentenceCase(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function unversioned(id: string) {
  return id.replace(/\.\d+$/, '')
}

/**
 * The canonical's exons with its second one left out, for drawing the mRNA
 * Sotillo et al. report; its coding span is kept only when the skipped exon is
 * a whole number of codons.
 */
export function skipping(canonical: GeneTranscript, exon: number) {
  const skipped = canonical.exons[exon - 1]
  const inFrame = skipped ? (skipped[1] - skipped[0] + 1) % 3 === 0 : false
  return {
    exons: canonical.exons.filter((_, i) => i !== exon - 1),
    cds: inFrame ? canonical.cds : null,
    skipped,
    inFrame,
  }
}

export function transcriptSetsFigure(
  record: GeneRecord,
  transcripts: GeneTranscript[],
  exon: number,
) {
  const forms = [
    {
      name: `${record.canonical.name} (canonical)`,
      transcripts: record.canonical.transcripts,
    },
    ...record.isoforms.map(i => ({ name: i.name, transcripts: i.transcripts })),
  ]
  const mapped = new Map(
    forms.flatMap(form =>
      form.transcripts.ensembl.map((id): [string, (typeof forms)[number]] => [
        unversioned(id),
        form,
      ]),
    ),
  )
  const coding = transcripts.filter(
    t =>
      t.type === 'protein_coding' &&
      !t.tags.includes('cds_start_NF') &&
      !t.tags.includes('cds_end_NF'),
  )
  const others = transcripts.filter(t => !coding.includes(t))
  const canonical = coding.find(t => t.tags.includes('MANE_Select'))
  const skip = canonical ? skipping(canonical, exon) : null
  const starts = transcripts.flatMap(t => t.exons.map(([s]) => s))
  const ends = transcripts.flatMap(t => t.exons.map(([, e]) => e))
  const [low, high] = [Math.min(...starts), Math.max(...ends)]
  const x = (position: number) =>
    LEFT + ((position - low) / (high - low)) * (RIGHT - LEFT)
  const highlight = skip?.skipped
  const cuts = (s: number, e: number): [number, number, boolean][] =>
    highlight && s <= highlight[1] && e >= highlight[0]
      ? [
          [s, highlight[0] - 1, false],
          [Math.max(s, highlight[0]), Math.min(e, highlight[1]), true],
          [highlight[1] + 1, e, false],
        ]
      : [[s, e, false]]
  const glyph = (
    exons: [number, number][],
    cds: [number, number] | null,
    y: number,
    hollow: boolean,
  ) => {
    const intron = `<line x1="${x(exons[0]?.[0] ?? low)}" y1="${y}" x2="${x(exons.at(-1)?.[1] ?? low)}" y2="${y}" stroke="var(--text-2)" stroke-width="2" />`
    const parts = (a: number, b: number): [number, number, number][] =>
      cds
        ? [
            [a, Math.min(b, cds[0] - 1), UTR],
            [Math.max(a, cds[0]), Math.min(b, cds[1]), CODING],
            [Math.max(a, cds[1] + 1), b, UTR],
          ]
        : [[a, b, UTR]]
    const boxes = exons
      .flatMap(([s, e]) =>
        cuts(s, e).flatMap(([a, b, marked]) =>
          parts(a, b)
            .filter(([from, to]) => to >= from)
            .map(([from, to, h]) => {
              const tone = marked ? 'var(--caution)' : 'var(--text-2)'
              return `<rect x="${x(from)}" y="${y - h / 2}" width="${Math.max(2, x(to + 1) - x(from))}" height="${h}" fill="${hollow ? 'var(--surface)' : tone}" stroke="${tone}" stroke-width="${hollow ? 2 : 0}" />`
            }),
        ),
      )
      .join('')
    return `${intron}${boxes}`
  }
  const label = (title: string, detail: string, y: number) =>
    `<text x="96" y="${y - 2}" class="name">${esc(title)}</text><text x="96" y="${y + 20}" class="small">${esc(detail)}</text>`
  const row = (t: GeneTranscript, y: number) => {
    const form = mapped.get(unversioned(t.id))
    const detail = [
      unversioned(t.id),
      form ? `isoform ${form.name}` : t.type.replace(/_/g, ' '),
      ...(t.tags.includes('MANE_Select') ? ['MANE Select'] : []),
    ].join(' · ')
    return `${label(t.name, detail, y)}${glyph(t.exons, t.cds, y, false)}`
  }
  const codingTop = 168
  const codingBottom = codingTop + 66 + coding.length * ROW
  const otherTop = codingBottom + 26
  const otherBottom = otherTop + 60 + others.length * ROW
  const frameBottom = otherBottom + 22
  const skipTop = frameBottom + 34
  const skipY = skipTop + 84
  const arc =
    skip && canonical && highlight
      ? (() => {
          const before = canonical.exons[exon - 2]
          const after = canonical.exons[exon]
          return before && after
            ? `<path d="M${x(before[1])} ${skipY - CODING / 2} Q ${(x(before[1]) + x(after[0])) / 2} ${skipY - 56} ${x(after[0])} ${skipY - CODING / 2}" fill="none" stroke="var(--caution)" stroke-width="2.5" /><text x="${(x(highlight[0]) + x(highlight[1])) / 2}" y="${skipY - 60}" class="small mid">exon ${exon} skipped</text>`
            : ''
        })()
      : ''
  const sets = `<rect x="40" y="110" width="${WIDTH - 70}" height="${frameBottom - 110}" rx="28" fill="none" stroke="var(--text-2)" stroke-width="2" /><text x="64" y="146" class="set">GENCODE 49: ${transcripts.length} transcripts of ${esc(record.gene)}</text><rect x="66" y="${codingTop}" width="${WIDTH - 122}" height="${codingBottom - codingTop}" rx="22" fill="var(--interface)" fill-opacity="0.08" stroke="var(--interface)" stroke-width="2.5" /><rect x="72" y="${codingTop + 6}" width="${WIDTH - 134}" height="${codingBottom - codingTop - 12}" rx="18" fill="none" stroke="var(--partner)" stroke-width="2.5" stroke-dasharray="10 6" /><text x="96" y="${codingTop + 36}" class="subset"><tspan fill="var(--interface)">Complete protein-coding: ${coding.length}</tspan><tspan fill="var(--text-2)"> = </tspan><tspan fill="var(--partner)">UniProt ${esc(record.accession)}'s ${record.isoforms.length + 1} isoforms</tspan></text><rect x="66" y="${otherTop}" width="${WIDTH - 122}" height="${otherBottom - otherTop}" rx="22" fill="var(--chain)" fill-opacity="0.15" stroke="var(--chain)" stroke-width="2" /><text x="96" y="${otherTop + 36}" class="subset" fill="var(--text-2)">${esc(sentenceCase([...new Set(others.map(t => t.type.replace(/_/g, ' ')))].join(', ')))}: ${others.length}</text>`
  const rows = [
    ...coding.map((t, i) => row(t, codingTop + 78 + i * ROW)),
    ...others.map((t, i) => row(t, otherTop + 78 + i * ROW)),
  ].join('')
  const outside =
    skip && canonical
      ? `<rect x="40" y="${skipTop}" width="${WIDTH - 70}" height="${HEIGHT - 20 - skipTop}" rx="28" fill="none" stroke="var(--caution)" stroke-width="2" stroke-dasharray="10 7" /><text x="64" y="${skipTop + 34}" class="set" fill="var(--caution)">Listed in neither</text>${label(`${record.gene} without exon ${exon}`, 'reported in B-ALL, Sotillo et al. 2015', skipY)}${glyph(skip.exons, skip.cds, skipY, true)}${arc}`
      : ''
  return `<svg class="transcript-sets-figure" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${esc(`${record.gene} transcripts drawn from their exons: the ${transcripts.length} GENCODE 49 lists, of which the ${coding.length} complete coding ones are UniProt's isoforms, and an mRNA lacking exon ${exon} that neither lists`)}"><style>
.transcript-sets-figure text { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
.transcript-sets-figure .title { font-size: 28px; font-weight: 650; fill: var(--text); }
.transcript-sets-figure .subtitle { font-size: 18px; fill: var(--text-2); }
.transcript-sets-figure .set { font-size: 21px; font-weight: 700; fill: var(--text); }
.transcript-sets-figure .subset { font-size: 18px; font-weight: 650; }
.transcript-sets-figure .name { font-size: 17px; font-weight: 600; fill: var(--text); }
.transcript-sets-figure .small { font-size: 14px; fill: var(--text-2); }
.transcript-sets-figure .mid { text-anchor: middle; fill: var(--caution); font-weight: 600; }
</style><text x="40" y="52" class="title">${esc(record.gene)} transcripts in GENCODE and UniProt, and one in neither</text><text x="40" y="84" class="subtitle">Each drawn from its exons on ${esc(record.locus?.split(':')[0] ?? '')}, to scale; coding exons taller, exon ${exon} in orange</text>${sets}${rows}${outside}</svg>`
}
