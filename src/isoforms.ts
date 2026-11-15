import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { getJson } from './cache.ts'
import {
  list,
  number,
  readJson,
  record,
  records,
  text,
  writeJson,
} from './json.ts'
import { locusOf, transcriptPlaces } from './ensembl.ts'
import type { Place } from './ensembl.ts'
import { explorerPages } from './explorer.ts'
import { pythonRound } from './numeric.ts'
import { DATA, OUT, SITE_DATA } from './paths.ts'
import {
  applyEdits,
  compareEdits,
  compareText,
  editsByIsoform,
  ensemblByIsoform,
  maneIsoform,
  maneTranscripts,
  refseqByIsoform,
  refseqProteinsByIsoform,
  ensemblGenes,
  replacedPositions,
  unversioned,
} from './sequences.ts'
import type { Edit as SequenceEdit, IsoformEdits } from './sequences.ts'
import { EDIT_PREVIEW, FEATURE_GROUPS, SEARCH } from './types.ts'
import type {
  Example,
  Feature,
  FeatureGroup,
  FeatureLoss,
  GeneRecord,
  IndexRow,
  InterfaceLoss,
  Isoform,
  Lookup,
  Model,
  Totals,
  Transcripts,
} from './types.ts'
import {
  BONDS,
  accessionOf,
  diseaseAccessions,
  eventsOf,
  featuresOf,
  geneOf,
  isoformEntries,
  notesByMolecule,
  proteinOf,
  sequenceOf,
} from './uniprot.ts'
import type { UniProtEntry } from './uniprot.ts'

export const FOLDED_PLDDT = 70
export const UNFOLDED_PLDDT = 50
export const INTERFACE_LOST_SHARE = 0.5
export const SWAP_SHARE = 0.5
const BANDS = [90, FOLDED_PLDDT, UNFOLDED_PLDDT, 0]
const MOST = 0.5

type Fate = 'kept' | 'missing' | 'replaced'

interface AlphaFoldModel {
  entryId: string
  cifUrl: string
  plddtDocUrl: string
  uniprotAccession: string
  sequence: string
}

export function segments(canonicalPositions: (number | null)[]) {
  const runs: [number, number, number][] = []
  canonicalPositions.forEach((position, index) => {
    const last = runs.at(-1)
    if (
      position !== null &&
      last &&
      last[1] + last[2] === position &&
      last[0] + last[2] === index + 1
    ) {
      last[2] += 1
    } else if (position !== null) {
      runs.push([index + 1, position, 1])
    }
  })
  return runs
}

export function bandRuns(scores: number[]) {
  const runs: [number, number][] = []
  for (const score of scores) {
    const band = BANDS.find(b => score >= b) ?? 0
    const last = runs.at(-1)
    if (last && last[0] === band) {
      last[1] += 1
    } else {
      runs.push([band, 1])
    }
  }
  return runs
}

export async function inPool<T, R>(
  items: T[],
  workers: number,
  work: (item: T) => Promise<R>,
) {
  const results: R[] = []
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      const item = items[index]
      if (item !== undefined) {
        results[index] = await work(item)
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, worker))
  return results
}

export function mergedEdits(edits: SequenceEdit[]) {
  const merged: SequenceEdit[] = []
  for (const [start, end, replacement] of [...edits].sort(compareEdits)) {
    const last = merged.at(-1)
    if (last && start <= last[1] + 1) {
      merged[merged.length - 1] = [
        last[0],
        Math.max(last[1], end),
        last[2] + replacement,
      ]
    } else {
      merged.push([start, end, replacement])
    }
  }
  return merged
}

export function fates(sequence: string, edits: SequenceEdit[]) {
  const fate: Fate[] = Array.from(sequence, () => 'kept')
  for (const [start, end, replacement] of mergedEdits(edits)) {
    const positions = replacedPositions(sequence, start, end, replacement)
    const carried = new Set(positions)
    const added = positions.filter(position => position === null).length
    const removed = end - start + 1 - (positions.length - added)
    const lost = added >= SWAP_SHARE * removed ? 'replaced' : 'missing'
    for (let position = start; position <= end; position += 1) {
      if (!carried.has(position)) {
        fate[position - 1] = lost
      }
    }
  }
  return fate
}

