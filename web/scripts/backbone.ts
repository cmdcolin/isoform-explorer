import { HERO_COLOURS } from '../lib/home-hero-colours.ts'

type Rgb = [number, number, number]
type Point = [number, number, number]

interface Hero {
  gene: string
  partnerGene: string
  isoformId: string
  kept: [number, number][]
  contacts: number[]
  canonical: number[]
  partner: number[]
  isoform: number[]
}

interface Residue {
  position: number
  xyz: Point
  plddt: number
}

interface Piece {
  from: Point
  to: Point
  depth: number
  position: number
  kind: 'protein' | 'partner'
}

interface Bounds {
  centreX: number
  centreY: number
  scale: number
  near: number
  far: number
}

const STRIDE = 5
const TENTHS = 10
const PULL_APART = 22
const STEPS = 6
const TOP = 54
const BOTTOM = 34
const SIDE = 12
const FOG = 0.4

function rgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const PRESENT = rgb(HERO_COLOURS.present)
const LOST = rgb(HERO_COLOURS.lost)
const CONTACT = rgb(HERO_COLOURS.contact)
const PARTNER = rgb(HERO_COLOURS.partner)
const INK = rgb(HERO_COLOURS.ink)
const BACKGROUND = rgb(HERO_COLOURS.background)

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function css(color: Rgb) {
  return `rgb(${color.map(Math.round).join(',')})`
}

function residuesOf(flat: number[], shift = 0) {
  return Array.from({ length: flat.length / STRIDE }, (_, i): Residue => {
    const at = (field: number) => flat[i * STRIDE + field] ?? 0
    return {
      position: at(0),
      xyz: [at(1) / TENTHS + shift, at(2) / TENTHS, at(3) / TENTHS],
      plddt: at(4),
    }
  })
}

function spline(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const along = (k: 0 | 1 | 2) =>
    0.5 *
    (2 * p1[k] +
      (-p0[k] + p2[k]) * t +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t)
  return [along(0), along(1), along(2)]
}

function pieces(chain: Residue[], kind: Piece['kind']) {
  return chain.slice(0, -1).flatMap((residue, i) => {
    const p0 = chain[Math.max(0, i - 1)]?.xyz ?? residue.xyz
    const next = chain[i + 1] ?? residue
    const p3 = chain[Math.min(chain.length - 1, i + 2)]?.xyz ?? next.xyz
    return Array.from({ length: STEPS }, (_, s): Piece => {
      const before = spline(p0, residue.xyz, next.xyz, p3, s / STEPS)
      const after = spline(p0, residue.xyz, next.xyz, p3, (s + 1) / STEPS)
      return {
        from: before,
        to: after,
        depth: (before[2] + after[2]) / 2,
        position: s < STEPS / 2 ? residue.position : next.position,
        kind,
      }
    })
  })
}

function boundsOf(points: Point[], width: number, height: number): Bounds {
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  const zs = points.map(p => p[2])
  const spanX = Math.max(...xs) - Math.min(...xs)
  const spanY = Math.max(...ys) - Math.min(...ys)
  return {
    centreX: (Math.max(...xs) + Math.min(...xs)) / 2,
    centreY: (Math.max(...ys) + Math.min(...ys)) / 2,
    scale: Math.min((width - 2 * SIDE) / spanX, (height - TOP - BOTTOM) / spanY),
    near: Math.max(...zs),
    far: Math.min(...zs),
  }
}

function label(
  context: CanvasRenderingContext2D,
  text: string,
  chain: Residue[],
  screen: (p: Point) => [number, number],
  ratio: number,
) {
  const confident = chain.filter(r => r.plddt >= 70)
  const points = confident.map(r => screen(r.xyz))
  const x = points.reduce((sum, p) => sum + p[0], 0) / points.length
  const bottom = Math.max(...points.map(p => p[1]))
  context.font = `600 ${13 * ratio}px Roboto, sans-serif`
  context.textAlign = 'center'
  context.lineJoin = 'round'
  context.lineWidth = 5 * ratio
  context.strokeStyle = css(BACKGROUND)
  context.strokeText(text, x, bottom + 20 * ratio)
  context.fillStyle = css(INK)
  context.fillText(text, x, bottom + 20 * ratio)
}

