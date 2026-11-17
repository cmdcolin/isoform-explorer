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
  similar length) reads "has N different residues in place of M residues"; the lost-feature
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
- **GENCODE's decay type is GENCODE's.** Each Ensembl transcript GENCODE 49
  types `nonsense_mediated_decay` carries that term, verbatim and attributed,
  as MANE Select is marked. Only when every Ensembl transcript of an isoform is
  in GENCODE 49, of that type and with a complete coding sequence (no
  `cds_start_NF` or `cds_end_NF` tag) does the isoform's Transcripts entry say
  so in a sentence, with GENCODE's rule (coding sequence ending more than 50
  bases before a downstream splice site). Never paraphrase it as degraded, not
  made or predicted NMD. A mixed isoform gets the inline marks only: there the
  type often reflects a spliced 3′ UTR, not the protein (ADARB1).
- **A whole domain is a span, not a brick.** "Domains lost whole, none cut"
  compares the isoform's missing residues with UniProt's feature spans, and
  UniProt's edges are one source's call: Pfam and InterPro place the same
  domain a few residues either way. It says only that no domain or region is
  left partly missing — not where the deletion falls. Most isoforms it counts
  have an edit reaching a terminus, so they are truncations, and over half lose
  no `Domain` feature at all, qualifying on a Region, Motif, Coiled coil,
  Repeat or Zinc finger. Many cut a targeting feature partway (ABCC6 O95255-2
  loses 19 of a 21-residue transmembrane segment and is still counted). Browse
  carries the classification because a filter is a search aid; the gene page
  keeps the numbers ("missing in full: Ig-like V-type (domain, 19–135)"). Never
  read it as a deletion that falls between units, or as a protein that still
  works.
- **Not novel transcripts.** Only isoforms UniProt describes. A transcript not
  mapped to one is not on the site; About says so, and a gene page now gives
  the size of the gap: GENCODE 49 lists N complete protein-coding transcripts
  of the entry's Ensembl genes and UniProt maps M of them to an isoform here
  (8,824 of 10,587 pages have at least one it does not). A count of GENCODE's
  annotation, like the MANE Select mark, and no more than that: the unmapped
  transcripts are not named, not drawn and not claimed to encode a distinct
  protein. Many differ only outside the coding sequence, and GENCODE 49 is deep
  for some genes (LRRFIP2 has 306 against 29 mapped), so a wide gap is not
  evidence of missing biology.

## Pages

