---
name: claims
description:
  "What Isoform explorer refuses to claim, and the reason behind each refusal.
  Read before writing any sentence a visitor will see, or adding a column, a
  count or a figure."
---

# What the site does not claim

Interface explorer withheld a 3D distance from pathogenic sites to
interfaces because the sites sat in pLDDT < 50 regions and the number
invited a proximity story. The same standard applies here. `design.md` says
what the site is for, and `reviewed-out.md` lists the features these rules
ruled out.

- **No consequence.** The site lists what the sequence lacks. It never says an
  isoform is non-functional, mislocalised, secreted, soluble, degraded or
  dominant negative, except by quoting UniProt's note.
- **Replaced is not lost.** An isoform's abutting UniProt edits are first
  joined into one; each edit is then a swap, its removed residues `replaced`,
  when after trimming the ends it shares with the canonical it adds at least
  half as many residues as it removes (`SWAP_SHARE` in `src/isoforms.ts`);
  otherwise they are `missing` and the added ones only `novel`. A swap
  (mutually exclusive exons, an alternative terminus of similar length) reads
  "has N different residues in place of M residues"; the lost-feature counts on
  the home page and browse table use `missing` only. The verb is "has": the
  sentences say "has N different residues in place of M residues of …", never
  "swaps … for", "inserts" or "carries".
- **Counts by confidence, never "no fold".** pLDDT is the prediction's
  confidence, not a measurement of folding. For the residues an isoform lacks,
  give the counts: of the M missing (or replaced) residues, N are confidently
  modelled (pLDDT ≥ 70) in the canonical model and K are below pLDDT 50. Never
  summarise a stretch as folded or unfolded: a majority below 50 can sit beside
  a confidently modelled domain that is lost with it (BRCA1 isoform 2 lacks
  both BRCT domains).
- **A kept interface is not binding.** No isoform was modelled with a partner.
  A full circle means the residues are present, nothing more.
