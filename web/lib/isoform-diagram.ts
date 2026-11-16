const LEFT = 20
const RIGHT = 380
const DOMAIN = { start: 170, end: 270 }
const BAR = 26

function bar(x: number, y: number, width: number, fill: string) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${BAR}" rx="${BAR / 2}" fill="${fill}" />`
}

export function isoformDiagram() {
  const canonical = 40
  const isoform = 124
  const domainWidth = DOMAIN.end - DOMAIN.start
  return `
    <svg class="isoform-diagram" viewBox="0 0 400 200" role="img" aria-label="Cartoon of a canonical protein with a domain, and an alternative isoform of it with that stretch missing">
      <g fill="currentColor" font-size="14">
        <text x="${LEFT}" y="${canonical - 10}">canonical protein</text>
        <text x="${LEFT}" y="${isoform - 10}">alternative isoform</text>
      </g>
      ${bar(LEFT, canonical, RIGHT - LEFT, 'var(--diagram-protein)')}
      <rect x="${DOMAIN.start}" y="${canonical}" width="${domainWidth}" height="${BAR}" fill="var(--partner)" />
      <text x="${DOMAIN.start + domainWidth / 2}" y="${canonical + 18}" font-size="14" text-anchor="middle" fill="var(--chip-text)">domain</text>
      ${bar(LEFT, isoform, DOMAIN.start - LEFT, 'var(--diagram-protein)')}
      ${bar(DOMAIN.end, isoform, RIGHT - DOMAIN.end, 'var(--diagram-protein)')}
      <rect x="${DOMAIN.start + 4}" y="${isoform + 1}" width="${domainWidth - 8}" height="${BAR - 2}" rx="4" fill="none" stroke="var(--caution)" stroke-width="2" stroke-dasharray="6 4" />
      <g stroke="var(--text-2)" stroke-width="1" stroke-dasharray="2 3">
        <path d="M${DOMAIN.start} ${canonical + BAR + 4}V${isoform - 4}" />
        <path d="M${DOMAIN.end} ${canonical + BAR + 4}V${isoform - 4}" />
      </g>
      <text x="${DOMAIN.start + domainWidth / 2}" y="${isoform + BAR + 40}" font-size="14" text-anchor="middle" fill="currentColor">missing</text>
      <path d="M${DOMAIN.start + domainWidth / 2} ${isoform + BAR + 26}V${isoform + BAR + 4}" stroke="currentColor" stroke-width="1.2" />
    </svg>`
}
