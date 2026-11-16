---
name: design
description: "What Isoform explorer is for, what each page says, where every number comes from, and what the site refuses to claim. Read before adding a page, a column or a sentence."
---

# Isoform explorer: design

A sibling of Interface explorer (`~/src/interface-atlas`, deployed at
`cmdcolin.github.io/interface-explorer`). That site covers isoforms only for
proteins with a disease annotation, about a third of those that have any. This
one covers every reviewed human UniProt entry with a described alternative
isoform: 10,649 proteins and 22,131 alternative isoforms on 2026-11-15.

## The one question

Public copy (the home hero, ledes, meta descriptions, README) frames the site
as an open-ended explorer of isoforms, in positive statements: "Explore human
protein isoforms", "compare each isoform with the canonical protein". The
owner asked for this over the loss framing below, following the
anti-ai-writing-tropes skill in `~/src/claudish`. Answer sentences, counts and
methods keep "lacks" and "missing", because those words name what is
measured.

**If this transcript is the one being made, what does the protein lose?**

- The visitor arrives with a transcript (ENST or NM), a gene or a UniProt
  accession, from RNA-seq, a long-read isoform or a variant report.
- The answer is a list of what the canonical protein has that this isoform's
  sequence does not, each item from a named source.
- "If" is deliberate. The site says nothing about whether, where or how much a
  transcript is expressed.

## What counts as a loss

Everything is computed from UniProt's `Alternative sequence` edits, placed on
the canonical (UniProt "displayed") sequence. No structure is needed for the
first three, so they cover every described isoform, not only the modelled ones.

- **Residues:** canonical residues an edit removes are `replaced` when the edit
  is a swap and `missing` otherwise; isoform residues the canonical lacks are
  `novel`.
- **UniProt features of the canonical protein that overlap those residues,** in
  four groups (`FEATURE_GROUPS` in `src/types.ts`):
  - processing, targeting and topology: signal and transit peptides,
    propeptides, chains and peptides, transmembrane and intramembrane
    segments, topological domains. Peptides are always kept; a chain only
    when the entry has more than one chain or peptide and it is not the
    longest of them, so the whole mature protein is never listed;
  - domains and regions: domains, repeats, zinc fingers, DNA-binding regions,
    coiled coils, regions, motifs. Regions described only as "Disordered" and
    compositional-bias features are left out;
  - sites: active, binding and other sites;
  - modifications: modified residues, lipidation, glycosylation, disulfide
    bonds, cross-links. A disulfide is two positions, not a range, and is lost
    when either cysteine is.
- **UniProt's own note on the isoform** (inactive, dominant negative, a
  premature stop that may trigger decay), quoted as UniProt's.
- **Confidently modelled residues:** canonical residues with pLDDT ≥ 70 in the
  AlphaFold DB monomer that the isoform lacks (the pipeline's `foldedAbsent`
  and `foldedMissing`). `null` when the canonical has no full-length model.
- **Predicted partner interfaces:** for each AlphaFold DB complex with
  ipSAE ≥ 0.6, the interface residues (within 5 Å of the partner, pLDDT ≥ 70)
  the isoform lacks. Same rules as Interface explorer.
- **The isoform's own model**, when AlphaFold DB has one: its pLDDT, and how
  many shared residues fall from ≥ 70 on the canonical to < 50 on the isoform.

## What the site does not claim

Interface explorer withheld a 3D distance from pathogenic sites to interfaces
because the sites sat in pLDDT < 50 regions and the number invited a proximity
story. The same standard applies here.

- **No consequence.** The site lists what the sequence lacks. It never says an
  isoform is non-functional, mislocalised, secreted, soluble, degraded or
  dominant negative, except by quoting UniProt's note.
- **Replaced is not lost.** An isoform's abutting UniProt edits are first
  joined into one; each edit is then a swap, its removed residues `replaced`,
  when after trimming the ends it shares with the canonical it adds at least
  half as many residues as it removes (`SWAP_SHARE` in `src/isoforms.ts`);
  otherwise they are `missing` and the added ones only `novel`. A swap (mutually exclusive exons, an alternative terminus of
  similar length) reads "replaced by N different residues"; the lost-feature
  counts on the home page and browse table use `missing` only.
- **Counts by confidence, never "no fold".** pLDDT is the prediction's
  confidence, not a measurement of folding. For the residues an isoform lacks,
  give the counts: of the M missing (or replaced) residues, N are confidently
  modelled (pLDDT ≥ 70) in the canonical model and K are below pLDDT 50. Never
  summarise a stretch as folded or unfolded: a majority below 50 can sit beside
  a confidently modelled domain that is lost with it (BRCA1 isoform 2 lacks
  both BRCT domains).
