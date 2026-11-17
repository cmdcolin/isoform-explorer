---
name: ideas-index
description: Index of parked proposals, one per file, in the subfolder naming what each waits on. Read when looking for the next piece of work, and before proposing something that may already be parked here.
---

# Ideas

One proposal per file, including real defects nobody has fixed. A file says
what the problem is, what it would cost, and the first move — enough that
picking it up does not mean re-deriving it.

The subfolder names **what it waits on**:

- `ready/`: nothing blocks it; someone could start today.
- `waiting-on-someone-else/`: a person outside this repo has to answer or act
  first.

A verdict takes a file out of `ideas/`: either the work lands, and a sentence
about it goes into the `reference/` doc it changes, or it is declined, and a
sentence with the reason goes at the place that would re-try it
([CLAUDE.md](../CLAUDE.md)). Either way the file is deleted in the same pass.

Moving a file between subfolders changes its path, and nothing checks the
references to it, so grep before moving one.

> **Generated — don't hand-edit the table.** `pnpm docs-index` rewrites it from
> each doc's `description:` frontmatter (`src/docsIndex.ts`), so fix the doc a
> row is wrong about, not the row. `pnpm docs-index --check` fails CI on a
> stale table or a doc carrying no frontmatter.

<!-- BEGIN GENERATED INDEX -->

| Doc | What it proposes |
| --- | --- |
| [interface-explorer-does-not-link-back](ready/interface-explorer-does-not-link-back.md) | A gene page links out to Interface explorer for proteins with a disease annotation, and Interface explorer links nowhere in return, so a visitor who starts there never learns this site exists. The edit lands in the sibling repository, not this one. |
| [lef1-post-on-a-lost-partner-interface](ready/lef1-post-on-a-lost-partner-interface.md) | Three LEF1 isoforms each lack all 28 residues of the predicted β-catenin interface, a case no post has used yet, since no post is about a partner interface at all; the hero would be a Wnt pathway cartoon, a kind the blog does not have. |
| [ndufv3-post-on-a-mane-isoform-four-times-the-canonical](ready/ndufv3-post-on-a-mane-isoform-four-times-the-canonical.md) | NDUFV3's MANE Select transcript encodes 473 residues against UniProt's 108-residue canonical, so the page measures losses against the shorter form; a post could use it to explain what "canonical" means, with a scale ruler as its hero. |
| [plddt-is-rounded-before-thresholds-and-means](ready/plddt-is-rounded-before-thresholds-and-means.md) | The pLDDT cache stores one rounded integer per residue, so a count of residues at or above 70 and a mean pLDDT can each differ by one from what AlphaFold DB's own page shows for the same model. |
| [epitope-rollout-to-more-structures](waiting-on-someone-else/epitope-rollout-to-more-structures.md) | The CD22 contact-residue spike runs on two hardcoded PDB entries. Rolling it out needs a way to know which entries are antibody complexes at all, and the owner first has to hear whether the CD22 result answered the collaborator's question. |

<!-- END GENERATED INDEX -->
