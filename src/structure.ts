import type { Point } from './contacts.ts'

export interface Residue {
  position: number
  coord: Point
  plddt: number
}

type Matrix = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

export function centre(points: Point[]): Point {
  const [x, y, z] = points.reduce<Point>(
    (total, p) => [total[0] + p[0], total[1] + p[1], total[2] + p[2]],
    [0, 0, 0],
  )
  const n = points.length || 1
  return [x / n, y / n, z / n]
}

export function subtract(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function dot(a: Point, b: Point) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function normalise(v: Point): Point {
  const length = Math.hypot(...v) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

export function cross(a: Point, b: Point): Point {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

export function largestAxis(points: Point[], orthogonalTo: Point[]) {
  const project = (v: Point) =>
    orthogonalTo.reduce<Point>((w, axis) => {
      const along = dot(w, axis)
      return [
        w[0] - along * axis[0],
        w[1] - along * axis[1],
        w[2] - along * axis[2],
      ]
    }, v)
  const step = (axis: Point) =>
    normalise(
      project(
        points.reduce<Point>(
          (total, p) => {
            const along = dot(p, axis)
            return [
              total[0] + along * p[0],
              total[1] + along * p[1],
              total[2] + along * p[2],
            ]
          },
          [0, 0, 0],
        ),
      ),
    )
  return Array.from({ length: 50 }).reduce<Point>(
    axis => step(axis),
    normalise(project([0.6, 0.7, 0.4])),
  )
}

export function parseBackbone(cif: string, chain?: string) {
  const header: string[] = []
  const residues: Residue[] = []
  for (const line of cif.split(/\r?\n/)) {
    if (line.startsWith('_atom_site.')) {
      header.push(line.slice('_atom_site.'.length).trim())
    } else if (header.length && line.startsWith('ATOM')) {
      const row = line.trim().split(/\s+/)
      const field = (tag: string) => row[header.indexOf(tag)] ?? ''
      if (
        field('label_atom_id') === 'CA' &&
        (chain === undefined || field('label_asym_id') === chain)
      ) {
        residues.push({
          position: Number(field('label_seq_id')),
          coord: [
            Number(field('Cartn_x')),
            Number(field('Cartn_y')),
            Number(field('Cartn_z')),
          ],
          plddt: Number(field('B_iso_or_equiv')),
        })
      }
    }
  }
  return residues
}

function product(a: Matrix, b: Matrix): Matrix {
  const [a0, a1, a2, a3, a4, a5, a6, a7, a8] = a
  const [b0, b1, b2, b3, b4, b5, b6, b7, b8] = b
  return [
    a0 * b0 + a1 * b3 + a2 * b6,
    a0 * b1 + a1 * b4 + a2 * b7,
    a0 * b2 + a1 * b5 + a2 * b8,
    a3 * b0 + a4 * b3 + a5 * b6,
    a3 * b1 + a4 * b4 + a5 * b7,
    a3 * b2 + a4 * b5 + a5 * b8,
    a6 * b0 + a7 * b3 + a8 * b6,
    a6 * b1 + a7 * b4 + a8 * b7,
    a6 * b2 + a7 * b5 + a8 * b8,
  ]
}

function inverseTransposed([a, b, c, d, e, f, g, h, i]: Matrix): Matrix {
  const cofactors: Matrix = [
    e * i - f * h,
    f * g - d * i,
    d * h - e * g,
    c * h - b * i,
    a * i - c * g,
    b * g - a * h,
    b * f - c * e,
    c * d - a * f,
    a * e - b * d,
  ]
  const determinant = a * cofactors[0] + b * cofactors[1] + c * cofactors[2]
  return [
    cofactors[0] / determinant,
    cofactors[1] / determinant,
    cofactors[2] / determinant,
    cofactors[3] / determinant,
    cofactors[4] / determinant,
    cofactors[5] / determinant,
    cofactors[6] / determinant,
    cofactors[7] / determinant,
    cofactors[8] / determinant,
  ]
}

function orthogonalFactor(matrix: Matrix) {
  return Array.from({ length: 60 }).reduce<Matrix>((x): Matrix => {
    const inverse = inverseTransposed(x)
    return [
      (x[0] + inverse[0]) / 2,
      (x[1] + inverse[1]) / 2,
      (x[2] + inverse[2]) / 2,
      (x[3] + inverse[3]) / 2,
      (x[4] + inverse[4]) / 2,
      (x[5] + inverse[5]) / 2,
      (x[6] + inverse[6]) / 2,
      (x[7] + inverse[7]) / 2,
      (x[8] + inverse[8]) / 2,
    ]
  }, matrix)
}

function rotate(
  [r0, r1, r2, r3, r4, r5, r6, r7, r8]: Matrix,
  [x, y, z]: Point,
): Point {
  return [
    r0 * x + r1 * y + r2 * z,
    r3 * x + r4 * y + r5 * z,
    r6 * x + r7 * y + r8 * z,
  ]
}

export function superposition(moving: Point[], fixed: Point[]) {
  const from = centre(moving)
  const to = centre(fixed)
  const correlation = moving.reduce<Matrix>(
    (sum, point, k) => {
      const [mx, my, mz] = subtract(point, from)
      const [fx, fy, fz] = subtract(fixed[k] ?? to, to)
      return [
        sum[0] + fx * mx,
        sum[1] + fx * my,
        sum[2] + fx * mz,
        sum[3] + fy * mx,
        sum[4] + fy * my,
        sum[5] + fy * mz,
        sum[6] + fz * mx,
        sum[7] + fz * my,
        sum[8] + fz * mz,
      ]
    },
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  )
  const matrix = orthogonalFactor(correlation)
  return (point: Point): Point => {
    const [x, y, z] = rotate(matrix, subtract(point, from))
    return [x + to[0], y + to[1], z + to[2]]
  }
}

export function rmsd(a: Point[], b: Point[]) {
  const squared = a.reduce((sum, p, k) => {
    const [x, y, z] = subtract(p, b[k] ?? p)
    return sum + x * x + y * y + z * z
  }, 0)
  return Math.sqrt(squared / (a.length || 1))
}

export function contactFrame(own: Point[], partner: Point[]) {
  const origin = centre(own)
  const along = normalise(subtract(centre(partner), origin))
  const up = largestAxis(
    own.map(p => subtract(p, origin)),
    [along],
  )
  const toward = cross(along, up)
  return (point: Point): Point => {
    const p = subtract(point, origin)
    return [dot(p, along), dot(p, up), dot(p, toward)]
  }
}