function count(fate: Fate[], positions: number[], wanted: Fate) {
  return positions.filter(p => fate[p - 1] === wanted).length
}

export function featurePositions(feature: Feature) {
  return BONDS.includes(feature.type)
    ? [...new Set([feature.start, feature.end])]
    : Array.from(
        { length: feature.end - feature.start + 1 },
        (_, k) => feature.start + k,
      )
}

export function featureLosses(features: Feature[], fate: Fate[]) {
  return features.flatMap((feature, index): FeatureLoss[] => {
    const positions = featurePositions(feature)
    const missing = count(fate, positions, 'missing')
    const replaced = count(fate, positions, 'replaced')
    return missing + replaced > 0 ? [[index, missing, replaced]] : []
  })
}

export function lacksInFull(feature: Feature, [, missing]: FeatureLoss) {
  return BONDS.includes(feature.type)
    ? missing > 0
    : missing === feature.end - feature.start + 1
}

export function interfaceLosses(
  interfaces: Record<string, number[]>,
  fate: Fate[],
) {
  return Object.fromEntries(
    Object.entries(interfaces).flatMap(
      ([partner, residues]): [string, InterfaceLoss][] => {
        const missing = count(fate, residues, 'missing')
        const replaced = count(fate, residues, 'replaced')
        return missing + replaced > 0
          ? [[partner, [missing, replaced, residues.length]]]
          : []
      },
    ),
  )
}

export function lacksInterface(isoform: Pick<Isoform, 'interfaces'>) {
  return Object.values(isoform.interfaces).some(
    ([missing, , total]) => missing >= INTERFACE_LOST_SHARE * total,
  )
}

export function trimmedEdit(
  sequence: string,
  [start, end, replacement]: SequenceEdit,
) {
  const original = sequence.slice(start - 1, end)
  return {
    start,
    end,
    original: original.slice(0, EDIT_PREVIEW),
    replacement: replacement.slice(0, EDIT_PREVIEW),
    added: replacement.length,
  }
}

export function parseModel(value: Record<string, unknown>) {
  const entryId = text(value.entryId)
  const cifUrl = text(value.cifUrl) ?? ''
  const plddtDocUrl = text(value.plddtDocUrl)
  const uniprotAccession = text(value.uniprotAccession)
  const sequence = text(value.sequence) ?? ''
  return value.uniprotStart === 1 &&
    value.uniprotEnd === sequence.length &&
    cifUrl.includes('-F1-') &&
    entryId !== undefined &&
    plddtDocUrl !== undefined &&
    uniprotAccession !== undefined
    ? [
        {
          entryId,
          cifUrl,
          plddtDocUrl,
          uniprotAccession,
          sequence,
        } satisfies AlphaFoldModel,
      ]
    : []
}

const MONOMER_ATTEMPTS = 4

export function monomerPath(accession: string) {
  return join(DATA, 'monomers', `${accession}.json`)
}

export function plddtPath(entryId: string) {
  return join(DATA, 'plddt', `${entryId}.json`)
}

export function roundedScores(scores: unknown) {
  return list(scores).map(score => pythonRound(number(score) ?? 0))
}

export function modelsIn(predictions: unknown) {
  return new Map(
    records(predictions)
      .flatMap(parseModel)
      .map(m => [m.uniprotAccession, m]),
  )
}

function fullModels(accession: string) {
  return getJson(
    `https://alphafold.ebi.ac.uk/api/prediction/${accession}`,
    monomerPath(accession),
    {},
    data => data,
    MONOMER_ATTEMPTS,
  ).then(modelsIn)
}

function cachedPlddt(entryId: string) {
  const path = plddtPath(entryId)
  return existsSync(path)
    ? list(readJson(path)).flatMap(score => number(score) ?? [])
    : undefined
}

function modelOf(entry: AlphaFoldModel, scores: number[] | undefined) {
  return {
    scores,
    model: {
      entry: entry.entryId,
      cif: entry.cifUrl,
      meanPlddt: scores
        ? pythonRound(scores.reduce((sum, s) => sum + s, 0) / scores.length, 1)
        : null,
      plddt: scores ? bandRuns(scores) : null,
    } satisfies Model,
  }
}