- **Home:** modelled on Interface explorer's hero: a short headline, one
  sentence saying what the site shows, and a simple diagram (a canonical
  protein, and an isoform with its domain missing), then a screenshot of a
  gene page's map (`site/preview.png`, ZDHHC16 with its DHHC domain hovered),
  linked to that page and hidden on phones. Search (gene, UniProt accession,
  ENST, NM) has its own page, linked from the header: the owner found a search
  box front and center discouraging to visitors who first want to know what
  the site is about. Then "Start from a disease": eight familiar disease
  names (`FAMILIAR` in `web/pages/index.astro`, checked against
  `diseases.json` at build) and a link to the full list. Then a card per blog
  post with its hero, cropped to 7:4 (`heroPosition: 'left'` in a post's
  frontmatter keeps a wide drawing's title in the crop), and a closing
  note that the site compares sequences and points to the expression post
  rather than straight to GTEx, whose per-transcript numbers that post shows
  can mislead. The home page has no tiles of counts: the owner found them
  noisy and visitors prefer pictures; About and Browse keep the totals.
- **Browse:** one sortable, filterable row per protein from `index.json`. The
  "Domains lost whole, none cut" column counts the protein's isoforms missing
  at least one whole domain or region while leaving none partly missing, which
  narrows a search to losses that stop at a unit's edge. It covers the
  `domains` group alone, which is a scope choice rather than a claim that the
  distinction is empty elsewhere: `targeting` spans a signal peptide and a
  transmembrane segment, where whole against cut means as much, and a counted
  isoform may well cut one. What the column does not say is under "What the
  site does not claim".
- **Gene page (`/gene/<page>/`):** one per protein, one anchored section per
  isoform (`#P04637-2`), so a transcript search lands on its isoform.
  - A map: canonical feature rows, pLDDT band and partner-interface rows above
    one row per isoform drawn on canonical coordinates.
  - A Protein / Gene + protein toggle (CSS only; Protein by default). The gene
    view draws each isoform's transcript, introns at a fixed width, above the
    map, with a band joining the canonical's coding exons to its residues; it
    exists so splicing that cuts inside an exon (an alternative acceptor or
    donor) can be seen rather than explained.
  - Per isoform, the answer first as a sentence, then the losses grouped under
    the edit that causes them, then transcripts, UniProt's note and links
    (UniProt, Ensembl, RefSeq, AlphaFold DB, isoform superposed on canonical in
    JBrowse, transcripts on the genome).
  - A link to Interface explorer for proteins with a disease annotation
    (`https://cmdcolin.github.io/interface-explorer/genes/?q=<gene>`), which is
    where ClinVar variants live. This site does not show variants.
- **Blog (`/blog/<id>/`):** worked examples, one isoform per post, written in
  MDX in `web/content/blog/`. Numbers and the quoted answer sentence come from
  the gene record through `web/lib/stories.ts`, so they follow the data. Each
  post has a hero of a different kind, drawn for it and retaken by
  `pnpm heroes` from a `figures/` page: a topology drawing generated from
  UniProt features (`web/lib/topology.ts`), the bases of an exon with its two
  splice acceptors and the codons between them (`web/lib/acceptor-figure.ts`,
  bases from `pnpm illustration`), a bead chain with the active-site
  palmitate as a skeletal formula (`web/lib/active-site-figure.ts`), an mRNA
  with ribosomes on its start codons and the proteins they make
  (`web/lib/start-codons-figure.ts`, coordinates from RefSeq in
  `web/lib/posts-data.ts`), an anatomical drawing of a motor neuron from
  spinal cord to muscle (`web/lib/motor-neuron-figure.ts`), a chart of
  GTEx data, and an illustration of a PDB structure in David Goodsell's style
  (`src/illustration.ts` extracts the atoms, `web/scripts/illustrate.ts` draws
  them). Screenshots of the gene page and of JBrowse appear inside posts as
  figures, never as heroes. A new post needs a hero unlike all of these; the
  owner drops a post whose hero would not be new. A post may cite literature and public expression data to say
  where an isoform is made, attributed to its source; the rules above still
  hold for every sentence the site generates. GTEx transcript TPM is never
  quoted alone: `pnpm expression` also counts reads across the isoform's own
  splice junction, because the two can disagree completely (NDUFC2 isoform 4:
  about 39% of the gene by TPM, 49 junction reads in all of GTEx; PKM M1 the
  other way, 95% of junction reads in skeletal muscle and under 4% by TPM). The
  junction tallies are our count of public data, and posts say so.
- **Diseases (`/diseases/`, `/disease/<slug>/`):** UniProt's disease
  comments for the proteins on the site, from `pnpm diseases`
  (`site/data/diseases.json`). A disease page quotes UniProt's description
  and, for each protein UniProt links to it, UniProt's note on the link
  verbatim ("The disease is caused by variants affecting…", "may be
  caused…", "susceptibility…"), the gene map and each isoform's answer
  sentence. The site says nothing about whether an isoform matters for the
  disease; ClinVar variants stay on Interface explorer. Diseases are grouped by
  body system or process (`SYSTEMS` in `src/types.ts`: a label per MONDO
  class, matched through the disease's OMIM id and every MONDO ancestor), as
  chips that filter the list (`/diseases/?group=brain`); a disease page lists
  its groups and the other diseases in its OMIM phenotypic series, as
  Interface explorer does. A note longer than one
  sentence shows its first sentence and opens to the rest. Search matches
  disease names, acronyms and genes by word (`search/diseases.json`), so a
  visitor can type "cystic fibrosis". Gene pages link their
  diseases, and posts may name a disease to explain a gene to a lay reader,
  attributed to UniProt.
- **About:** scope, sources, each rule above, and what is left out.

## Data

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
