export const REFSEQ_TRACK = 'hg38-ncbiRefSeqCurated'
export const GENCODE_TRACK = 'hg38-gencodeComp'

export function jbrowseUrl(config: string) {
  return `https://jbrowse.org/code/jb2/main/?config=${encodeURIComponent(config)}`
}

export function sessionUrl(spec: object, jbrowse: string) {
  return `${jbrowse}&session=spec-${encodeURIComponent(JSON.stringify(spec))}`
}

export function transcriptTracks(transcriptId?: string) {
  return transcriptId?.startsWith('ENST')
    ? [GENCODE_TRACK, REFSEQ_TRACK]
    : [REFSEQ_TRACK, GENCODE_TRACK]
}

export function transcriptsSpec(gene: string) {
  return {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: gene,
        tracks: transcriptTracks(),
      },
    ],
  }
}

export function transcriptsUrl(gene: string, jbrowse: string) {
  return sessionUrl(transcriptsSpec(gene), jbrowse)
}

export function isoformSpec(
  gene: string,
  transcriptId: string | undefined,
  structures: { url: string }[],
) {
  return {
    views: [
      {
        type: 'ProteinView',
        gene,
        ...(transcriptId ? { transcriptId } : {}),
        structures,
        connectedView: {
          assembly: 'hg38',
          tracks: transcriptTracks(transcriptId),
        },
      },
    ],
  }
}

export function isoformUrl(
  gene: string,
  transcriptId: string | undefined,
  structures: { url: string }[],
  jbrowse: string,
) {
  return sessionUrl(isoformSpec(gene, transcriptId, structures), jbrowse)
}

export function isoformAtLocusUrl(
  gene: string,
  transcriptId: string | undefined,
  structures: { url: string }[],
  loc: string,
  jbrowse: string,
) {
  const spec = isoformSpec(gene, transcriptId, structures)
  return sessionUrl(
    {
      views: spec.views.map(view => ({
        ...view,
        connectedView: { ...view.connectedView, loc },
      })),
    },
    jbrowse,
  )
}
