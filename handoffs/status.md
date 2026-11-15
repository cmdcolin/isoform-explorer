---
name: status
description:
  'Where Isoform explorer stands after its first build on 2026-11-15: what is
  done, what is still filling in, what the owner must do to deploy, and what was
  reviewed out. Read before picking up work or proposing a feature.'
---

# Status after the first build (2026-11-15)

`handoffs/design.md` says what the site is and what it refuses to claim. This
file says where the work stands.

## Done

- Pipeline: `pnpm interfaces` (predicted partner interfaces for every protein
  with an alternative isoform) and `pnpm isoforms` (every described isoform's
  losses on canonical coordinates, the index, totals, search lookups and worked
  examples). A rerun with full caches needs no network, takes seconds, and
  leaves `git status` clean.
- Site: home with search, browse, one gene page per protein with an anchored
  section per isoform, About. A full build is about 10,600 pages and 400 MB.
- One outside review of the built site (a reader told nothing of the design,
  then eight isoforms checked against UniProt's REST API, then the site checked
  against its own rules). UniProt-derived statements all matched. Its findings
  are fixed or listed below.

## Still filling in

- **Isoform model confidence.** AlphaFold DB's file server rate-limits bursts
  (429, then 403, with no Retry-After), and isoform models have no bulk
  download. `pnpm plddt <pause seconds>` fetches the pending confidence
  documents one at a time; one request every second or two is tolerated. It was
  left running on the build server. To finish:
  - copy the server's `data/plddt/` into the local `data/plddt/`;
  - run `pnpm isoforms`; `totals.json`'s `modelsPending` should reach 0, bar ten
    canonical models missing from the bulk proteome file, which `pnpm plddt`
    also fetches;
  - commit `site/data`.
- Pages already distinguish "model exists, confidence not yet fetched" from "no
  model", so the site is correct while this fills in.

## For the owner to do

- Create the GitHub repository and enable Pages; `.github/workflows/pages.yml`
  builds, checks links and deploys on a push to main. Nothing has been pushed.
- Every JBrowse link loads `jbrowse/config.json` from the deployed site, so they
  404 until the first deploy. The superposed and genome views were checked
  against Interface explorer's deployed config, which has no GENCODE track:
  opening an isoform by ENST is the one path not yet seen working end to end.
  Check one ENST-only isoform after deploying.
- The header and footer have no link to the repository yet.

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
  reviewer. It needs a new source (SIFTS) and a rule for partial structures; not
  built.
- **Filtering expression out of UniProt's notes.** Notes are quoted whole and
  attributed. The rule is that the site computes and asserts nothing about
  expression.
- **ClinVar, GTEx, consequence calls, transcripts UniProt does not describe:**
  out of scope by design. ClinVar lives on Interface explorer, linked from a
  gene page only when that site has the page.

## Working rules

- As in `handoffs/design.md`. In addition: edit and run single-file tests on the
  laptop, and run downloads, full builds, the full suite and typecheck on the
  build server (rsync the worktree with `--exclude /data --exclude /out`, never
  a bare `--exclude data`, which also drops `site/data`).
