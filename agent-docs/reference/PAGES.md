---
name: pages
description:
  "What each page of Isoform explorer shows and why it is laid out that way:
  home, browse, the gene page, the blog and the disease pages. Read before
  adding or changing a page."
---

# Pages

[CLAIMS.md](CLAIMS.md) holds what a page may not say, and [DATA.md](DATA.md) the
files a page reads.

- **Home:** modelled on Interface explorer's hero: a short headline, one
  sentence saying what the site shows, and a simple diagram (a canonical
  protein, and an isoform with its domain missing), then a picture of one gene
  (`site/preview.png`: RAD51C, `figures/home-hero/`, linked to its page and
  hidden on phones). It is a three-row schematic (the residues that contact
  XRCC3, the canonical bar, isoform 2's bar) above two AlphaFold backbone
  models, with the same colours in both: teal for residues isoform 2 has,
  salmon for residues it lacks, blue for contacts, gold for the partner. Greys
  for the first two were tried and dropped, because dark and pale grey both
  read as plain protein and did not separate the parts. The full gene-page map
  was tried first and dropped, because its pLDDT, exon and domain rows gave
  the reader too much to map onto the 3D. The isoform's panel has no partner,
  because its model is of the isoform alone, and the picture says "keeps 5 of
  those 60 contacts", never that it does not bind (see
  [CLAIMS.md](CLAIMS.md)). Isoform 2's model is aligned to the canonical's
  on residues 90–134, beside the interface, where they agree to 1.1 Å; over
  residues 1–134 they differ by 10 Å (checked 2026-11-17), because the
  N-terminal lobe sits differently in the isoform's own model.
  `pnpm home-hero` writes the data and
  `pnpm heroes preview` takes the picture. Search (gene, UniProt accession,
  ENST, NM) has its own page, linked from the header: the owner found a search
  box front and center discouraging to visitors who first want to know what
  the site is about. Then "Start from a disease": eight familiar disease
  names (`FAMILIAR` in `web/pages/index.astro`, checked against
  `diseases.json` at build) and a link to the full list. Then a card per blog
  post with its hero, cropped to 7:4 (`heroPosition: 'left'` in a post's
  frontmatter keeps a wide drawing's title in the crop), and a closing
  note that the site compares sequences and points to the expression post
  rather than straight to GTEx, whose per-transcript numbers that post shows
  can mislead. The home page has no tiles of counts: the owner found them
  noisy and visitors prefer pictures; About and Browse keep the totals.
- **Browse:** one sortable, filterable row per protein from `index.json`. The
  "Domains lost whole, none cut" column counts the protein's isoforms missing
  at least one whole domain or region while leaving none partly missing, which
  narrows a search to losses that stop at a unit's edge. It covers the
  `domains` group alone, which is a scope choice rather than a claim that the
  distinction is empty elsewhere: `targeting` spans a signal peptide and a
  transmembrane segment, where whole against cut means as much, and a counted
  isoform may well cut one. What the column does not say is in
  [CLAIMS.md](CLAIMS.md).
- **Gene page (`/gene/<page>/`):** one per protein, one anchored section per
  isoform (`#P04637-2`), so a transcript search lands on its isoform.
  - A map: canonical feature rows, pLDDT band and partner-interface rows above
    one row per isoform drawn on canonical coordinates. The pLDDT band is a
    grey ramp, darker where the model is more confident, with the same four
    thresholds as before. Its original blue-to-orange colours outshouted the
    isoform bars, which are what the page is about, so they are one click away:
    a second CSS-only toggle beside Protein / Gene + protein ("pLDDT in grey",
    "pLDDT in AlphaFold colours") swaps the `--b*` variables on `:root`, which
    repaints the band and the legend swatches together. It is not remembered
    between visits, and there is no "hidden" option because the row would
    leave a gap in the map.
  - A Protein / Gene + protein toggle (CSS only; Protein by default). The gene
    view draws each isoform's transcript, introns at a fixed width, above the
    map, with a band joining the canonical's coding exons to its residues; it
    exists so splicing that cuts inside an exon (an alternative acceptor or
    donor) can be seen rather than explained.
  - `#subunit`, above the isoform sections: UniProt's entry-level SUBUNIT
    comments, where the entry has any (7,481 pages). The nearest the site comes
    to the multimer question, and it comes no nearer than quoting. It carries
    no modelling disclaimer of its own: the interface rows further down say
    "Each isoform was modelled alone" where that applies, and repeating it here
    would have been false on the 2,353 pages that do show predicted
    interfaces, since those come from AlphaFold DB complexes of the canonical.
  - Per isoform, the answer first as a sentence. Topological domains are left
    out of it, because a two-residue deletion read "cut: Cytoplasmic
    (399–821)"; they stay in the detail list. Each clause names at most three
    features, and the sentence is long where many regions overlap (TP53
    P04637-2 runs to four clauses); shortening it was declined, because
    dropping a clause hides a loss. Then the losses grouped under
    the edit that causes them, then transcripts, UniProt's note and links
    (UniProt, Ensembl, RefSeq, AlphaFold DB, isoform superposed on canonical in
    JBrowse, transcripts on the genome).
  - A link to Interface explorer for proteins with a disease annotation
    (`https://cmdcolin.github.io/interface-explorer/genes/?q=<gene>`), which is
    where ClinVar variants live. This site does not show variants.
- **Blog (`/blog/<id>/`):** worked examples, one isoform per post, written in
  MDX in `web/content/blog/`. Nine posts: PAR3, NDUFC2, ZDHHC16, PKM, CEBPB,
  SMN, the junction post ("Exploring tissue-specific splicing"), CD22 and
  CD19. Titles lead with the biology, and titles, descriptions and headings
  avoid giving things agency (the anti-ai-writing-tropes checklist in
  `~/src/claudish`). Numbers and the quoted answer sentence come from
  the gene record through `web/lib/stories.ts`, so they follow the data. Each
  post has a hero of a different kind, drawn for it and retaken by
  `pnpm heroes` from a `figures/` page: a topology drawing generated from
  UniProt features (`web/lib/topology.ts`), the bases of an exon with its two
  splice acceptors and the codons between them (`web/lib/acceptor-figure.ts`,
  bases from `pnpm illustration`), a bead chain with the active-site
  palmitate as a skeletal formula (`web/lib/active-site-figure.ts`), an mRNA
  with ribosomes on its start codons and the proteins they make
  (`web/lib/start-codons-figure.ts`, coordinates from RefSeq in
  `web/lib/posts-data.ts`), an anatomical drawing of a motor neuron from
  spinal cord to muscle (`web/lib/motor-neuron-figure.ts`), a chart of
  GTEx data, and an illustration of a PDB structure in David Goodsell's style
  (`src/illustration.ts` extracts the atoms, `web/scripts/illustrate.ts` draws
  them), and a grid of antibody contact residues per isoform under CD22's
  domain map (`web/lib/contact-grid-figure.ts`, contacts from
  `src/epitopes.ts`), and an Euler diagram of CD19's transcripts in GENCODE
  and UniProt, each drawn as an exon glyph from GENCODE coordinates, with the
  exon 2-skipped mRNA outside both (`web/lib/transcript-sets-figure.ts`,
  transcripts from `src/gene-transcripts.ts`). Screenshots of the gene page and
  of JBrowse appear inside posts as figures, never as heroes. A new post needs a
  hero unlike all of these; the owner drops a post whose hero would not be new.
  A post may cite literature and public expression data to say where an isoform
  is made, attributed to its source; the rules in [CLAIMS.md](CLAIMS.md) still
  hold for every sentence the site generates. GTEx transcript TPM is never
  quoted alone: `pnpm expression` also counts reads across the isoform's own
  splice junction, because the two can disagree completely (NDUFC2 isoform 4:
  about 39% of the gene by TPM, 49 junction reads in all of GTEx; PKM M1 the
  other way, 95% of junction reads in skeletal muscle and under 4% by TPM). The
  junction tallies are our count of public data, and posts say so.
- **Diseases (`/diseases/`, `/disease/<slug>/`):** UniProt's disease
  comments for the proteins on the site, from `pnpm diseases`
  (`site/data/diseases.json`): 4,451 diseases over 3,154 proteins. A disease
  page quotes UniProt's description
  and, for each protein UniProt links to it, UniProt's note on the link
  verbatim ("The disease is caused by variants affecting…", "may be
  caused…", "susceptibility…"), the gene map and each isoform's answer
  sentence. The site says nothing about whether an isoform matters for the
  disease; ClinVar variants stay on Interface explorer. Diseases are grouped by
  body system or process (`SYSTEMS` in `src/types.ts`: a label per MONDO
  class, matched through the disease's OMIM id and every MONDO ancestor), as
  chips that filter the list (`/diseases/?group=brain`); a disease page lists
  its groups and the other diseases in its OMIM phenotypic series, as
  Interface explorer does. A note longer than one
  sentence shows its first sentence and opens to the rest. Search matches
  disease names, acronyms and genes by word (`search/diseases.json`), so a
  visitor can type "cystic fibrosis". Gene pages link their
  diseases, and posts may name a disease to explain a gene to a lay reader,
  attributed to UniProt.
- **About:** scope, sources, each rule above, and what is left out.
