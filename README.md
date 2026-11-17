# Isoform explorer

Explore human protein isoforms beside their canonical proteins.

A static site for looking up an Ensembl (ENST) or RefSeq (NM) transcript, a gene
symbol or a UniProt accession and comparing the isoform it encodes with the
canonical protein in residues, UniProt features, confidently modelled structure
and predicted partner interfaces. It covers the isoforms described by every
reviewed human UniProt entry that has an alternative isoform. It compares
sequences; for where an isoform is made, the blog post
[Exploring tissue-specific splicing](https://cmdcolin.github.io/isoform-explorer/blog/2026-11-16-where-isoforms-are-made/)
lists the public data to check.

A sibling of
[Interface explorer](https://cmdcolin.github.io/interface-explorer/), which
covers ClinVar variants on predicted interfaces. Once deployed, the site will be
at <https://cmdcolin.github.io/isoform-explorer/>.

- [docs/running.md](docs/running.md): building the data and the site.
- [agent-docs/ARCHITECTURE.md](agent-docs/ARCHITECTURE.md): what the site is
  for, the one question every page answers, and a map to the rest of the agent
  documentation — what the site refuses to claim, what each page shows, the
  files the pipeline writes, and the parked ideas.
