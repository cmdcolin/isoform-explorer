---
name: ndufv3-post-on-a-mane-isoform-four-times-the-canonical
description: NDUFV3's MANE Select transcript encodes 473 residues against UniProt's 108-residue canonical, so the page measures losses against the shorter form; a post could use it to explain what "canonical" means, with a scale ruler as its hero.
---

# A post on NDUFV3, where MANE Select is four times the canonical

NDUFV3's MANE Select transcript encodes 473 residues; UniProt's canonical is
108. The gene page marks the MANE transcript and says it encodes a
non-canonical isoform, because every loss on the site is measured against
UniProt's canonical ([CLAIMS.md](../../reference/CLAIMS.md), "Not expression").
It is the sharpest case of the two annotations disagreeing about which protein
is the main one, and 1,005 proteins have some version of it
(`maneSelectNotCanonical` in `site/data/totals.json`).

**Hero:** the two forms drawn as a ruler to scale, a kind the blog does not
have.

**What the post is actually about:** that "canonical" is UniProt's choice and
"MANE Select" is a different body's choice, and the site measures against the
first while marking the second. It is the one piece of vocabulary a visitor
most needs and the site currently only implies.

**Check before writing:** that UniProt still has 108 as canonical for NDUFV3,
since an entry's canonical can change between releases, and that the numbers
come from the gene record through `web/lib/stories.ts` rather than being typed
in ([CLAUDE.md](../../CLAUDE.md)).
