---
name: epitope-rollout-to-more-structures
description: The CD22 contact-residue spike runs on two hardcoded PDB entries. Rolling it out needs a way to know which entries are antibody complexes at all, and the owner first has to hear whether the CD22 result answered the collaborator's question.
---

# Epitope rollout to more structures

[EPITOPES.md](../../reference/EPITOPES.md) has the method and the CD22 result.
The spike reads `STRUCTURES` in `src/epitopes.ts`, two entries typed in by hand.

**What it waits on:** the collaborator's answer. The spike was built to show
one contrast — a membrane-proximal binder every isoform keeps (m971 on d7)
beside a distal one some isoforms cut (epratuzumab on d2–d3). Whether that
answers "when is an isoform in play" is theirs to say, and
[IG_COLLABORATION.md](../../reference/IG_COLLABORATION.md) records that they
doubted a database could.

**The hard part is not the contact call.** It is knowing which PDB entries are
antibody complexes. Detecting them from the structure fails both ways: 5VL3's
Fab chains carry UniProt accessions (S6B291, Q8TCD0), so "no UniProt id means
antibody" misses them, and plenty of non-antibody partners have none.

**First move:** start from a curated list rather than detection. SAbDab and
Thera-SAbDab both publish therapeutic-antibody complexes with their targets.
Join that to the site's accessions, keep the entries whose target aligns to a
protein with an alternative isoform, and feed them into `STRUCTURES` unchanged
— the copy pairing in `copyContacts` is what made 5VL3 come out right, and it
is the part that generalises.

**What would have to be decided before it ships as a page.** The spike's
numbers live in a blog post, where prose carries the caveats. A gene-page
version needs a place for the fixed caveat beside every count, and a rule for
an entry with several structures over the same isoform that disagree.
