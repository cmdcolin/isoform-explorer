const RADIUS = 1.7
const MARGIN = 6
const STEP_OUTLINE = 6
const FOG = 0.35

type Rgb = [number, number, number]

function rgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const SUBUNITS = ['#c6d4e6', '#dfe6cf', '#ecdcc8', '#dcd0e4'].map(rgb)
const HIGHLIGHT = rgb('#e3862a')
const LIGAND = rgb('#2a63c4')
const INK = rgb('#22211f')

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function paint(canvas: HTMLCanvasElement, atoms: number[]) {
  const width = canvas.width
  const height = canvas.height
  const background = rgb(canvas.dataset.background ?? '#fcfcfb')
  const count = atoms.length / 5
  const at = (i: number, field: number) => (atoms[i * 5 + field] ?? 0) / 10
  const xs = Array.from({ length: count }, (_, i) => at(i, 0))
  const ys = Array.from({ length: count }, (_, i) => at(i, 1))
  const zs = Array.from({ length: count }, (_, i) => at(i, 2))
  const spanX = Math.max(...xs) - Math.min(...xs) + 2 * (RADIUS + MARGIN)
  const spanY = Math.max(...ys) - Math.min(...ys) + 2 * (RADIUS + MARGIN)
  const scale = Math.min(width / spanX, height / spanY)
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2
  const nearest = Math.max(...zs) + RADIUS
  const farthest = Math.min(...zs) - RADIUS

  const depth = new Float32Array(width * height).fill(-Infinity)
  const owner = new Int32Array(width * height).fill(-1)
  const r = RADIUS * scale
  for (let i = 0; i < count; i++) {
    const cx = width / 2 + ((xs[i] ?? 0) - midX) * scale
    const cy = height / 2 + ((ys[i] ?? 0) - midY) * scale
    const cz = zs[i] ?? 0
    for (let py = Math.max(0, Math.floor(cy - r)); py <= Math.min(height - 1, Math.ceil(cy + r)); py++) {
      for (let px = Math.max(0, Math.floor(cx - r)); px <= Math.min(width - 1, Math.ceil(cx + r)); px++) {
        const d2 = (px - cx) ** 2 + (py - cy) ** 2
        if (d2 <= r * r) {
          const z = cz + Math.sqrt(r * r - d2) / scale
          const p = py * width + px
          if (z > (depth[p] ?? -Infinity)) {
            depth[p] = z
            owner[p] = i
          }
        }
      }
    }
  }

  const group = (i: number) => (i < 0 ? -1 : (atoms[i * 5 + 3] ?? 0) * 3 + (atoms[i * 5 + 4] ?? 0))
  const ink = new Uint8Array(width * height)
  const stamp = (x: number, y: number, reach: number) => {
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const qx = x + dx
        const qy = y + dy
        if (dx * dx + dy * dy <= reach * reach && qx >= 0 && qy >= 0 && qx < width && qy < height) {
          ink[qy * width + qx] = 1
        }
      }
    }
  }
  const thick = Math.max(2, Math.round(scale * 0.35))
  const thin = Math.max(1, Math.round(scale * 0.12))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const atom = owner[p] ?? -1
      const neighbours = [x + 1 < width ? p + 1 : -1, y + 1 < height ? p + width : -1]
      for (const q of neighbours) {
        const other = q < 0 ? -1 : (owner[q] ?? -1)
        const silhouette = (atom < 0) !== (other < 0)
        const contour =
          atom >= 0 &&
          other >= 0 &&
          (group(atom) !== group(other) || Math.abs((depth[p] ?? 0) - (depth[q] ?? 0)) > STEP_OUTLINE)
        if (silhouette) {
          stamp(x, y, thick)
        } else if (contour) {
          stamp(x, y, thin)
        }
      }
    }
  }

  const image = new ImageData(width, height)
  for (let p = 0; p < width * height; p++) {
    const atom = owner[p] ?? -1
    const kind = atoms[atom * 5 + 4] ?? 0
    const base = kind === 2 ? LIGAND : kind === 1 ? HIGHLIGHT : (SUBUNITS[atoms[atom * 5 + 3] ?? 0] ?? INK)
    const fog = FOG * (1 - ((depth[p] ?? 0) - farthest) / (nearest - farthest))
    const color = atom < 0 ? background : ink[p] ? INK : mix(base, background, fog)
    image.data.set([...color, 255], p * 4)
  }
  canvas.getContext('2d')?.putImageData(image, 0, 0)
}

for (const canvas of document.querySelectorAll<HTMLCanvasElement>('canvas[data-atoms]')) {
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.round(canvas.clientWidth * ratio)
  canvas.height = Math.round(canvas.clientHeight * ratio)
  paint(canvas, JSON.parse(canvas.dataset.atoms ?? '[]'))
  canvas.dataset.done = ''
}
