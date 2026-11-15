import { expect, test } from 'vitest'

import { axisLabels, esc, percent, residueCount } from './html.ts'

test('escapes the characters that would break out of text or an attribute', () => {
  expect(esc(`<a href="x">Tom's & co</a>`)).toBe(
    '&#60;a href=&#34;x&#34;&#62;Tom&#39;s &#38; co&#60;/a&#62;',
  )
  expect(esc(undefined)).toBe('')
})

test('counts read naturally', () => {
  expect(residueCount(1)).toBe('1 residue')
  expect(residueCount(12)).toBe('12 residues')
  expect(percent(1, 3)).toBe('33%')
})

test('axis labels start at 1, end at the length and step in round numbers', () => {
  expect(axisLabels(393)).toEqual([1, 50, 100, 150, 200, 250, 300, 350, 393])
  expect(axisLabels(1000)).toEqual([1, 200, 400, 600, 800, 1000])
  expect(axisLabels(2871)).toEqual([1, 500, 1000, 1500, 2000, 2500, 2871])
})
