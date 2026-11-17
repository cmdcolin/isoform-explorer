---
name: reference-index
description: Index of the settled docs: how each part of the site works, how it is operated, and what it refuses to claim. Read the row that matches what you are about to change.
---

# Reference

Settled. A doc here describes how something works now, not how it got that way
— git history holds that. When a change makes one of these wrong, the change
and the doc land together.

A feature that was tried and declined is a sentence in the doc that would
re-try it, with the reason, rather than a shelf of its own
([CLAUDE.md](../CLAUDE.md)). [CLAIMS.md](CLAIMS.md) carries most of them.

> **Generated — don't hand-edit the table.** `pnpm docs-index` rewrites it from
> each doc's `description:` frontmatter (`src/docsIndex.ts`), so fix the doc a
> row is wrong about, not the row. `pnpm docs-index --check` fails CI on a
> stale table or a doc carrying no frontmatter.

<!-- BEGIN GENERATED INDEX -->

| Doc | What it settles |
| --- | --- |
| [build-server](BUILD_SERVER.md) | Where downloads, full builds and the full test suite run (ssh host ada), how to sync a worktree there, and what to check before committing site/data. Read before running the pipeline, a full build or the full suite. |
| [claims](CLAIMS.md) | What Isoform explorer refuses to claim, and the reason behind each refusal. Read before writing any sentence a visitor will see, or adding a column, a count or a figure. |
| [data](DATA.md) | The files the pipeline writes and the site reads, field by field, and the guarantee that regenerating them is deterministic. Read before changing src/types.ts or anything that writes site/data. |
| [deploy](DEPLOY.md) | How the site is published, how its JBrowse links load, and the two branches not on main that the owner has to decide about. Read before pushing, before changing a JBrowse link, or before deleting a branch. |
| [epitopes](EPITOPES.md) | Antibody contact residues projected onto isoforms: the wording the owner agreed, how src/epitopes.ts computes them, the CD22 result written up as a blog post, and what a rollout to more structures would need. Read before touching src/epitopes.ts, web/lib/epitope.ts or any epitope copy. |
| [ig-collaboration](IG_COLLABORATION.md) | The collaborator on Ig-domain immunotherapy targets (CD33, CD22): what they argued, the changes that came out of it, and the ideas ruled out. Read before proposing work framed around that collaboration. |
| [pages](PAGES.md) | What each page of Isoform explorer shows and why it is laid out that way: home, browse, the gene page, the blog and the disease pages. Read before adding or changing a page. |

<!-- END GENERATED INDEX -->