export function alphaFoldDb(plddtOf = cachedPlddt) {
  const pendingProteins = new Set<string>()
  const pendingModels = new Set<string>()
  return {
    pendingProteins,
    pendingModels,
    async models(accession: string) {
      const models = await fullModels(accession).catch((error: unknown) => {
        console.log(`${accession}: ${error}`)
        return undefined
      })
      if (!models) {
        pendingProteins.add(accession)
      }
      return models ?? new Map<string, AlphaFoldModel>()
    },
    scored(entry: AlphaFoldModel | undefined, sequence: string) {
      const matching = entry?.sequence === sequence ? entry : undefined
      const scores = matching ? plddtOf(matching.entryId) : undefined
      if (matching && scores === undefined) {
        pendingModels.add(matching.entryId)
      }
      return matching
        ? modelOf(
            matching,
            scores?.length === sequence.length ? scores : undefined,
          )
        : undefined
    },
  }
}

type AlphaFoldDb = ReturnType<typeof alphaFoldDb>

export function losingConfidence(
  positions: (number | null)[],
  scores: number[],
  canonicalScores: number[],
) {
  return positions.filter(
    (position, index) =>
      position !== null &&
      (canonicalScores[position - 1] ?? 0) >= FOLDED_PLDDT &&
      (scores[index] ?? 0) < UNFOLDED_PLDDT,
  ).length
}

export function readInterfaces(path = join(OUT, 'interfaces.json')) {
  const byAccession = existsSync(path) ? record(readJson(path)) : {}
  return new Map(
    Object.entries(byAccession).map(([accession, partners]) => [
      accession,
      Object.fromEntries(
        Object.entries(record(partners))
          .map(([partner, residues]): [string, number[]] => [
            partner,
            [...new Set(list(residues).flatMap(r => number(r) ?? []))].sort(
              (a, b) => a - b,
            ),
          ])
          .filter(([, residues]) => residues.length > 0)
          .sort(([a], [b]) => compareText(a, b)),
      ),
    ]),
  )
}

function transcriptsOf(entry: UniProtEntry) {
  const ensembl = ensemblByIsoform(entry)
  const refseq = refseqByIsoform(entry)
  const refseqProteins = refseqProteinsByIsoform(entry)
  const mane = maneIsoform(entry)
  const maneIds = maneTranscripts(entry)
  const ordered = (ids: string[]) =>
    [...new Set(ids)].sort(
      (a, b) =>
        Number(!maneIds.has(unversioned(a))) -
          Number(!maneIds.has(unversioned(b))) || compareText(a, b),
    )
  const unmapped = (
    byIsoform: Map<string | undefined, string[]>,
    shown: Set<string>,
  ) =>
    ordered(
      [...byIsoform].flatMap(([isoform, ids]) =>
        isoform !== undefined && shown.has(isoform) ? [] : ids,
      ),
    )
  return {
    of: (isoform: string) => ({
      ensembl: ordered(ensembl.get(isoform) ?? []),
      refseq: ordered(refseq.get(isoform) ?? []),
      refseqProteins: ordered(refseqProteins.get(isoform) ?? []),
      maneSelect: isoform === mane,
    }),
    unmapped: (shown: Set<string>) => ({
      ensembl: unmapped(ensembl, shown),
      refseq: unmapped(refseq, shown),
      refseqProteins: unmapped(refseqProteins, shown),
    }),
  }
}

function isoformNumber(isoform: string) {
  return Number.parseInt(isoform.slice(isoform.lastIndexOf('-') + 1), 10)
}

function validEdits(sequence: string, edits: SequenceEdit[]) {
  return edits.every(
    ([start, end], k) =>
      start >= 1 &&
      end >= start &&
      end <= sequence.length &&
      start > (edits[k - 1]?.[1] ?? 0),
  )
}

export function withinSequence(
  interfaces: Record<string, number[]>,
  length: number,
) {
  return Object.fromEntries(
    Object.entries(interfaces)
      .map(([partner, residues]): [string, number[]] => [
        partner,
        residues.filter(r => r >= 1 && r <= length),
      ])
      .filter(([, residues]) => residues.length > 0),
  )
}

