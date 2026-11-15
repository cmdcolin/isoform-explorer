export function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
}

export function percent(n: number, d: number) {
  return `${Math.round((100 * n) / d)}%`
}

export function residueCount(n: number) {
  return `${n} residue${n === 1 ? '' : 's'}`
}

export function axisLabels(length: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(length, 4) / 4))
  const step =
    [1, 2, 5].map(m => m * magnitude).find(s => length / s <= 8) ??
    10 * magnitude
  return [
    1,
    ...Array.from(
      { length: Math.floor((length * 0.94) / step) },
      (_, k) => (k + 1) * step,
    ),
    length,
  ]
}
