import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { GeneTranscript } from '../../src/gene-transcripts.ts'

export function cd19Transcripts() {
  const data: { gene: string; release: string; transcripts: GeneTranscript[] } =
    JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'web',
          'content',
          'blog',
          'data',
          'cd19-transcripts.json',
        ),
        'utf8',
      ),
    )
  return data
}