export interface Sources {
  disease: Set<string>
  interfaces: Map<string, Record<string, number[]>>
  alphaFold: AlphaFoldDb
  explorer: (accession: string) => GeneRecord['explorer']
  places: Map<string, Place | null>
}

export async function geneRecord(
  entry: UniProtEntry,
  page: string,
  { disease, interfaces: predicted, alphaFold, explorer, places }: Sources,
) {
  const accession = accessionOf(entry)
  const sequence = sequenceOf(entry)
  const interfaces = withinSequence(
    predicted.get(accession) ?? {},
    sequence.length,
  )
  const isoforms = editsByIsoform(entry)
  const displayed = [...isoforms].find(([, info]) => info.displayed)
  const notes = notesByMolecule(entry)
  const transcripts = transcriptsOf(entry)
  const features = featuresOf(entry)
  const models = await alphaFold.models(accession)
  const canonical = alphaFold.scored(models.get(accession), sequence)
  const alternatives = [...isoforms]
    .filter(([, info]) => !info.displayed)
    .sort(([a], [b]) => isoformNumber(a) - isoformNumber(b))
  const built: Isoform[] = []
  for (const [isoform, info] of alternatives) {
    if (validEdits(sequence, info.edits)) {
      built.push(
        isoformRecord(isoform, info, {
          sequence,
          features,
          interfaces,
          canonicalScores: canonical?.scores,
          model: models.get(isoform),
          alphaFold,
          notes: notes.get(`Isoform ${info.name}`) ?? [],
          transcripts: transcripts.of(isoform),
        }),
      )
    } else {
      console.log(`${isoform}: edits outside or overlapping the sequence`)
    }
  }
  const canonicalAccession = displayed?.[0] ?? `${accession}-1`
  const canonicalTranscripts = transcripts.of(canonicalAccession)
  const shown = [canonicalTranscripts, ...built.map(i => i.transcripts)]
  return {
    page,
    gene: geneOf(entry) || accession,
    accession,
    protein: proteinOf(entry),
    length: sequence.length,
    disease: disease.has(accession),
    events: eventsOf(entry),
    canonical: {
      accession: canonicalAccession,
      name: displayed?.[1].name ?? '',
      synonyms: displayed?.[1].synonyms ?? [],
      notes: notes.get(`Isoform ${displayed?.[1].name}`) ?? [],
      transcripts: canonicalTranscripts,
      model: canonical?.model ?? null,
    },
    features,
    interfaces,
    isoforms: built,
    ensemblGenes: ensemblGenes(entry),
    unmapped: transcripts.unmapped(
      new Set([canonicalAccession, ...built.map(i => i.accession)]),
    ),
    explorer: explorer(accession),
    locus: locusOf(
      shown.flatMap(t => t.ensembl).map(id => places.get(unversioned(id))),
    ),
  } satisfies GeneRecord
}

function isoformRecord(
  accession: string,
  info: IsoformEdits,
  context: {
    sequence: string
    features: Feature[]
    interfaces: Record<string, number[]>
    canonicalScores: number[] | undefined
    model: AlphaFoldModel | undefined
    alphaFold: AlphaFoldDb
    notes: Isoform['notes']
    transcripts: Transcripts
  },
) {
  const { sequence, canonicalScores } = context
  const edits = mergedEdits(info.edits)
  const built = applyEdits(sequence, edits)
  const fate = fates(sequence, edits)
  const own = context.alphaFold.scored(context.model, built.sequence)
  const folded = (wanted: (fate: Fate) => boolean) =>
    canonicalScores
      ? canonicalScores.filter(
          (score, i) => score >= FOLDED_PLDDT && wanted(fate[i] ?? 'kept'),
        ).length
      : null
  return {
    accession,
    name: info.name,
    synonyms: info.synonyms,
    notes: context.notes,
    length: built.sequence.length,
    transcripts: context.transcripts,
    segments: segments(built.positions),
    edits: edits.map(edit => trimmedEdit(sequence, edit)),
    missing: fate.filter(f => f === 'missing').length,
    replaced: fate.filter(f => f === 'replaced').length,
    novel: built.positions.filter(p => p === null).length,
    foldedAbsent: folded(f => f !== 'kept'),
    foldedMissing: folded(f => f === 'missing'),
    features: featureLosses(context.features, fate),
    interfaces: interfaceLosses(context.interfaces, fate),
    model: own
      ? {
          ...own.model,
          losingConfidence:
            canonicalScores && own.scores
              ? losingConfidence(built.positions, own.scores, canonicalScores)
              : null,
        }
      : null,
  } satisfies Isoform
}

