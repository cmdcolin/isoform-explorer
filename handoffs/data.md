---
name: data
description:
  "The files the pipeline writes and the site reads, field by field, and the
  guarantee that regenerating them is deterministic. Read before changing
  src/types.ts or anything that writes site/data."
---

# Data

`src/types.ts` is the contract between pipeline and site. The pipeline owns
it; pages import types from it and never restate them. `docs/running.md` says
how to run each step.

- `site/data/genes/<page>.json`: `GeneRecord`. `page` is the gene symbol, or
  `<gene>_<accession>` when two entries share a symbol. Besides the isoforms it
  holds `explorer` (Interface explorer gene and isoform page names, matched by
  accession from that site's published `genes.json` and `isoforms.json`),
  `locus` (GRCh38 span of the isoforms' Ensembl transcripts, from one batched
  Ensembl REST lookup; null without them or across chromosomes), `exons`
  (junctions of the first Ensembl transcript UniProt maps to the canonical
  isoform whose GENCODE 49 coding length is the canonical length, plus or
  minus a stop codon, in coding nucleotides; `first` is the exon number of
  the first coding exon; null otherwise; the map draws an Exons row and cuts
  each isoform bar at the junctions), `structures` (by isoform accession, the
  GRCh38 exons and coding span of one GENCODE 49 transcript whose coding
  length fits the isoform: for the canonical the first such, for the others
  the one differing from the canonical's in the fewest bases; isoforms with
  none are absent),
  `ensemblGenes`, and `unmapped`: the ENST, NM and NP ids UniProt lists for the
  entry without naming an isoform. A model whose pLDDT is not cached yet keeps
  its entry and CIF link with null pLDDT fields.
- `site/data/index.json`: `IndexRow[]`; `mostMissing` and `foldedMissing` are
  the missing-only maxima over the isoforms, `mostAbsent` and `foldedAbsent`
  also count replaced residues. `site/data/totals.json`: `Totals`,
  counting alternative isoforms (the canonical is never counted) unless a
  line says proteins:
  - `proteins`: reviewed human entries with at least one Described isoform;
    `isoforms`: their Described isoforms.
  - `withTranscript`: isoforms with at least one ENST or NM cross-reference.
  - `withModel`: isoforms whose own AlphaFold DB model has exactly the
    rebuilt isoform sequence; `canonicalModels`: proteins whose canonical has
    one full-length `-F1-` model of exactly its sequence.
  - `interfaceProteins`: proteins with at least one confident predicted
    partner interface.
  - `modelsPending`: canonical and isoform models whose pLDDT is not cached.
  - `maneSelectNotCanonical`: proteins whose MANE Select transcript encodes a
    Described isoform rather than the canonical.
  - `lacking.<group>`: isoforms missing in full at least one feature of the
    group: every residue of a range, or either residue of a disulfide bond or
    cross-link. Missing only: residues of a swap (an edit adding at least
    half as many residues as it removes) never count.
  - `lacking.excised`: isoforms missing in full at least one `domains` feature
    and leaving none of them partly missing. An isoform whose other domain is
    wholly inside a swap is left out: `lacksInFull` counts missing residues
    only, so a swapped domain is neither lost nor intact (LMO7 Q8WWI1-5).
  - `lacking.interface`: isoforms missing at least half of the interface
    residues of at least one predicted partner.
  - `lacking.folded`: isoforms missing at least one canonical residue with
    pLDDT ≥ 70 in the canonical model.
- `site/data/search/`: lookups from gene, accession, ENST and NM (versions
  dropped) to `<page>#<isoform accession>`. Split so the browser loads the
  transcript maps only when the query looks like a transcript: `genes.json`
  (upper-case symbol → pages), `accessions.json` (entry accession → page,
  isoform accession → `page#isoform`), `ensembl.json` (ENST, and ENSG to the
  page) and `refseq.json` (NM and NP); a transcript tied to no isoform leads
  to the page. Each
  value is a list, since a symbol or transcript can name more than one target
  (`SEARCH` and `Lookup` in `src/types.ts`).
- `out/interfaces.json`: per accession, partner → confident interface residues.
  Written by `src/interfaces.ts`, read by `src/isoforms.ts`, absent partners
  simply give no interface rows.
- Regeneration is deterministic: `pnpm isoforms` run twice from the same
  `data/` and `out/` leaves `site/data` byte-identical, so a rerun with full
  caches needs no network and leaves `git status` clean.