- **A kept interface is not binding.** No isoform was modelled with a partner.
  A full circle means the residues are present, nothing more.
- **Losing confidence is a model's opinion.** pLDDT is the prediction's
  confidence, not a measurement of folding. Say so beside the number.
- **Not expression.** The site computes and asserts nothing about expression:
  no GTEx, no tissue claims, no "major isoform" of its own. UniProt's notes are
  quoted verbatim and attributed, including where UniProt mentions expression
  ("A major isoform"). The MANE Select transcript is marked because it is a
  fact about annotation; when it encodes a non-canonical isoform, the page says
  so, since "loses" is measured against UniProt's canonical.
- **Not novel transcripts.** Only isoforms UniProt describes. A transcript not
  mapped to one is not on the site; About says so.

## Pages

- **Home:** modelled on Interface explorer's hero: a short headline, one
  sentence saying what the site shows, and a simple diagram (a canonical
  protein, and an isoform with its domain missing), then a screenshot of a
  gene page's map (`site/preview.png`, ZDHHC16 with its DHHC domain hovered),
  linked to that page and hidden on phones. The search box (gene,
  UniProt accession, ENST, NM) comes next in its own section, not in the hero:
  the owner found a search box front and center discouraging to visitors who
  first want to know what the site is about; for the same reason the site
  header has no search box. Then tiles of explorable counts
  from `totals.json`, three worked examples chosen by the pipeline's own
  numbers, and a closing note that the site compares sequences and points to
  GTEx for expression.
- **Browse:** one sortable, filterable row per protein from `index.json`.
- **Gene page (`/gene/<page>/`):** one per protein, one anchored section per
  isoform (`#P04637-2`), so a transcript search lands on its isoform.
  - A map: canonical feature rows, pLDDT band and partner-interface rows above
    one row per isoform drawn on canonical coordinates.
  - Per isoform, the answer first as a sentence, then the losses grouped under
    the edit that causes them, then transcripts, UniProt's note and links
    (UniProt, Ensembl, RefSeq, AlphaFold DB, isoform superposed on canonical in
    JBrowse, transcripts on the genome).
  - A link to Interface explorer for proteins with a disease annotation
    (`https://cmdcolin.github.io/interface-explorer/genes/?q=<gene>`), which is
    where ClinVar variants live. This site does not show variants.
- **About:** scope, sources, each rule above, and what is left out.

## Data

- `site/data/genes/<page>.json`: `GeneRecord`. `page` is the gene symbol, or
  `<gene>_<accession>` when two entries share a symbol. Besides the isoforms it
  holds `explorer` (Interface explorer gene and isoform page names, matched by
  accession from that site's published `genes.json` and `isoforms.json`),
  `locus` (GRCh38 span of the isoforms' Ensembl transcripts, from one batched
  Ensembl REST lookup; null without them or across chromosomes),
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
  - `lacking.interface`: isoforms missing at least half of the interface
    residues of at least one predicted partner.
  - `lacking.folded`: isoforms missing at least one canonical residue with
    pLDDT ≥ 70 in the canonical model.
- `site/data/examples.json`: `Example[]`, the home page's three worked
  examples. Among isoforms with a transcript, ordered by fewest canonical
  residues not carried over (then gene, isoform), each rule takes the first
  isoform of a protein not already used: one missing a signal peptide in full;
  one missing every transmembrane segment in full; one missing more than half
  of a domain and, in full, an active site inside it.
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
  `data/` and `out/` leaves `site/data` byte-identical.
- `src/types.ts` is the contract between pipeline and site. The pipeline owns
  it; pages import types from it and never restate them.

## House rules

- **The bar:** add something only if it makes the answer to the one question
  clearer to a biologist, a curator or someone with a transcript in hand.
  Before adding a feature, get a skeptical subagent review that sees the site,
  not your conclusion, and may answer "none".
- **Numbers in prose come from the pipeline,** never typed by hand.
- **Plain browsing.** No headline findings; statistics are there to say what
  can be explored.
- Code is copied from Interface explorer where it fits, never imported across
  repos. `data/` is a download cache; seed it with hardlinks from the sibling
  (`cp -al ../interface-atlas/data/{monomers,plddt,complexes,models,cif} data/`)
  to skip re-downloading.
- Worktree branch under `.claude/worktrees/`, fast-forward onto main. Commit;
  don't push. The owner opens PRs and creates the GitHub repository.
- Run only the tests for the files you touched while iterating; run the full
  suite and typecheck once at the end. Repeat this rule in any subagent brief.
- Self-explanatory code with minimal or no comments; no `any` or type casts,
  inferred return types; nested ifs or ternaries instead of early returns;
  bullet lists, not numbered ones, in markdown and tests.