function perGroup(value: (group: FeatureGroup) => number) {
  return {
    targeting: value('targeting'),
    domains: value('domains'),
    sites: value('sites'),
    modifications: value('modifications'),
  } satisfies Record<FeatureGroup, number>
}

function lacksGroup(gene: GeneRecord, isoform: Isoform, group: FeatureGroup) {
  const types: readonly string[] = FEATURE_GROUPS[group]
  return isoform.features.some(loss => {
    const feature = gene.features[loss[0]]
    return feature !== undefined && types.includes(feature.type)
      ? lacksInFull(feature, loss)
      : false
  })
}

function hasTranscript(isoform: Isoform) {
  return (
    isoform.transcripts.ensembl.length + isoform.transcripts.refseq.length > 0
  )
}

function largest(values: number[]) {
  return values.reduce((most, value) => Math.max(most, value), 0)
}

export function indexRow(gene: GeneRecord) {
  const { isoforms } = gene
  const folded = isoforms.flatMap(i => i.foldedAbsent ?? [])
  const foldedMissing = isoforms.flatMap(i => i.foldedMissing ?? [])
  const canonicalPlddt = gene.canonical.model?.plddt
  return {
    page: gene.page,
    gene: gene.gene,
    accession: gene.accession,
    protein: gene.protein,
    length: gene.length,
    isoforms: isoforms.length,
    withTranscript: isoforms.filter(hasTranscript).length,
    mostAbsent: largest(isoforms.map(i => i.missing + i.replaced)),
    mostMissing: largest(isoforms.map(i => i.missing)),
    foldedAbsent: canonicalPlddt ? largest(folded) : null,
    foldedMissing: canonicalPlddt ? largest(foldedMissing) : null,
    lost: perGroup(
      group => isoforms.filter(i => lacksGroup(gene, i, group)).length,
    ),
    interfacesLost: isoforms.filter(lacksInterface).length,
  } satisfies IndexRow
}

export function totals(genes: GeneRecord[]) {
  const isoforms = genes.flatMap(gene =>
    gene.isoforms.map(isoform => ({ gene, isoform })),
  )
  const counted = (
    keep: (pair: { gene: GeneRecord; isoform: Isoform }) => boolean,
  ) => isoforms.filter(keep).length
  return {
    proteins: genes.length,
    isoforms: isoforms.length,
    withTranscript: counted(({ isoform }) => hasTranscript(isoform)),
    withModel: counted(({ isoform }) => isoform.model !== null),
    canonicalModels: genes.filter(gene => gene.canonical.model !== null).length,
    modelsPending: genes.reduce(
      (n, gene) =>
        n +
        [gene.canonical, ...gene.isoforms].filter(
          i => i.model !== null && i.model.plddt === null,
        ).length,
      0,
    ),
    maneSelectNotCanonical: genes.filter(gene =>
      gene.isoforms.some(isoform => isoform.transcripts.maneSelect),
    ).length,
    lacking: {
      ...perGroup(group =>
        counted(({ gene, isoform }) => lacksGroup(gene, isoform, group)),
      ),
      interface: counted(({ isoform }) => lacksInterface(isoform)),
      folded: counted(({ isoform }) => (isoform.foldedMissing ?? 0) > 0),
    },
  } satisfies Totals
}

function addTo(lookup: Map<string, string[]>, key: string, target: string) {
  const targets = lookup.get(key) ?? []
  if (!targets.includes(target)) {
    lookup.set(key, [...targets, target])
  }
}

