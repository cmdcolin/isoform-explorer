---
name: deploy
description:
  'How the site is published, how its JBrowse links load, and the two branches
  not on main that the owner has to decide about. Read before pushing, before
  changing a JBrowse link, or before deleting a branch.'
---

# Deploying the site

- The repository is https://github.com/cmdcolin/isoform-explorer (public).
  `.github/workflows/pages.yml` builds Pages on every push to main and serves
  https://cmdcolin.github.io/isoform-explorer/. The owner pushes; sessions
  commit to main and stop there.
- Every JBrowse link loads `jbrowse/config.json` from the deployed site, so a
  config change reaches the links only after a push.
- The config keeps GENCODE's track (`hg38-gencodeComp`) so that an isoform with
  an ENST and no RefSeq id can open. GENCODE's GFF3 has no `Name` attribute, so
  the track's label expression shows `gene_name` on genes and the transcript id
  on transcripts; without it, genes read as ENSG ids.
- An isoform link opens a protein view with the connected genome view on
  GENCODE's track when the transcript is an ENST, and on RefSeq's otherwise
  (`transcriptTracks` in `src/links.ts`). Seen working in headless Chrome on
  2026-11-16 with AAMDC Q9H7C9-3 (ENST00000532481.5, no RefSeq id): both
  AlphaFold models superposed and the GENCODE V49 track shown, with no console
  errors.
- A gene page's genome link opens RefSeq's track only. GENCODE's can be turned
  on from the track list, and the CD19 post says so. Switching it on by default
  would change every gene page; ask the owner first.

## Branches not on main

`blog` (worktree `~/src/isoform-explorer-blog`) and `gtex-post-retitle`
(`~/src/isoform-explorer-retitle`) hold commits that are not on main by patch
id, though main already has the posts and the retitle they describe. Ask the
owner before deleting or building on either.
