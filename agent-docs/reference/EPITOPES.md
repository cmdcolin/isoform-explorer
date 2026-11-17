---
name: epitopes
description:
  'Antibody contact residues projected onto isoforms: the wording the owner
  agreed, how src/epitopes.ts computes them, the CD22 result written up as a
  blog post, and what a rollout to more structures would need. Read before
  touching src/epitopes.ts, web/lib/epitope.ts or any epitope copy.'
---

# Antibody contact residues across isoforms

Built as a spike on CD22 (P20273) with two structures and written up as the
post `2026-11-16-cd22-antibody-contacts.mdx`. Nothing outside that post uses
it.

This is the scoped version of a feature declined in general form: an outside
reviewer asked for experimental (PDB) coverage of every isoform's absent
residues, which was not built, because most entries have no structure over the
residues in question and a partial structure invites the reader to read absence
of coverage as absence of the residues. "Differs only outside the structure" is
the rule that replaced it.

## Wording, agreed with the owner before the code

- The line is "Contact residues present in this isoform: N of M", where M
  counts only the contact residues the structure covers. Never "epitope
  intact" or "binds".
- Each contact residue is present, missing, or not covered by the structure.
  `contactStates` also separates the residues inside a swap as `replaced`,
  which the table reports with the missing ones.
- An isoform whose edits all fall outside the stretch a structure covers gets
  its count and "differs from the canonical only outside the structure
  (residues X–Y)". X–Y is the first to last resolved residue.
- Present residues within 3 of an edit are counted separately: "N of those
  within 3 residues of a missing stretch".
- The fixed caveat sits beside every count: "A crystal contact set is not the
  epitope: these are residues within 5 Å of the antibody in one structure.
  That an isoform keeps them says nothing about whether it folds the same way
  or binds."

[CLAIMS.md](CLAIMS.md) ("An antibody contact is a residue, not an epitope")
holds the rule in short.

## Method

- `pnpm epitopes` (on ada; it downloads) reads `STRUCTURES` in
  `src/epitopes.ts` and writes `web/content/blog/data/cd22-contacts.json`.
- The target is the polymer entity RCSB aligns to the accession
  (`data.rcsb.org/rest/v1/core/polymer_entity/<pdb>/<entity>`, SIFTS), and
  every other polymer entity is a binder. "No UniProt id means antibody" fails
  on 5VL3, whose Fab chains map to S6B291 and Q8TCD0.
- Binder chains are grouped into Fabs: each heavy chain with the light chain
  sharing the most residues with it. Each target copy is paired with the Fab
  it has the most residues within 5 Å of, and the residues in contact with any
  other Fab are crystal packing and reported only as a count. In 5VL3, copy R
  has 16 residues within 5 Å of copy Q's Fab.
- A contact is a target residue with a non-hydrogen ATOM record within 5 Å of
  one of the Fab's (`interfaceResidues` in `src/interfaces.ts`). HETATM groups,
  waters and alternate-location filtering are left out.
- Sugars are reported separately: each modelled sugar is attached to the Asn
  whose ND2 lies within 2 Å of it and tested against the paired Fab at 5 Å.
- `construct` records the crystallised sequence on UniProt numbering. 5VL3 has
  glutamine at four of CD22's N-glycosylation sites (67, 112, 135, 164), so
  only Asn101 and Asn231 could carry sugars in it.
- `web/lib/epitope.ts` projects contacts onto an isoform with the same UniProt
  edits the gene page uses (`contactStates`), and `sharedContacts` keeps what
  every copy in the asymmetric unit has.

## The CD22 result

- 7O52 (m971 Fab, d6–d7, 2.41 Å): every isoform has all 26 contact residues,
  but every isoform differs only outside 507–682, so the structure says nothing
  about any of their edits.
- 5VL3 (epratuzumab Fab, d1–d3, 3.1 Å, four copies with 32–35 contacts each):
  of the 30 residues every copy has, CD22-alpha has 19 and lacks the 11 in d3,
  and isoform 5 has 27. The sugar on Asn231 is within 5 Å of the Fab in all
  four copies, and every isoform has Asn231.

## Rollout, if the owner says the spike answered the collaborator

Only then. The hard part is knowing which PDB entries are antibody complexes.
Start from a curated list of therapeutic-antibody complexes (SAbDab or
Thera-SAbDab) rather than detecting them, keep `STRUCTURES` as the input, and
reuse the copy pairing, which is what made 5VL3 come out right.