function sortedLookup(lookup: Map<string, string[]>) {
  return Object.fromEntries(
    [...lookup].sort(([a], [b]) => compareText(a, b)),
  ) satisfies Lookup
}

export function lookups(genes: GeneRecord[]) {
  const symbols = new Map<string, string[]>()
  const accessions = new Map<string, string[]>()
  const ensembl = new Map<string, string[]>()
  const refseq = new Map<string, string[]>()
  for (const gene of genes) {
    addTo(symbols, gene.gene.toUpperCase(), gene.page)
    addTo(accessions, gene.accession, gene.page)
    for (const isoform of [gene.canonical, ...gene.isoforms]) {
      const target = `${gene.page}#${isoform.accession}`
      addTo(accessions, isoform.accession, target)
      for (const transcript of isoform.transcripts.ensembl) {
        addTo(ensembl, unversioned(transcript), target)
      }
      for (const transcript of [
        ...isoform.transcripts.refseq,
        ...(isoform.transcripts.refseqProteins ?? []),
      ]) {
        addTo(refseq, unversioned(transcript), target)
      }
    }
    for (const id of [
      ...(gene.ensemblGenes ?? []),
      ...(gene.unmapped?.ensembl ?? []),
    ]) {
      addTo(ensembl, unversioned(id), gene.page)
    }
    for (const id of [
      ...(gene.unmapped?.refseq ?? []),
      ...(gene.unmapped?.refseqProteins ?? []),
    ]) {
      addTo(refseq, unversioned(id), gene.page)
    }
  }
  return {
    genes: sortedLookup(symbols),
    accessions: sortedLookup(accessions),
    ensembl: sortedLookup(ensembl),
    refseq: sortedLookup(refseq),
  } satisfies Record<keyof typeof SEARCH, Lookup>
}

function lackedOfType(gene: GeneRecord, isoform: Isoform, type: string) {
  return isoform.features.filter(loss => {
    const feature = gene.features[loss[0]]
    return feature?.type === type && lacksInFull(feature, loss)
  })
}

function signalLacked(gene: GeneRecord, isoform: Isoform) {
  return lackedOfType(gene, isoform, 'Signal')[0]?.[0]
}

function everyTransmembraneLacked(gene: GeneRecord, isoform: Isoform) {
  const segments = gene.features.filter(f => f.type === 'Transmembrane')
  const lacked = lackedOfType(gene, isoform, 'Transmembrane')
  return segments.length > 0 && lacked.length === segments.length
    ? lacked[0]?.[0]
    : undefined
}

function domainWithActiveSiteLacked(gene: GeneRecord, isoform: Isoform) {
  const activeSites = lackedOfType(gene, isoform, 'Active site').flatMap(
    ([index]) => gene.features[index] ?? [],
  )
  return isoform.features.find(([index, missing]) => {
    const domain = gene.features[index]
    return domain?.type === 'Domain' &&
      missing > MOST * (domain.end - domain.start + 1)
      ? activeSites.some(
          site => site.start >= domain.start && site.end <= domain.end,
        )
      : false
  })?.[0]
}

const EXAMPLE_RULES = {
  signal: signalLacked,
  transmembrane: everyTransmembraneLacked,
  activeSite: domainWithActiveSiteLacked,
} satisfies Record<
  Example['kind'],
  (gene: GeneRecord, isoform: Isoform) => number | undefined
>

export function examples(genes: GeneRecord[]) {
  const candidates = genes
    .flatMap(gene => gene.isoforms.map(isoform => ({ gene, isoform })))
    .filter(({ isoform }) => hasTranscript(isoform))
    .sort(
      (a, b) =>
        a.isoform.missing +
          a.isoform.replaced -
          (b.isoform.missing + b.isoform.replaced) ||
        compareText(a.gene.gene, b.gene.gene) ||
        compareText(a.isoform.accession, b.isoform.accession),
    )
  const used = new Set<string>()
  const chosen: Example[] = []
  for (const kind of ['signal', 'transmembrane', 'activeSite'] as const) {
    const match = candidates
      .filter(({ gene }) => !used.has(gene.page))
      .flatMap(({ gene, isoform }) => {
        const index = EXAMPLE_RULES[kind](gene, isoform)
        const feature = index === undefined ? undefined : gene.features[index]
        return feature ? [{ gene, isoform, feature }] : []
      })[0]
    if (match) {
      used.add(match.gene.page)
      chosen.push({
        kind,
        page: match.gene.page,
        gene: match.gene.gene,
        protein: match.gene.protein,
        isoform: match.isoform.accession,
        name: match.isoform.name,
        transcript:
          match.isoform.transcripts.ensembl[0] ??
          match.isoform.transcripts.refseq[0] ??
          '',
        feature: match.feature,
        missing: match.isoform.missing,
        replaced: match.isoform.replaced,
      })
    }
  }
  return chosen
}

