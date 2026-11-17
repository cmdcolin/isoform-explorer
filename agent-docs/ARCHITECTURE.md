---
name: architecture
description:
  "What Isoform explorer is for, the one question every page answers, and what
  counts as a loss. The map: it routes to the doc that holds the depth. Read
  first."
---

# Isoform explorer

A static site: look up a transcript, a gene symbol or a UniProt accession, and
see what the isoform it encodes lacks against the canonical protein. A sibling
of Interface explorer (`~/src/interface-atlas`, deployed at
`cmdcolin.github.io/interface-explorer`). That site covers isoforms only for
proteins with a disease annotation, about a third of those that have any. This
one covers every reviewed human UniProt entry with a described alternative
isoform: 10,587 proteins and 22,131 alternative isoforms
(`site/data/totals.json`, which is where any count in prose should come from).

This file is the map. Depth is in the docs it routes to; see
[CLAUDE.md](CLAUDE.md) for what belongs where.

| To | Read |
| --- | --- |
| write a sentence a visitor will see | [reference/CLAIMS.md](reference/CLAIMS.md) |
| add or change a page | [reference/PAGES.md](reference/PAGES.md) |
| change `src/types.ts` or anything writing `site/data` | [reference/DATA.md](reference/DATA.md) |
| run the pipeline, a full build or the full suite | [reference/BUILD_SERVER.md](reference/BUILD_SERVER.md) |
| push, change a JBrowse link, delete a branch | [reference/DEPLOY.md](reference/DEPLOY.md) |
| touch the antibody-contact code or copy | [reference/EPITOPES.md](reference/EPITOPES.md) |
| propose work for the Ig collaborators | [reference/IG_COLLABORATION.md](reference/IG_COLLABORATION.md) |
| find the next piece of work | [ideas/README.md](ideas/README.md) |
| build or operate the data | [docs/running.md](../docs/running.md) |

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

## House rules

- **The bar:** add something only if it makes the answer to the one question
  clearer to a biologist, a curator or someone with a transcript in hand.
  Before adding a feature, get a skeptical subagent review that sees the site,
  not your conclusion, and may answer "none".
- **Review every new sentence a reader will see,** against the built output,
  with a skeptical subagent that is given the sources and not your conclusion.
  Each such review so far has found the computation right and some of the copy
  claiming more than it showed.
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
  suite, typecheck, a full build and `pnpm check-links` once at the end, on the
  build server. Repeat this rule in any subagent brief.
  [reference/BUILD_SERVER.md](reference/BUILD_SERVER.md) says where and how.
- Self-explanatory code with minimal or no comments; no `any` or type casts,
  inferred return types; nested ifs or ternaries instead of early returns;
  bullet lists, not numbered ones, in markdown and tests.
