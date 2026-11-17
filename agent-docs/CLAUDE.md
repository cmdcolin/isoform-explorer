# Agent documentation

Top level is `ARCHITECTURE.md` and this file. `ARCHITECTURE.md` is a map that
routes to the doc holding the depth, plus the one question and what counts as a
loss, which every other doc assumes. Everything else is filed:

- `reference/`: settled. How a part of the site works, how it is operated, what
  it refuses to claim. `UPPER_SNAKE.md`.
- `ideas/`: one parked proposal per file, real defects included, in the
  subfolder naming what it waits on. `kebab-case.md`. A verdict leaves `ideas/`
  as a change plus a sentence in `reference/`, or as a deletion.
- `handoffs/`: live state of an unfinished thread, as pointers rather than
  content. Deleted when the thread lands;
  [handoffs/README.md](handoffs/README.md) says how. Empty is the normal state.
- Something tried and declined gets a sentence, with the reason, at the place
  that would re-try it, and no shelf of its own. `reference/CLAIMS.md` carries
  most of them, because most declined features were declined for claiming more
  than the data showed.
- Git history holds what a session did, so no doc restates it. "State as of
  \<date\>" belongs in `handoffs/` only, and a dated check (
  "checked 2026-11-16") belongs beside the number it verified.
- Every doc carries `name:` and `description:` frontmatter. The description is
  its row in an index and the one line a reader uses to decide whether to open
  it, so write what the doc settles, or for an idea what it waits on — not what
  it is "about".

## Generated indexes

`pnpm docs-index` rewrites the table in each `README.md` from the
`description:` of the docs beside it, and `pnpm docs-index --check` fails when
one is stale. Fix the doc a row is wrong about, not the row.

## Working in this repo

The rules for the work itself, with their reasons, are
[ARCHITECTURE.md](ARCHITECTURE.md)'s house rules. Only what an agent gets wrong
*silently* is here:

- **`data/` is a download cache, `out/` is intermediate, `site/data/` is
  committed.** An rsync with a bare `--exclude data` also drops `site/data`;
  exclude `/data` instead, and read
  [reference/BUILD_SERVER.md](reference/BUILD_SERVER.md) before regenerating
  `site/data`, because a run with a cold cache silently writes blanks.
- **Markdown here is wrapped by hand at 80 columns.** `.prettierignore` keeps
  prettier off it, so nothing reformats what you write.
- **A `description:` is a row in a generated index**, so it reads as one line
  of prose, not a heading.
