---
name: open-questions
description:
  'The small things still open on Isoform explorer, and the post ideas waiting
  for a new kind of hero. Read when looking for the next piece of work.'
---

# Open

Nothing here blocks anything. `reviewed-out.md` lists what was decided against,
and `epitopes.md` holds the one planned feature that is waiting on the
collaborator.

## Small

- The first sentence for isoforms with many overlapping regions is long (TP53
  P04637-2 runs to four clauses). Each clause names at most three features, and
  dropping a clause would hide losses, so it has been left alone.
- pLDDT is rounded per residue before thresholds and means, so a count or a
  mean can differ by one from AlphaFold DB's own page. Fixing it means
  refetching every model's pLDDT on ada.
- Interface explorer does not link back to this site. That change belongs in
  `~/src/interface-atlas`.

## Posts with a hero unlike the existing ones

`pages.md` lists the kinds of hero already used and the rule about repeating
one.

- LEF1 isoform 7, which lacks every predicted β-catenin contact: a Wnt pathway
  cartoon.
- NDUFV3, whose MANE Select transcript encodes 473 residues against UniProt's
  canonical 108: a ruler drawn to scale.