- **An entry's subunit note is the entry's.** UniProt's SUBUNIT comments that
  name no isoform are quoted verbatim on 7,481 gene pages, under their own
  heading above the isoform sections and never inside one, because they are
  about the entry: "Homodimer" is not a statement about a particular isoform.
  `subunitNotes` in `src/uniprot.ts` takes only the comments without a
  `molecule`, which `notesByMolecule` drops; the ones naming an isoform keep
  going where they already went. Nothing is filtered, the
  "(Microbial infection)" paragraphs included, and the site adds no reading of
  its own — where UniProt names an isoform (CD22's "heterodimer of isoform
  CD22-beta and a shorter isoform"), that is UniProt's words, not a claim the
  site computed. The heading names the contents, "UniProt on subunits and
  partners", because 3,125 of the notes carry no assembly or stoichiometry
  word at all and 1,947 of those are an "Interacts with" line; a heading
  promising assembly would claim what the quote does not say. Over
  `SUBUNIT_WORDS` the block collapses: TP53's note is about a thousand italic
  words, and it should not stand between the reader and what the site computes.
  Two things this bullet does not cover. A comment whose `molecule` names a
  processed chain rather than `Isoform N` reaches neither path and is on no
  page (56 of them; APP's notes on amyloid-beta 40 and 42, C83 and C99),
  because `src/isoforms.ts` looks notes up by `Isoform ${name}` — longstanding,
  not new here. And the site does not deduplicate across the two paths, so
  where UniProt files the same sentence both ways it appears twice (SLC4A8
  Q2Y0W8, "Homodimer.", on the entry and on isoform 4; the only one).
- **An antibody contact is a residue, not an epitope.** The CD22 post (and any
  later page) counts the canonical residues with a protein atom within 5 Å of
  a Fab's protein atoms in a crystal structure, and says "contact residues
  present in this isoform: N of M", never "epitope intact" or "binds". Sugars
  are not in the count; `src/epitopes.ts` reports separately which modelled
  sugars (each attached to the Asn whose ND2 lies within 2 Å) come within 5 Å
  of the Fab. With several copies in the asymmetric unit, each target copy
  is paired with the Fab touching it most and the count uses the residues every
  copy has; contacts with a neighbouring copy's Fab are crystal packing. An
  isoform whose edits fall outside the residues a structure resolves gets
  "differs from the canonical only outside the structure", and every count
  carries the fixed caveat. `epitopes.md` has the wording and the method.
- **Losing confidence is a model's opinion.** pLDDT is the prediction's
  confidence, not a measurement of folding. Say so beside the number.
- **Not expression.** The site computes and asserts nothing about expression:
  no GTEx, no tissue claims, no "major isoform" of its own. UniProt's notes are
  quoted verbatim and attributed, including where UniProt mentions expression
  ("A major isoform"). The MANE Select transcript is marked because it is a
  fact about annotation; when it encodes a non-canonical isoform, the page says
  so, since "loses" is measured against UniProt's canonical.
- **GENCODE's decay type is GENCODE's.** Each Ensembl transcript GENCODE 49
  types `nonsense_mediated_decay` carries that term, verbatim and attributed,
  as MANE Select is marked. Only when every Ensembl transcript of an isoform is
  in GENCODE 49, of that type and with a complete coding sequence (no
  `cds_start_NF` or `cds_end_NF` tag) does the isoform's Transcripts entry say
  so in a sentence, with GENCODE's rule (coding sequence ending more than 50
  bases before a downstream splice site). Never paraphrase it as degraded, not
  made or predicted NMD. A mixed isoform gets the inline marks only: there the
  type often reflects a spliced 3′ UTR, not the protein (ADARB1).
- **A whole domain is a span, not a brick.** "Domains lost whole, none cut"
  compares the isoform's missing residues with UniProt's feature spans, and
  UniProt's edges are one source's call: Pfam and InterPro place the same
  domain a few residues either way. It says only that no domain or region is
  left partly missing — not where the deletion falls. Most isoforms it counts
  have an edit reaching a terminus, so they are truncations, and over half lose
  no `Domain` feature at all, qualifying on a Region, Motif, Coiled coil,
  Repeat or Zinc finger. Many cut a targeting feature partway (ABCC6 O95255-2
  loses 19 of a 21-residue transmembrane segment and is still counted). Browse
  carries the classification because a filter is a search aid; the gene page
  keeps the numbers ("missing in full: Ig-like V-type (domain, 19–135)"). Never
  read it as a deletion that falls between units, or as a protein that still
  works.
- **Not novel transcripts.** Only isoforms UniProt describes. A transcript not
  mapped to one has no page; About says so, and a gene page gives the size of
  the gap (`codingNote` in `web/lib/labels.ts`, 8,824 of 10,587 pages): GENCODE
  49 lists N complete protein-coding transcripts of the entry's Ensembl genes
  and UniProt maps M of them to an isoform there. A count of GENCODE's
  annotation, like the MANE Select mark, and no more than that: the unmapped
  transcripts are not named, not drawn and not claimed to encode a distinct
  protein. Many differ only outside the coding sequence, and GENCODE 49 is deep
  for some genes (LRRFIP2 has 306 against 29 mapped), so a wide gap is not
  evidence of missing biology. Three things the sentence has to keep saying,
  because each was wrong in a first draft: "no page here" rather than "not on
  this site", since `site/data/search/` finds those ids and the site's own
  JBrowse draws them; "complete", since `cds_start_NF` and `cds_end_NF`
  transcripts are left out and a reader checking Ensembl sees a larger number
  (About defines the term); and that GENCODE's other types are outside the
  count, since UniProt maps an NMD or retained-intron transcript to a shown
  isoform on 1,592 pages, which would otherwise read as a contradiction of the
  Transcripts lists on the same page. Where UniProt lists more than one
  Ensembl gene (99 pages show the note), the genes are named as GENCODE names
  them, the page's own first: genes sharing a name on different chromosomes
  once with both places ("AKAP17A on chrX and chrY", the pseudoautosomal
  copies), and genes GENCODE tags `readthrough_gene` as "the readthrough gene
  FXYD6-FXYD2", by ENSG id when GENCODE gives them no symbol of their own or
  one another gene has (PDE4C). "Readthrough" is GENCODE's tag on the other
  gene and says nothing about the page's protein.
