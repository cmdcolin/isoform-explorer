# Running the pipeline and the site

Node 24 and pnpm; `pnpm install` first. The pipeline downloads many gigabytes
from UniProt and AlphaFold DB into `data/` and takes hours to days, so run it
and full site builds on a machine with disk to spare and a stable connection,
not a laptop. Downloads are cached in `data/` and every step can be rerun: it
picks up where it stopped.

## Pipeline

The steps write `out/` (intermediate) and `site/data/` (what the site reads,
committed). `pnpm all` runs the first two in order.

- `pnpm interfaces`: predicted partner interfaces from AlphaFold DB complexes,
  for every reviewed human protein with an alternative isoform. It first asks
  the AlphaFold DB API for each protein's complexes, keeps the confident ones
  (ipSAE threshold in `src/interfaces.ts`) and writes `out/interfaces.json`;
  `--api-only` stops there. It then downloads the structure (CIF) of each
  complex it has not cached, one at a time, to find the residues within contact
  distance of the partner. Pass accessions to run only those.
- `pnpm isoforms [workers] [accessions…]`: the isoform data. Downloads UniProt's
  reviewed human entries with alternative products, rebuilds each isoform's
  sequence from UniProt's alternative-sequence edits, places what each one lacks
  on the canonical sequence, attaches AlphaFold DB monomer models (list per
  protein from the API) with their cached pLDDT, and reads the interfaces from
  `out/interfaces.json`. It also caches Interface explorer's page lists and
  the GRCh38 places of the isoforms' Ensembl transcripts (one batched pass
  over Ensembl's REST API) and the exons of every isoform's transcripts
  (from GENCODE 49's GFF3, downloaded once to `data/`, about 120 MB, into
  `data/gencode_exons.json`, and their GENCODE transcript types into
  `data/gencode_types.json`), so a rerun needs no network. The canonical's
  exons number the map's Exons row; one transcript per isoform, the one
  closest to the canonical's, is drawn in the gene view. Writes `site/data/genes/`, `index.json`, `totals.json`
  and the search maps in `site/data/search/`. With accessions it
  rewrites only those gene files, not the totals. It ends by saying how many
  proteins' model lists and how many models' pLDDT are still pending.
- `pnpm proteome`: downloads AlphaFold DB's human proteome archive (a single
  large tar, fetched in eight resumable parts into `data/proteome/`) and
  extracts the pLDDT of every canonical full-length model the site needs,
  instead of fetching each model's confidence file. It also compares them with
  any already cached.
- `pnpm plddt [seconds]`: fetches the confidence (pLDDT) file of each remaining
  model, mostly the isoforms' own models that the proteome archive does not
  contain, one at a time with a pause between requests (20 s by default). After
  three failures in a row it stops; rerun it later.

Rerun `pnpm isoforms` after `pnpm proteome`, `pnpm plddt` or `pnpm interfaces`
to fold what they fetched into `site/data/`.

### The AlphaFold DB rate limit

AlphaFold DB's file server throttles clients that fetch steadily, answering 403
or 429 for minutes at a time. Both the complex structures (`pnpm interfaces`)
and the pLDDT files (`pnpm plddt`) come from it, so they fill in slowly, over
days rather than hours. The steps back off rather than fail: `pnpm interfaces`
waits a quarter of an hour after its API pass, then fetches one structure every
two seconds or more, rests for minutes when throttled and slows down each time;
`pnpm plddt` pauses between every request and for five minutes after a failure.
Until they finish, the site shows blanks rather than guesses: About counts the
models whose confidence is not fetched yet, and a protein whose complexes are
not downloaded simply has no interface rows.

## Site

An [Astro](https://astro.build/) site in `web/`, served from `site/` (data and
static files), with the base path `/isoform-explorer/`.

- `pnpm dev`: development server at <http://localhost:4321/isoform-explorer/>.
- `pnpm build`: writes the static site to `dist/`, one page per protein.
- `pnpm preview`: serves `dist/` as it will be deployed.
- `pnpm expression`: for each isoform in `CASES` in `src/expression.ts`, finds
  the splice junction its GENCODE transcript has and the canonical's lacks,
  counts reads across it and across the canonical junction from the same splice
  site in every GTEx v8 sample (Snaptron's `gtexv2`), and fetches GTEx's median
  transcript TPM. Writes `web/content/blog/data/expression.json`, which the
  blog posts read; responses are cached in `data/expression/`.
- `pnpm illustration`: for each entry in `ILLUSTRATIONS` in
  `src/illustration.ts`, downloads the PDB structure (cached in `data/pdb/`),
  keeps the heavy atoms of the protein and one ligand, turns them so the
  molecule lies flat to the viewer, and writes
  `web/content/blog/data/<name>-atoms.json`, which a `figures/` page draws. For
  each entry in `WINDOWS`, it fetches a stretch of GRCh38 from Ensembl REST
  (cached in `data/genomic/`) and writes `web/content/blog/data/<name>.json`.
- `pnpm heroes [name ...]`: after a build, retakes the blog's hero and figure
  screenshots in `web/content/blog/` with headless Chrome (`CHROME` overrides
  `/usr/bin/google-chrome`). The JBrowse shots load the deployed site's
  `jbrowse/config.json` and need the network. `PAGES=F2RL2,NDUFC2,PKM,ZDHHC16
  pnpm build` builds just the gene pages the shots use.
  A new post's hero must exist before the site builds, so take its first copy
  from `pnpm dev` (the `figures/` page at the same path), then retake it with
  `pnpm heroes <name>` after a build.
- `pnpm check-links`: after a build, checks that every internal link in `dist/`
  points at a file that exists.
- `pnpm test` and `pnpm typecheck`: unit tests (Vitest) and type checks of the
  pipeline and the site.
