---
name: ig-collaboration
description:
  'The collaborator on Ig-domain immunotherapy targets (CD33, CD22): what they
  argued, the changes that came out of it, and the ideas ruled out. Read before
  proposing work framed around that collaboration.'
---

# The Ig-domain collaboration

A collaborator working on Ig-domain immunotherapy targets (CD33, CD22) argued
that splicing moves whole Ig domains in and out, that the interesting question
is when an isoform is in play, and that "a database is not going to be a
solution". The sibling repository `~/src/interface-atlas` has a file of the
same name covering the collaboration from that site's side.

## What came out of it

Each change is generic rather than Ig-specific: only 343 of the site's
proteins have an Ig-like domain, and whole-unit excision is commoner in
zinc-finger, ANK, WD and calponin-homology arrays. [CLAIMS.md](CLAIMS.md)
records what each one claims and does not.

- Browse's "Domains lost whole, none cut" column (`excised` on `IndexRow` and
  in `totals.lacking`): 2,832 isoforms missing at least one whole domain or
  region and leaving none partly missing.
- The gene page's count of GENCODE 49's complete coding transcripts against
  the ones UniProt maps to an isoform (`codingNote`), on 8,824 of 10,587
  pages.
- UniProt's entry-level SUBUNIT comments, quoted under `#subunit`. The text is
  often the multimer answer the collaborator wanted and the site cannot
  compute: CD33 "Homodimer; disulfide-linked", CD22 "Predominantly monomer of
  isoform CD22-beta. Also found as heterodimer of isoform CD22-beta and a
  shorter isoform."
- The CD22 epitope spike and its post; see [EPITOPES.md](EPITOPES.md).
- The CD19 post (`2026-11-16-cd19-exon-2.mdx`), on the exon 2-skipped mRNA
  behind CART-19 relapses, which Sotillo et al. reported in 2015. It is the
  case the GENCODE count does not help: UniProt describes no such isoform,
  GENCODE 49 lists no such transcript, and the page reads 2 of 2. A post about
  the site's scope has to say that plainly rather than lean on the count.

## Ruled out

- Folding isoform-partner complexes here, and any score of escape risk.
- Expression beyond the blog's worked cases. It is computable for 13,614
  isoforms with a defining junction, but it breaks the "Not expression"
  refusal, and GTEx is the wrong panel for immune activation. Snaptron's
  `srav3h` is the same code path if it is ever scoped that way.
- `cc_subcellular_location`, the other half of the multimer-and-location idea.
  Adding it to `ENTRY_FIELDS` means refetching `data/uniprot_isoforms.json`
  for all 10,683 entries.
- Labelling self-partners in the interface rows, proposed by a review as new.
  `partnerName` in `web/lib/loss.ts` already renders "GENE (itself)".