function paint(
  canvas: HTMLCanvasElement,
  parts: { chain: Residue[]; kind: Piece['kind']; text: string }[],
  bounds: Bounds,
  hero: Hero,
  ratio: number,
) {
  const context = canvas.getContext('2d')
  if (context) {
    const contacts = new Set(hero.contacts)
    const screen = (p: Point): [number, number] => [
      canvas.width / 2 + (p[0] - bounds.centreX) * bounds.scale,
      (canvas.height + (TOP - BOTTOM) * ratio) / 2 + (p[1] - bounds.centreY) * bounds.scale,
    ]
    const inKept = (position: number) =>
      hero.kept.some(([start, end]) => position >= start && position <= end)
    const look = (piece: Piece) => {
      const contact = piece.kind === 'protein' && contacts.has(piece.position)
      const lost = piece.kind === 'protein' && !contact && !inKept(piece.position)
      return {
        lost,
        width:
          (piece.kind === 'partner' ? 0.9 : lost ? 1.1 : contact ? 2 : 1.5) * bounds.scale,
        base:
          piece.kind === 'partner' ? PARTNER : contact ? CONTACT : lost ? LOST : PRESENT,
      }
    }
    context.fillStyle = css(BACKGROUND)
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.lineCap = 'round'
    const all = parts
      .flatMap(part => pieces(part.chain, part.kind))
      .sort((a, b) => a.depth - b.depth)
    for (const outline of [true, false]) {
      for (const piece of all) {
        const { base, width, lost } = look(piece)
        const fog = FOG * (1 - (piece.depth - bounds.far) / (bounds.near - bounds.far))
        context.strokeStyle = css(
          outline
            ? mix(lost ? mix(INK, BACKGROUND, 0.45) : INK, BACKGROUND, fog * 0.8)
            : mix(base, BACKGROUND, fog * 0.7),
        )
        context.lineWidth = width + (outline ? 1.2 * ratio : 0)
        const [x1, y1] = screen(piece.from)
        const [x2, y2] = screen(piece.to)
        context.beginPath()
        context.moveTo(x1, y1)
        context.lineTo(x2, y2)
        context.stroke()
      }
    }
    for (const part of parts) {
      label(context, part.text, part.chain, screen, ratio)
    }
  }
}

const data = document.getElementById('home-hero-data')
const hero: Hero = JSON.parse(data?.textContent ?? '{}')
const ratio = window.devicePixelRatio || 1
const canonical = residuesOf(hero.canonical)
const partner = residuesOf(hero.partner, PULL_APART)
const isoform = residuesOf(hero.isoform)
const panels = {
  canonical: [
    { chain: partner, kind: 'partner' as const, text: `${hero.partnerGene} (partner protein)` },
    { chain: canonical, kind: 'protein' as const, text: hero.gene },
  ],
  isoform: [{ chain: isoform, kind: 'protein' as const, text: `${hero.gene} isoform ${hero.isoformId.split('-').pop()}` }],
}
for (const canvas of document.querySelectorAll<HTMLCanvasElement>('canvas[data-panel]')) {
  canvas.width = Math.round(canvas.clientWidth * ratio)
  canvas.height = Math.round(canvas.clientHeight * ratio)
  const bounds = boundsOf(
    [...canonical, ...partner, ...isoform].map(r => r.xyz),
    canvas.width / ratio,
    canvas.clientHeight,
  )
  paint(
    canvas,
    canvas.dataset.panel === 'isoform' ? panels.isoform : panels.canonical,
    { ...bounds, scale: bounds.scale * ratio },
    hero,
    ratio,
  )
  canvas.dataset.done = ''
}
