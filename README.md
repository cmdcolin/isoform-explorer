# Isoform explorer

If this transcript is the one being made, what does the protein lose?

A static site for looking up an Ensembl (ENST) or RefSeq (NM) transcript, a gene
symbol or a UniProt accession and seeing what the isoform it encodes lacks
compared with the canonical protein: residues, UniProt features, residues the
AlphaFold DB model places with confidence, and predicted partner interfaces. It
covers every reviewed human UniProt entry that describes an alternative isoform,
and only the isoforms UniProt describes. It says nothing about expression.

A sibling of
[Interface explorer](https://cmdcolin.github.io/interface-explorer/), which
covers ClinVar variants on predicted interfaces. Once deployed, the site will be
at <https://cmdcolin.github.io/isoform-explorer/>.

- [docs/running.md](docs/running.md): building the data and the site.
- [handoffs/design.md](handoffs/design.md): what each page says, where every
  number comes from, and what the site does not claim.
