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

- **Entry-level subunit notes**, the third change out of that review: UniProt's
  SUBUNIT comments naming no isoform were being dropped by `notesByMolecule`,
  which keeps only comments with a `molecule`. `subunitNotes` keeps them and
  7,481 gene pages now quote them under `#subunit`, above the isoform sections.
  `cc_subunit` was already in `ENTRY_FIELDS`, so this needed no refetch. The
  text is often exactly the multimer answer the collaborator wanted and the
  site cannot compute: CD33 "Homodimer; disulfide-linked", CD22 "Predominantly
  monomer of isoform CD22-beta. Also found as heterodimer of isoform CD22-beta
  and a shorter isoform."

## Open from 2026-11-16

- The previous session reported a full build (15,060 pages, exit 0),
  `pnpm check-links` with 0 broken of 257,527, `astro check` clean and 239
  tests passing. Main is ahead of origin and unpushed; pushing is the owner's.
  The `domain-excision` and `subunit-notes` worktrees are merged and clean and
  can be deleted. `blog` and `gtex-post-retitle` hold commits that are not on
  main by patch id, though main already has the posts and the retitle they
  describe; ask the owner before deleting or building on either.
- Ruled out: folding isoform-partner complexes here, and any escape-risk
  score.
- `cc_subcellular_location` is the other half of the multimer-and-location
  idea and is **not** fetched; adding it to `ENTRY_FIELDS` means refetching
  `data/uniprot_isoforms.json` for all 10,683 entries, so it was left out.
- Labelling self-partners in the interface rows was already built:
  `partnerName` in `web/lib/loss.ts` renders "GENE (itself)". A review
  proposed it as new; it is not.
- Expression beyond the five blog cases is computable for 13,614 isoforms with
  a defining junction, but it breaks the "Not expression" refusal, and GTEx is
  the wrong panel for immune activation; Snaptron's `srav3h` is the same code
  path if it is ever scoped that way.
- Candidate posts with a new kind of hero: LEF1 isoform 7 (lacks every
  predicted β-catenin contact; a Wnt pathway cartoon) and NDUFV3 (MANE encodes
  473 residues against UniProt's 108; a ruler drawn to scale).

## Next, in order (planned 2026-11-16)

- **Done: multi-gene pages name their genes** (`codingNote`; the rule is in
  `design.md` under "Not novel transcripts"), and one leftover transcript
  reads "it is". `data/gencode_v49_genes.json` replaces
  `gencode_v49_gene_transcripts.json`, adding each gene's name, chromosome
  and readthrough tag; the old file is unused and can go.
- **Epitope spike, built on 2026-11-16 (branch `epitope-spike`) and written up
  as the CD22 post.** `src/epitopes.ts` takes the target as the entity RCSB
  aligns to the accession, groups binder chains into Fabs by their heavy-light
  interface, and pairs each target copy with the Fab touching it most; 5VL3
  has four copies, and copy R has 16 residues within 5 Å of copy Q's Fab, which
  is packing. `web/lib/epitope.ts` projects the contacts onto isoforms. Result:
  every isoform has all 26 m971 contacts (7O52) but differs only outside its
  resolved 507–682; of the 30 epratuzumab contacts all four 5VL3 copies share,
  CD22-alpha has 19 (lacks 11 in d3) and isoform 5 has 27. The sugar on
  Asn231 is within 5 Å of epratuzumab's Fab in all four copies, and every
  isoform has Asn231. Run
  `node src/epitopes.ts` on ada; it writes
  `web/content/blog/data/cd22-contacts.json`.
- **Wording, agreed with the owner on 2026-11-16, before any code:**
  - The line is "Contact residues present in this isoform: 14 of 17", where
    the 17 counts only contact residues the structure covers. Never "epitope
    intact" or "binds".
  - Each residue is present, missing, or not covered by the structure.
  - An isoform that differs from the canonical only outside the structure's
    window gets its count plus a note: "This isoform differs from the
    canonical only outside the structure (residues 504–687)."
  - Present residues beside an edit are counted separately: "14 of 17
    present; 2 of those within 3 residues of a missing stretch." This says
    where the edge is without claiming the fold changes.
  - Fixed caveat beside every count: "A crystal contact set is not the
    epitope: these are residues within 5 Å of the antibody in one structure.
    That an isoform keeps them says nothing about whether it folds the same
    way or binds."
- **CD19 scope post,** framed as above: the count does not rescue it. Prose
  only, so it can run alongside the spike. Write it from main, where the
  posts live (`web/content/blog/`).
- **Epitope rollout,** only if the spike answers the collaborator's question.
  The hard part is knowing which entries are antibody complexes at all. Start
  from a curated list of therapeutic-antibody
  complexes (SAbDab or Thera-SAbDab) rather than detecting them.

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
  reviewer. Not built as a general feature; the planned epitope spike under
  "Next, in order" is the scoped version, with "not covered by this
  structure" as its rule for partial structures.
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