export function pageNames(entries: UniProtEntry[]) {
  const symbol = (entry: UniProtEntry) =>
    (geneOf(entry) || accessionOf(entry)).replace(/[^\w.-]/g, '-')
  const repeated = new Map<string, number>()
  for (const entry of entries) {
    repeated.set(symbol(entry), (repeated.get(symbol(entry)) ?? 0) + 1)
  }
  return new Map(
    entries.map(entry => [
      accessionOf(entry),
      repeated.get(symbol(entry)) === 1
        ? symbol(entry)
        : `${symbol(entry)}_${accessionOf(entry)}`,
    ]),
  )
}

export function hasAlternative(entry: UniProtEntry) {
  return [...editsByIsoform(entry).values()].some(info => !info.displayed)
}

async function main(workers = '8', ...accessions: string[]) {
  const entries = (await isoformEntries()).filter(hasAlternative)
  const disease = await diseaseAccessions()
  const interfaces = readInterfaces()
  const pages = pageNames(entries)
  const wanted = entries.filter(
    e => accessions.length === 0 || accessions.includes(accessionOf(e)),
  )
  const alphaFold = alphaFoldDb()
  const mapped = wanted.flatMap(entry =>
    [...ensemblByIsoform(entry)].flatMap(([isoform, ids]) =>
      isoform === undefined ? [] : ids.map(unversioned),
    ),
  )
  const places = await transcriptPlaces(mapped)
  const sources = {
    disease,
    interfaces,
    alphaFold,
    explorer: await explorerPages(),
    places,
  } satisfies Sources
  const failed: string[] = []
  const genes = (
    await inPool(wanted, Number(workers), async entry => {
      const accession = accessionOf(entry)
      try {
        return await geneRecord(
          entry,
          pages.get(accession) ?? accession,
          sources,
        )
      } catch (error) {
        failed.push(accession)
        console.log(`${accession}: ${error}`)
        return undefined
      }
    })
  ).filter(gene => gene !== undefined)
  if (accessions.length === 0) {
    rmSync(join(SITE_DATA, 'genes'), { recursive: true, force: true })
  }
  for (const gene of genes) {
    writeJson(join(SITE_DATA, 'genes', `${gene.page}.json`), gene)
  }
  const summary = totals(genes)
  if (accessions.length === 0 && failed.length === 0) {
    writeJson(
      join(SITE_DATA, 'index.json'),
      genes.map(indexRow).sort((a, b) => compareText(a.page, b.page)),
    )
    writeJson(join(SITE_DATA, 'totals.json'), summary, 2)
    writeJson(join(SITE_DATA, 'examples.json'), examples(genes), 2)
    const found = lookups(genes)
    for (const kind of ['genes', 'accessions', 'ensembl', 'refseq'] as const) {
      writeJson(join(SITE_DATA, SEARCH[kind]), found[kind])
    }
  }
  console.log(JSON.stringify(summary))
  console.log(
    failed.length > 0
      ? `${failed.length} proteins failed: ${failed.join(' ')}`
      : `${genes.length} proteins written`,
  )
  console.log(
    `AlphaFold DB pending: ${alphaFold.pendingProteins.size} proteins' model lists (rerun), ${alphaFold.pendingModels.size} models' pLDDT (pnpm plddt)`,
  )
  console.log(
    `Ensembl transcript places pending (rerun): ${new Set(mapped.filter(id => !places.has(id))).size}`,
  )
}

if (import.meta.main) {
  await main(...process.argv.slice(2))
}
