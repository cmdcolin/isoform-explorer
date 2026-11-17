---
name: status
description:
  'Where Isoform explorer stands on 2026-11-16: what is done, what the owner
  must do to deploy, what is open and what was reviewed out. Read before
  picking up work or proposing a feature.'
---

# Status after the first build (2026-11-15)

`handoffs/design.md` says what the site is and what it refuses to claim. This
file says where the work stands.

## Done

- Pipeline: `pnpm interfaces` (predicted partner interfaces for every protein
  with an alternative isoform) and `pnpm isoforms` (every described isoform's
  losses on canonical coordinates, the index, totals and search lookups). A
  rerun with full caches needs no network, takes seconds, and leaves
  `git status` clean.
- Site: home, search, browse, one gene page per protein with an anchored
  section per isoform, diseases, blog, How it works, About. A full build is
  about 10,600 gene pages and 4,451 disease pages.
- One outside review of the built site (a reader told nothing of the design,
  then eight isoforms checked against UniProt's REST API, then the site checked
  against its own rules). UniProt-derived statements all matched. Its findings
  are fixed or listed below.

## Filled in on 2026-11-16

- **Isoform model confidence.** The build server's `pnpm plddt` finished; its
  `data/plddt/` was copied down and `modelsPending` is 0.
- **Partner interfaces were blank on main from `9d915dcb` to here.** That
  commit's `site/data` was written by a run without `out/interfaces.json` and
  without the chain rule, so `interfaceProteins` read 0 and some entries lost
  their chains. Before committing `site/data`, check that `totals.json`'s
  `interfaceProteins` is not 0 and that `git diff` touches only what the change
  should.

## Added on 2026-11-16

- **Home** lost its tiles of counts; the owner found them noisy. It is the
  hero, the post cards and a closing note.
- **Blog:** six posts (PAR3, NDUFC2, ZDHHC16, PKM, CEBPB, and the junction
  post, retitled "Exploring tissue-specific splicing"), each with a hero of a
  different kind drawn by code; see `handoffs/design.md`. Titles lead with the
  biology, and titles, descriptions and headings avoid giving things agency
  (the claudish anti-ai-writing-tropes checklist).
- **Diseases:** `pnpm diseases` writes `site/data/diseases.json` from
  UniProt's disease comments (4,451 diseases over 3,154 proteins); `/diseases/`
  lists them with a filter, and each `/disease/<slug>/` page draws the linked
  genes' maps with each isoform's answer sentence. MONDO groups them into 17
  body systems and processes, and into OMIM phenotypic series; search finds
  them by name. This reverses the earlier
  "drop the disease fetch" cleanup, which removed an unused download.
- **Generated sentences** use "has" in place of "swaps … for", "inserts" and
  "carries": "Has 45 different residues in place of 45 residues of …".
- **Prettier** ignores `*.mdx`; it splits `{' '}` across lines and breaks the
  build.

## Added on 2026-11-16, after a review of what the site could answer next

A collaborator on Ig-domain immunotherapy targets (CD33, CD22) argued that
splicing moves whole Ig domains in and out, that the interesting question is
when an isoform is in play, and that "a database is not going to be a
solution". Two changes came out of it, both generic rather than Ig-specific:
only 343 of the site's proteins carry an Ig-like domain, and whole-unit
excision is commoner in zinc-finger, ANK, WD and calponin-homology arrays.

- **Browse: "Domains lost whole, none cut"** (`excised` on `IndexRow` and in
  `totals.lacking`): 2,832 isoforms missing at least one whole domain or region
  and leaving none partly missing. Two things a reviewer established and
  `design.md` now records: the column says nothing about where the deletion
  falls (most counted isoforms have an edit reaching a terminus, over half lose
  no `Domain` feature, and some cut a transmembrane segment partway), and an
  isoform whose other domain sits wholly inside a swap is left out, since
  `lacksInFull` counts missing residues only.
- **Gene page: GENCODE's coding transcripts against UniProt's isoforms.**
  8,824 of 10,587 pages say how many complete protein-coding transcripts
  GENCODE 49 lists for the entry's Ensembl genes and how many UniProt maps to
  an isoform there. `data/gencode_gene_transcripts.json` caches the pass.
- **CD19 is the case that motivated the second one and the case it does not
  help**: its Δex2 escape isoform is not in UniProt's alternative products, and
  GENCODE lists only 2 complete coding transcripts, both mapped, so the page
  reads 2/2 and shows no sentence. Any post about the site's scope has to say
  that plainly rather than lean on the count.

