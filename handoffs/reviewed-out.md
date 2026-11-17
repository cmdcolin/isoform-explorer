---
name: reviewed-out
description:
  'What Isoform explorer was asked to show and does not, with the reason each
  one failed. Read before proposing a feature, so a rejected idea is not
  rebuilt without a new reason.'
---

# Reviewed out or decided against

Don't redo any of these without a new reason. Most come from reviews of the
built site: one outside review on 2026-11-15, where a reader told nothing of
the design checked eight isoforms against UniProt's REST API, and the skeptical
reviews every reader-facing sentence gets before it lands. `claims.md` states
the rules these decisions produced; this file keeps the reasons.

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
- **A whole-protein Chain as a feature.** Every isoform cuts it. Chains are
  kept only when an entry has several products and the chain is not the
  longest.
- **Experimental (PDB) coverage of the absent residues,** suggested by the
  outside reviewer. Not built as a general feature. The CD22 epitope spike in
  `epitopes.md` is the scoped version, with "differs only outside the
  structure" as its rule for partial coverage.
- **Filtering expression out of UniProt's notes.** Notes are quoted whole and
  attributed. The site computes and asserts nothing about expression.
- **ClinVar, GTEx, consequence calls, and transcripts UniProt does not
  describe.** Out of scope by design. ClinVar lives on Interface explorer,
  linked from a gene page only where that site has the page. A gene page counts
  the coding transcripts UniProt does not describe, which is a count of
  GENCODE's annotation; naming or drawing them stays out of scope.
- **The ideas from the Ig collaboration that were rejected** are in
  `ig-collaboration.md`, with their reasons.
