---
name: handoffs-index
description: Index of every live thread in handoffs/, with what each one is still waiting on. Read before starting a review or an audit of something a thread already covers.
---

# Handoffs index

A handoff is the live state of an **unfinished** thread — a review, an audit or
a spike whose findings nobody has committed to yet. It holds pointers, not
content, and it is **deleted** when the thread lands: the remainder is filed as
a proposal in [ideas/](../ideas/README.md), a settled fact in
[reference/](../reference/README.md), or a sentence with its reason at the
place that would re-try it ([CLAUDE.md](../CLAUDE.md)). Git already holds what
a session did.

**The directory being empty is the normal state.** A handoff is the fastest doc
here to go stale, so re-read its "next" list against main before editing one:
the previous session may have landed half of it.

> **Generated — don't hand-edit the table.** `pnpm docs-index` rewrites it from
> each doc's `description:` frontmatter (`src/docsIndex.ts`), so fix the doc a
> row is wrong about, not the row. `pnpm docs-index --check` fails CI on a
> stale table or a doc carrying no frontmatter.

<!-- BEGIN GENERATED INDEX -->

_None right now._

<!-- END GENERATED INDEX -->
