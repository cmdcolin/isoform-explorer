const WIDTH = 1400
const HEIGHT = 560

interface Point {
  x: number
  y: number
}

function bezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u ** 3 * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t ** 3 * p3.y,
  }
}

function myelin(p0: Point, p1: Point, p2: Point, p3: Point) {
  const samples = Array.from({ length: 401 }, (_, k) => bezier(p0, p1, p2, p3, k / 400))
  const lengths = samples.map((p, k) => {
    const before = samples[k - 1]
    return before ? Math.hypot(p.x - before.x, p.y - before.y) : 0
  })
  const total = lengths.reduce((a, b) => a + b, 0)
  const segment = 46
  const gap = 9
  const count = Math.floor((total - 60) / (segment + gap))
  const at = (distance: number) => {
    let run = 0
    const k = lengths.findIndex(length => {
      run += length
      return run >= distance
    })
    const p = samples[Math.max(1, k)] ?? p0
    const q = samples[Math.max(0, k - 1)] ?? p0
    return { ...p, angle: (Math.atan2(p.y - q.y, p.x - q.x) * 180) / Math.PI }
  }
  return Array.from({ length: count }, (_, k) => {
    const centre = at(40 + k * (segment + gap) + segment / 2)
    return `<rect x="${-segment / 2}" y="-9" width="${segment}" height="18" rx="9" transform="translate(${centre.x.toFixed(1)} ${centre.y.toFixed(1)}) rotate(${centre.angle.toFixed(1)})" class="myelin" />`
  }).join('')
}

function soma(x: number, y: number) {
  const dendrites = [200, 235, 270, 310, 345, 20, 150]
    .map(angle => {
      const r = (angle * Math.PI) / 180
      const end = { x: x + Math.cos(r) * 62, y: y + Math.sin(r) * 62 }
      const bend = { x: x + Math.cos(r + 0.35) * 38, y: y + Math.sin(r + 0.35) * 38 }
      const fork = { x: end.x + Math.cos(r - 0.6) * 22, y: end.y + Math.sin(r - 0.6) * 22 }
      return `<path d="M${x} ${y} Q${bend.x.toFixed(1)} ${bend.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)} M${((x + end.x) / 2 + Math.cos(r) * 8).toFixed(1)} ${((y + end.y) / 2 + Math.sin(r) * 8).toFixed(1)} L${fork.x.toFixed(1)} ${fork.y.toFixed(1)}" class="dendrite" />`
    })
    .join('')
  return `${dendrites}<circle cx="${x}" cy="${y}" r="24" class="neuron" /><circle cx="${x + 3}" cy="${y - 2}" r="9" class="nucleus" />`
}

function muscle(left: number, top: number) {
  const fibres = Array.from({ length: 6 }, (_, k) => {
    const y = top + k * 46
    const stripes = Array.from({ length: 38 }, (_, s) => `<line x1="${left + 14 + s * 9}" y1="${y + 4}" x2="${left + 14 + s * 9}" y2="${y + 34}" class="stripe" />`).join('')
    return `<rect x="${left}" y="${y}" width="360" height="38" rx="19" class="fibre" />${stripes}`
  }).join('')
  return fibres
}

