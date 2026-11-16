import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Junctions } from '../../src/expression.ts'
import { esc } from './html.ts'
import { type TissueShare, junctionShare, percent } from './share-chart.ts'

export interface ExpressionCase {
  page: string
  gene: string
  isoform: string
  junctions: Junctions
  transcriptsInGtex: string[]
  isoformReads: number
  canonicalReads: number
  isoformSamples: number
  samples: number
  tissues: (TissueShare & { samples: number; isoformSamples: number })[]
}

interface Expression {
  fetched: string
  sources: Record<string, string>
  cases: ExpressionCase[]
}

const expression: Expression = JSON.parse(
  readFileSync(
    join(process.cwd(), 'web', 'content', 'blog', 'data', 'expression.json'),
    'utf8',
  ),
)

export const FETCHED = expression.fetched

export function expressionOf(isoform: string) {
  const found = expression.cases.find(c => c.isoform === isoform)
  if (!found) {
    throw new Error(
      `no expression data for ${isoform}; add it to CASES in src/expression.ts`,
    )
  }
  return found
}

export function tissuesNamed(c: ExpressionCase, names: string[]) {
  return names.flatMap(name => c.tissues.filter(t => t.tissue === name))
}

export function share(
  c: Pick<ExpressionCase, 'isoformReads' | 'canonicalReads'>,
) {
  return percent(c.isoformReads / (c.isoformReads + c.canonicalReads))
}

export function tissueShare(c: ExpressionCase, name: string) {
  const tissue = c.tissues.find(t => t.tissue === name)
  const value = tissue ? junctionShare(tissue) : null
  return value === null ? 'no reads' : percent(value)
}

export function shareTable(c: ExpressionCase, names: Map<string, string>) {
  const rows = tissuesNamed(c, [...names.keys()])
    .map(t => {
      const value = junctionShare(t)
      return `<tr><td>${esc(names.get(t.tissue) ?? t.tissue)}</td><td>${t.isoformReads.toLocaleString()}</td><td>${t.canonicalReads.toLocaleString()}</td><td>${value === null ? '–' : percent(value)}</td><td>${t.tpmShare === null ? '–' : percent(t.tpmShare)}</td></tr>`
    })
    .join('')
  return `<div class="table-wrap"><table class="share-table"><caption>${esc(c.gene)} ${esc(c.isoform)} in GTEx v8, by tissue</caption><thead><tr><th>Tissue</th><th>Isoform junction reads</th><th>Canonical junction reads</th><th>Junction share</th><th>TPM share</th></tr></thead><tbody>${rows}</tbody></table></div>`
}
