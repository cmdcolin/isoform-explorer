# Isoform explorer

Explore human protein isoforms beside their canonical proteins.

A static site for looking up an Ensembl (ENST) or RefSeq (NM) transcript, a gene
symbol or a UniProt accession and comparing the isoform it encodes with the
canonical protein in residues, UniProt features, confidently modelled structure
and predicted partner interfaces. It covers the isoforms described by every
reviewed human UniProt entry that has an alternative isoform. It compares
sequences; for where an isoform is made, the blog post
[Where is an isoform made?](https://cmdcolin.github.io/isoform-explorer/blog/2026-11-16-where-isoforms-are-made/)
lists the public data to check.

A sibling of
[Interface explorer](https://cmdcolin.github.io/interface-explorer/), which
covers ClinVar variants on predicted interfaces. Once deployed, the site will be
at <https://cmdcolin.github.io/isoform-explorer/>.

- [docs/running.md](docs/running.md): building the data and the site.
- [handoffs/design.md](handoffs/design.md): what each page says, where every
  number comes from, and what the site does not claim.
