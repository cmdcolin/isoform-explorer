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
- [handoffs/design.md](handoffs/design.md): what the site is for and what counts
  as a loss; it lists the handoff files below.
- [handoffs/claims.md](handoffs/claims.md): what the site does not claim.
- [handoffs/pages.md](handoffs/pages.md): what each page shows.
- [handoffs/data.md](handoffs/data.md): the files the pipeline writes.
- [handoffs/reviewed-out.md](handoffs/reviewed-out.md): what the site was asked
  to show and does not, with the reason each one failed.
- [handoffs/open-questions.md](handoffs/open-questions.md): what is still open.
- [handoffs/build-server.md](handoffs/build-server.md): where downloads, full
  builds and the full suite run.
- [handoffs/deploy.md](handoffs/deploy.md): how the site is published and how
  its JBrowse links load.
- [handoffs/epitopes.md](handoffs/epitopes.md): antibody contact residues across
  isoforms.
- [handoffs/ig-collaboration.md](handoffs/ig-collaboration.md): the Ig-domain
  collaboration and what came out of it.
