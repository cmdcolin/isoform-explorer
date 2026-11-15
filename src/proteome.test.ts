import { describe, expect, it } from 'vitest'

import { cifPlddt, headerOf, tarMembers } from './proteome.ts'

function header(name: string, size: number) {
  const block = new Uint8Array(512)
  block.set(new TextEncoder().encode(name), 0)
  block.set(
    new TextEncoder().encode(`${size.toString(8).padStart(11, '0')}\0`),
    124,
  )
  return block
}

function padded(data: Uint8Array) {
  const block = new Uint8Array(Math.ceil(data.length / 512) * 512)
  block.set(data)
  return block
}

function tar(members: [string, string][]) {
  return Buffer.concat([
    ...members.flatMap(([name, content]) => {
      const data = new TextEncoder().encode(content)
      return [header(name, data.length), padded(data)]
    }),
    new Uint8Array(1024),
  ])
}

async function* inPieces(data: Uint8Array, size: number) {
  for (let i = 0; i < data.length; i += size) {
    yield data.subarray(i, i + size)
  }
}

describe('tarMembers', () => {
  it('reads a header name and octal size', () => {
    expect(headerOf(header('a.txt', 600))).toEqual({
      name: 'a.txt',
      size: 600,
      end: false,
    })
  })

  it('yields only wanted members, across any chunking', async () => {
    const archive = tar([
      ['skip.pdb.gz', 'x'.repeat(700)],
      ['keep.cif.gz', 'kept'],
      ['also.cif.gz', 'y'.repeat(1030)],
    ])
    for (const size of [1, 100, 512, 4096]) {
      const found: [string, number][] = []
      for await (const member of tarMembers(inPieces(archive, size), name =>
        name.endsWith('.cif.gz'),
      )) {
        found.push([member.name, member.data.length])
      }
      expect(found).toEqual([
        ['keep.cif.gz', 4],
        ['also.cif.gz', 1030],
      ])
    }
  })
})

describe('cifPlddt', () => {
  it('reads per-residue pLDDT in residue order', () => {
    const cif = [
      'loop_',
      '_ma_qa_metric_local.label_asym_id',
      '_ma_qa_metric_local.label_comp_id',
      '_ma_qa_metric_local.label_seq_id',
      '_ma_qa_metric_local.metric_id',
      '_ma_qa_metric_local.metric_value',
      '_ma_qa_metric_local.model_id',
      '_ma_qa_metric_local.ordinal_id',
      'A MET 1  2 57.69 1 1  ',
      'A SER 3  2 91.10 1 3  ',
      'A SER 2  2 55.72 1 2  ',
      '#',
      '_other.item 1',
    ].join('\n')
    expect(cifPlddt(cif)).toEqual([57.69, 55.72, 91.1])
  })

  it('finds nothing without the metric table', () => {
    expect(cifPlddt('data_x\n#\n')).toEqual([])
  })
})
