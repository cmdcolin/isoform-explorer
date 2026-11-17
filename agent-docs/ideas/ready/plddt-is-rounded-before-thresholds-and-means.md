---
name: plddt-is-rounded-before-thresholds-and-means
description: The pLDDT cache stores one rounded integer per residue, so a count of residues at or above 70 and a mean pLDDT can each differ by one from what AlphaFold DB's own page shows for the same model.
---

# pLDDT is rounded per residue before thresholds and means

`data/plddt/` holds one integer per residue. A residue AlphaFold DB scores
69.6 is cached as 70 and counted as confidently modelled; the mean of the
rounded values is not the mean of the originals. So a gene page's count of
confidently modelled residues, and any mean it shows, can each be one off what
AlphaFold DB's page gives for the same model.

Nothing on the site is wrong by its own definitions, which are stated in terms
of the cached values, and each residue moves by less than one. How far a count
over many residues can drift has not been measured. A reader comparing a page
with AlphaFold DB has no way to know why the numbers differ.

**Cost of fixing it:** storing the unrounded values means refetching every
model's pLDDT, which is the slow path — AlphaFold DB's file server throttles,
and `pnpm plddt` pauses between requests and for five minutes after a failure
(`docs/running.md`). That is days of wall-clock on ada for a one-residue
correction, which is why it has not been done.

**Cheaper first move:** say so where the number appears, as About already does
for pending models.