export function motorNeuronFigure() {
  const cord = { x: 230, y: 290 }
  const body = { x: cord.x - 62, y: cord.y + 62 }
  const start = { x: body.x + 18, y: body.y + 18 }
  const exit = { x: cord.x - 20, y: cord.y + 128 }
  const end = { x: 1000, y: 320 }
  const c1 = { x: 330, y: 580 }
  const c2 = { x: 760, y: 520 }
  const muscleLeft = 1010
  const muscleTop = 190
  const terminals = [0, 1, 2, 3, 4]
    .map(k => {
      const fy = muscleTop + 19 + k * 46 + (k > 1 ? 46 : 0)
      const fx = 1090 + k * 34
      return `<path d="M${end.x} ${end.y} C${end.x + 30} ${end.y}, ${fx - 40} ${fy}, ${fx} ${fy}" class="axon branch" /><ellipse cx="${fx + 8}" cy="${fy}" rx="11" ry="7" class="terminal" />`
    })
    .join('')
  return `<svg class="motor-neuron-figure" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="A motor neuron with its cell body in the front horn of the spinal cord's grey matter, its myelinated axon leaving the cord and running to a bundle of striped muscle fibres, where its branches end on five fibres"><style>
.motor-neuron-figure text { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; fill: var(--text-2); font-size: 19px; }
.motor-neuron-figure .title { font-size: 28px; font-weight: 650; fill: var(--text); }
.motor-neuron-figure .white-matter { fill: var(--surface-2); stroke: var(--border); stroke-width: 3; }
.motor-neuron-figure .grey-matter { fill: #d9cbbb; }
.motor-neuron-figure .canal { fill: var(--surface); stroke: #b8a898; stroke-width: 2; }
.motor-neuron-figure .neuron { fill: var(--caution); stroke: #9a520b; stroke-width: 2; }
.motor-neuron-figure .nucleus { fill: #fbe2c4; }
.motor-neuron-figure .dendrite { fill: none; stroke: var(--caution); stroke-width: 4; stroke-linecap: round; }
.motor-neuron-figure .axon { fill: none; stroke: var(--caution); stroke-width: 5; stroke-linecap: round; }
.motor-neuron-figure .branch { stroke-width: 3.5; }
.motor-neuron-figure .myelin { fill: #f7efe0; stroke: #c9b79c; stroke-width: 2; }
.motor-neuron-figure .fibre { fill: #e7a59b; stroke: #b9675d; stroke-width: 2; }
.motor-neuron-figure .stripe { stroke: #c97f74; stroke-width: 2; opacity: 0.55; }
.motor-neuron-figure .terminal { fill: var(--caution); stroke: #9a520b; stroke-width: 2; }
.motor-neuron-figure .leader { stroke: var(--text-2); stroke-width: 1.5; fill: none; }
</style><text x="40" y="56" class="title">From the spinal cord to muscle: one motor neuron</text><ellipse cx="${cord.x}" cy="${cord.y}" rx="175" ry="135" class="white-matter" /><g class="grey-matter"><ellipse cx="${cord.x - 46}" cy="${cord.y - 52}" rx="17" ry="46" transform="rotate(-30 ${cord.x - 46} ${cord.y - 52})" /><ellipse cx="${cord.x + 46}" cy="${cord.y - 52}" rx="17" ry="46" transform="rotate(30 ${cord.x + 46} ${cord.y - 52})" /><ellipse cx="${cord.x - 62}" cy="${cord.y + 52}" rx="50" ry="56" transform="rotate(18 ${cord.x - 62} ${cord.y + 52})" /><ellipse cx="${cord.x + 62}" cy="${cord.y + 52}" rx="50" ry="56" transform="rotate(-18 ${cord.x + 62} ${cord.y + 52})" /><rect x="${cord.x - 70}" y="${cord.y - 22}" width="140" height="46" rx="20" /></g><circle cx="${cord.x}" cy="${cord.y}" r="6" class="canal" /><path d="M${start.x} ${start.y} Q${start.x + 4} ${exit.y - 30} ${exit.x} ${exit.y}" class="axon" /><path d="M${exit.x} ${exit.y} C${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}" class="axon" />${myelin(exit, c1, c2, end)}${soma(body.x, body.y)}${muscle(muscleLeft, muscleTop)}${terminals}<path d="M${cord.x + 150} ${cord.y - 140} L${cord.x + 118} ${cord.y - 100}" class="leader" /><text x="${cord.x + 156}" y="${cord.y - 144}">spinal cord, in cross-section</text><path d="M${body.x - 30} ${body.y + 110} L${body.x - 6} ${body.y + 30}" class="leader" /><text x="${body.x - 150}" y="${body.y + 132}">motor neuron, in the</text><text x="${body.x - 150}" y="${body.y + 156}">front (anterior) horn</text><text x="520" y="${cord.y + 150}">axon, wrapped in myelin</text><text x="${muscleLeft + 180}" y="${muscleTop - 20}" style="text-anchor: middle">muscle fibres</text></svg>`
}
