---
name: interface-explorer-does-not-link-back
description: A gene page links out to Interface explorer for proteins with a disease annotation, and Interface explorer links nowhere in return, so a visitor who starts there never learns this site exists. The edit lands in the sibling repository, not this one.
---

# Interface explorer does not link back

`interfaceExplorerHref` in `web/lib/site.ts` puts a link on every gene page
whose protein has a disease annotation, pointing at that protein on
[Interface explorer](https://cmdcolin.github.io/interface-explorer/), which is
where ClinVar variants live. Nothing points the other way.

Interface explorer covers isoforms only for proteins with a disease
annotation, about a third of those that have any, so for the rest of them this
site is the only place with an isoform page at all. A visitor who arrives at
Interface explorer with a transcript has no way to find it.

**Where the work goes:** `~/src/interface-atlas`, not here. It needs that
site's own page list joined to this one's accessions, the same way
`src/isoforms.ts` reads Interface explorer's published `genes.json` and
`isoforms.json` to build the outbound link. The deployed
`site/data/index.json` here is the file to match against.
