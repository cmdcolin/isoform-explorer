import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { GeneRecord } from '../../src/types.ts'
import type { Binder } from './contact-grid-figure.ts'
import {
  ABUT,
  contactStates,
  isoformLabel,
  lacksText,
  sharedContacts,
} from './epitope.ts'
import type { Structure } from './epitope.ts'
import { esc } from './html.ts'
import { span } from './loss.ts'

export const CD22_BINDERS: Binder[] = [
  { pdb: '5VL3', name: 'epratuzumab', tone: 'interface' },
  { pdb: '7O52', name: 'm971', tone: 'partner' },
]

export function cd22Structures() {
  const structures: Structure[] = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'web',
        'content',
        'blog',
        'data',
        'cd22-contacts.json',
      ),
      'utf8',
    ),
  )
  return structures
}

export function cd22Contacts(pdb: string) {
  const structure = cd22Structures().find(s => s.pdb === pdb)
  return structure
    ? { ...structure, ...sharedContacts(structure.copies) }
    : missingStructure(pdb)
}

function missingStructure(pdb: string): never {
  throw new Error(`${pdb} is not in cd22-contacts.json; rerun src/epitopes.ts`)
}

export function contactTable(record: GeneRecord) {
  const blocks = CD22_BINDERS.map(binder => ({
    ...binder,
    ...cd22Contacts(binder.pdb),
  }))
  const cell = (
    block: (typeof blocks)[number],
    isoform: GeneRecord['isoforms'][number],
  ) => {
    const states = contactStates(block.contacts, block.observed, isoform)
    const notes = [
      ...(states.abutting.length > 0
        ? [
            `${states.abutting.length} of those within ${ABUT} residues of a missing stretch`,
          ]
        : []),
      ...(states.where === 'outside'
        ? [
            `differs from the canonical only outside the structure (residues ${span(...states.span)})`,
          ]
        : []),
    ]
    return `<td>${states.present} of ${states.total}${notes.length > 0 ? `<br><span class="muted">${esc(notes.join('; '))}</span>` : ''}</td>`
  }
  const rows = record.isoforms
    .map(
      isoform =>
        `<tr><td>${esc(isoformLabel(isoform))}<br><span class="muted">${esc(lacksText(isoform))}</span></td>${blocks.map(block => cell(block, isoform)).join('')}</tr>`,
    )
    .join('')
  return `<div class="table-wrap"><table class="share-table"><caption>Contact residues present in each ${esc(record.gene)} isoform</caption><thead><tr><th>Isoform</th>${blocks.map(block => `<th>${esc(block.name)} (${esc(block.pdb)})</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`
}
