import { expect, test } from 'vitest'

import { classifier, parseObo } from './mondo.ts'

const OBO = `format-version: 1.2

[Term]
id: MONDO:0005071
name: nervous system disorder

[Term]
id: MONDO:0004995
name: cardiovascular disorder

[Term]
id: MONDO:1000001
name: long QT syndrome
xref: OMIMPS:192500
is_a: MONDO:0004995

[Term]
id: MONDO:1000002
name: long QT syndrome 1
xref: OMIM:192500
is_a: MONDO:1000001

[Term]
id: MONDO:1000003
name: retired term
xref: OMIM:999999
is_a: MONDO:0005071
is_obsolete: true
`

test('a disease takes the groups of every MONDO ancestor and its OMIM series', () => {
  const classify = classifier(parseObo(OBO))
  expect(classify('192500')).toEqual({
    systems: ['heart'],
    series: { id: 'PS192500', name: 'long QT syndrome' },
  })
})

test('an obsolete or unknown OMIM id has no group', () => {
  const classify = classifier(parseObo(OBO))
  expect(classify('999999')).toEqual({ systems: [], series: null })
  expect(classify('')).toEqual({ systems: [], series: null })
})
