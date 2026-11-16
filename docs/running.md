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
  over Ensembl's REST API) and the exons of the canonical isoforms' transcripts
  (from GENCODE 49's GFF3, downloaded once to `data/`, about 120 MB, into
  `data/gencode_exons.json`), so a rerun needs no network. Writes `site/data/genes/`, `index.json`, `totals.json`,
  `examples.json` and the search maps in `site/data/search/`. With accessions it
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
- `pnpm check-links`: after a build, checks that every internal link in `dist/`
  points at a file that exists.
- `pnpm test` and `pnpm typecheck`: unit tests (Vitest) and type checks of the
  pipeline and the site.
