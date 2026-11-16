import { spawnSync } from 'node:child_process'

type Kind = 'step' | 'file' | 'viewer'

interface Node {
  id: string
  kind: Kind
  title: string
  source?: string
  lines?: string[]
}

interface Edge {
  from: string
  to: string
  label?: string
}

interface Numbers {
  proteins: number
  isoforms: number
  ipsae: number
  contact: number
}

export const COLUMNS = ['Fetch', 'Combine', 'Published files', 'In the browser']

export function nodes({ proteins, isoforms, ipsae, contact }: Numbers): Node[] {
  return [
    {
      id: 'uniprot',
      kind: 'step',
      source: 'UniProt',
      title: 'Rebuild isoforms',
      lines: [`${proteins.toLocaleString()} proteins`, `${isoforms.toLocaleString()} alternative isoforms`],
    },
    {
      id: 'complexes',
      kind: 'step',
      source: 'AlphaFold DB complexes',
      title: 'Predicted interfaces',
      lines: [`ipSAE ≥ ${ipsae}, ≤ ${contact} Å`],
    },
    {
      id: 'monomers',
      kind: 'step',
      source: 'AlphaFold DB monomers',
      title: 'Model confidence',
      lines: ['pLDDT per residue'],
    },
    {
      id: 'transcripts',
      kind: 'step',
      source: 'Ensembl REST API',
      title: 'Transcript places',
      lines: ['GRCh38'],
    },
    {
      id: 'exons',
      kind: 'step',
      source: 'GENCODE 49',
      title: 'Transcript exons',
      lines: ['every isoform, coding sequence'],
    },

    { id: 'out', kind: 'file', title: 'out/', lines: ['interface residues'] },
    {
      id: 'compare',
      kind: 'step',
      title: 'Compare with canonical',
      lines: ['missing, replaced, novel', 'features, pLDDT, interfaces'],
    },

    {
      id: 'data',
      kind: 'file',
      title: 'Site data',
      lines: ['one JSON per protein', 'totals, search maps'],
    },
    {
      id: 'jbConfig',
      kind: 'file',
      title: 'JBrowse config',
      lines: ['GENCODE, RefSeq tracks'],
    },

    {
      id: 'astro',
      kind: 'viewer',
      title: 'Astro site',
      lines: ['gene, browse, search'],
    },
    {
      id: 'jbrowse',
      kind: 'viewer',
      title: 'JBrowse 2',
      lines: ['transcripts on hg38', 'models superposed'],
    },
  ]
}

const toCompare = ['uniprot', 'out', 'monomers', 'transcripts', 'exons']

export const edges: Edge[] = [
  { from: 'complexes', to: 'out' },
  ...toCompare.map(from => ({ from, to: 'compare' })),
  { from: 'compare', to: 'data' },
  { from: 'data', to: 'astro' },
  { from: 'jbConfig', to: 'jbrowse' },
  { from: 'astro', to: 'jbrowse', label: 'links' },
]

export const columns = [
  ['uniprot', 'complexes', 'monomers', 'transcripts', 'exons'],
  ['out', 'compare'],
  ['data', 'jbConfig'],
  ['astro', 'jbrowse'],
]

function quote(text: string) {
  return text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function escapeHtml(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
}

function label(node: Node) {
  return [
    ...(node.source ? [`<font color="gray40" point-size="14">${escapeHtml(node.source)}</font>`] : []),
    `<b>${escapeHtml(node.title)}</b>`,
    ...(node.lines ?? []).map(escapeHtml),
  ].join('<br/>')
}

const FETCH_STAGE = { fill: '#dbe9f8', area: '#eef4fb', line: '#4a7fb5' }

const STAGES = [
  FETCH_STAGE,
  { fill: '#f8e5bf', area: '#fbf3e4', line: '#b8832b' },
  { fill: '#e4d9f5', area: '#f3eefb', line: '#7a5aa6' },
  { fill: '#cdebdd', area: '#e9f6f0', line: '#3f9b78' },
]

function nodeAttributes(node: Node, stage: (typeof STAGES)[number]) {
  return `${node.kind === 'file' ? 'shape=folder ' : ''}style=filled fillcolor="${stage.fill}" color="${stage.line}"`
}

function cluster(ids: string[], index: number, all: Node[]) {
  const stage = STAGES[index] ?? FETCH_STAGE
  const members = all.filter(node => ids.includes(node.id)).toReversed()
  return `subgraph cluster_${index} {
    label="${quote(COLUMNS[index] ?? '')}"
    margin=12 style="rounded,filled" fillcolor="${stage.area}" color="${stage.line}"
    ${members.map(node => `${node.id} [label=<${label(node)}> ${nodeAttributes(node, stage)}];`).join('\n    ')}
  }`
}

function edgeAttributes(edge: Edge) {
  return ['color="gray40"', 'fontcolor="gray40"', edge.label ? `label="${quote(edge.label)}"` : ''].join(' ')
}

export function architectureDot(numbers: Numbers) {
  const all = nodes(numbers)
  return `digraph architecture {
  rankdir=LR
  bgcolor=white
  nodesep=0.12
  ranksep=0.35
  graph [fontname="Helvetica" fontsize=18]
  node [shape=box fontname="Helvetica" fontsize=18 penwidth=1.3]
  edge [fontname="Helvetica" fontsize=15 arrowsize=0.7]
  ${columns.map((ids, index) => cluster(ids, index, all)).join('\n  ')}
  ${edges.map(edge => `${edge.from} -> ${edge.to} [${edgeAttributes(edge)}];`).join('\n  ')}
}`
}

function bareSvg(svg: string) {
  return svg.slice(svg.indexOf('<svg')).replace(/<title>[\s\S]*?<\/title>/g, '')
}

function fail(message: string): never {
  throw new Error(message)
}

function renderDot(source: string) {
  const result = spawnSync('dot', ['-Tsvg'], { input: source, encoding: 'utf8' })
  const missing = result.error !== undefined && 'code' in result.error && result.error.code === 'ENOENT'
  return missing
    ? fail('Graphviz `dot` is not installed; install graphviz to build the site')
    : result.status === 0
      ? result.stdout
      : fail(`dot failed: ${result.stderr}`)
}

export function architectureSvg(numbers: Numbers) {
  return bareSvg(renderDot(architectureDot(numbers)))
}
