import { existsSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

import { getJson } from './cache.ts'
import {
  hasAlternative,
  modelsIn,
  monomerPath,
  plddtPath,
  roundedScores,
} from './isoforms.ts'
import { readJson, record } from './json.ts'
import { applyEdits, editsByIsoform } from './sequences.ts'
import { accessionOf, isoformEntries, sequenceOf } from './uniprot.ts'
import type { UniProtEntry } from './uniprot.ts'

const PAUSE = 20_000
const AFTER_FAILURE = 300_000
const FAILURES_TO_STOP = 3

function pendingModels(entry: UniProtEntry) {
  const accession = accessionOf(entry)
  const sequence = sequenceOf(entry)
  const path = monomerPath(accession)
  const models = modelsIn(existsSync(path) ? readJson(path) : null)
  const wanted: [string, string][] = [
    [accession, sequence],
    ...[...editsByIsoform(entry)]
      .filter(([, info]) => !info.displayed)
      .map(([isoform, info]): [string, string] => [
        isoform,
        applyEdits(sequence, info.edits).sequence,
      ]),
  ]
  return wanted.flatMap(([id, built]) => {
    const model = models.get(id)
    return model &&
      model.sequence === built &&
      !existsSync(plddtPath(model.entryId))
      ? [model]
      : []
  })
}

async function main() {
  const pending = (await isoformEntries())
    .filter(hasAlternative)
    .flatMap(pendingModels)
  console.log(`${pending.length} models without cached pLDDT`)
  let failures = 0
  let fetched = 0
  for (const model of pending) {
    if (failures < FAILURES_TO_STOP) {
      const ok = await getJson(
        model.plddtDocUrl,
        plddtPath(model.entryId),
        {},
        doc => roundedScores(record(doc).confidenceScore),
        1,
      ).then(
        () => true,
        (error: unknown) => {
          console.log(`${model.entryId}: ${error}`)
          return false
        },
      )
      failures = ok ? 0 : failures + 1
      fetched += ok ? 1 : 0
      await sleep(ok ? PAUSE : AFTER_FAILURE)
    }
  }
  console.log(
    failures >= FAILURES_TO_STOP
      ? `stopped after ${FAILURES_TO_STOP} failures in a row; ${fetched} fetched, rerun later`
      : `${fetched} fetched`,
  )
}

if (import.meta.main) {
  await main()
}