## Open from 2026-11-16

- Run a full build and `pnpm check-links` before pushing; every build on
  2026-11-16 was partial (`PAGES=`).
- Ideas reviewed and not built, worth keeping: experimental PDB contacts and
  epitope survival per isoform (**SIFTS is no longer the blocker status.md
  claimed** — RCSB's REST API returns SIFTS alignments directly, `contacts.ts`
  and `interfaces.ts` already parse mmCIF, and 7O52 is CD22 d6-d7 with the Fab
  of the CAR binder m971); quoting UniProt's `cc_subunit` and
  `cc_subcellular_location` verbatim for multimer context; labelling
  self-partners in the interface rows (930 proteins have one). Ruled out:
  folding isoform-partner complexes here, and any escape-risk score.
- Expression beyond the five blog cases is computable for 13,614 isoforms with
  a defining junction, but it breaks the "Not expression" refusal, and GTEx is
  the wrong panel for immune activation; Snaptron's `srav3h` is the same code
  path if it is ever scoped that way.
- Candidate posts with a new kind of hero: LEF1 isoform 7 (lacks every
  predicted β-catenin contact; a Wnt pathway cartoon) and NDUFV3 (MANE encodes
  473 residues against UniProt's 108; a ruler drawn to scale).

## Deployment

- Repository: https://github.com/cmdcolin/isoform-explorer (public). Pages
  builds from `.github/workflows/pages.yml` on every push to main and serves
  https://cmdcolin.github.io/isoform-explorer/. The footer links the repository.
- Every JBrowse link loads `jbrowse/config.json` from the deployed site. The
  GENCODE track is kept, so ENST-only isoforms can open. GENCODE's GFF3 has no
  `Name` attribute, so the track's label expression shows `gene_name` on genes
  and the transcript id on transcripts; without it genes read as ENSG ids.
  Opening an isoform by ENST has still not been seen working end to end in a
  browser.

## Open, small

- The first sentence for isoforms with many overlapping regions is still long
  (TP53 P04637-2 runs to four clauses). Each clause names at most three
  features; dropping a clause would hide losses.
- A swap that only partly overlaps a domain names no feature in its lead (APP
  P05067-2 at 290–305).
- pLDDT is rounded per residue before thresholds and means, so a count or mean
  can differ by one from AlphaFold DB's own page.
- Interface explorer does not link back to this site.

## Reviewed out or decided against (don't redo without a new reason)

- **"The model shows no fold where residues are missing."** The first design
  said this when most missing residues were below pLDDT 50. On BRCA1 P38398-2,
  which lacks both BRCT domains, it was false. Pages give counts by confidence
  and never characterise the region.
- **Classifying each UniProt edit on its own.** UniProt writes the same change
  as one edit or as two abutting ones (APP isoforms 8 and 11). Abutting edits
  are joined first, then a joined edit is a swap only if it adds back at least
  half as many residues as it removes.
- **Matching residues by position inside a swap.** It counted coincidental
  identical letters as carried over. Point features inside a swap are said to
  fall in the replaced stretch; the page does not assert the residue changed.
- **Topological domains in the first sentence.** A two-residue deletion read
  "cut: Cytoplasmic (399–821)". They stay in the detail list only.
- **A whole-protein Chain as a feature.** Every isoform cuts it. Chains are kept
  only when an entry has several products and the chain is not the longest.
- **Experimental (PDB) coverage of the absent residues,** suggested by the
  reviewer. Not built, and still needs a rule for partial structures, but the
  source is no longer missing: see the SIFTS note under what was reviewed and
  not built, above.
- **Filtering expression out of UniProt's notes.** Notes are quoted whole and
  attributed. The rule is that the site computes and asserts nothing about
  expression.
- **ClinVar, GTEx, consequence calls, transcripts UniProt does not describe:**
  out of scope by design. ClinVar lives on Interface explorer, linked from a
  gene page only when that site has the page. A gene page now counts the
  coding transcripts UniProt does not describe, which is a count of GENCODE's
  annotation; naming or drawing them stays out of scope.

## Working rules

- As in `handoffs/design.md`. In addition: edit and run single-file tests on the
  laptop, and run downloads, full builds, the full suite and typecheck on the
  build server (rsync the worktree with `--exclude /data --exclude /out`, never
  a bare `--exclude data`, which also drops `site/data`).
