---
name: build-server
description:
  'Where downloads, full builds and the full test suite run (ssh host ada), how
  to sync a worktree there, and what to check before committing site/data. Read
  before running the pipeline, a full build or the full suite.'
---

# Working on the build server

- Edit and run single-file tests on the laptop. Run downloads, full builds,
  the full suite, typecheck and `pnpm check-links` on ada, once at the end of a
  piece of work.
- ada keeps the repository at `~/src/isoform-explorer` with its own `data/`
  and `out/`. Build a worktree in a directory under
  `~/src/isoform-explorer-builds/` with `data` and `node_modules` symlinked to
  that checkout's.
- Sync with `rsync -a --delete --exclude /data --exclude /out --exclude
  node_modules --exclude .git`. A bare `--exclude data` also drops
  `site/data`.
- Graphviz `dot` is installed on ada; the `/architecture` page and
  `web/lib/architecture.test.ts` need it.
- ada's `data/` can be ahead of the laptop's (its `data/plddt/` was). Before
  `pnpm isoforms` on the laptop, copy what ada has with
  `rsync -a --ignore-existing ada:src/isoform-explorer/data/<dir>/ data/<dir>/`.

## Before committing site/data

Commit `9d915dcb` wrote `site/data` from a run without `out/interfaces.json`,
and every partner interface was blank on main until it was regenerated. Check:

- `totals.json`'s `interfaceProteins` is not 0, and `modelsPending` is no
  higher than main's;
- `git diff` on `site/data` touches only what the change should; a
  field-by-field comparison against `git show HEAD:<file>` is quick in Python.

## Formatting

- Prettier ignores `*.mdx`, because it splits `{' '}` across lines and breaks
  the build.
- Don't run prettier on `handoffs/*.md`; they aren't formatted to the repo
  config, and it rewrites whole files.
