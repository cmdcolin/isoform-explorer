const SVG = 'http://www.w3.org/2000/svg'
let drawn = ''

function spansOf(target: EventTarget | null) {
  const element =
    target instanceof Element ? target.closest('[data-span]') : null
  return element?.getAttribute('data-span') ?? ''
}

function number(svg: SVGSVGElement, key: string) {
  return Number(svg.dataset[key] ?? 0)
}

function draw(spans: string) {
  if (spans !== drawn) {
    drawn = spans
    for (const old of document.querySelectorAll('.track .column')) {
      old.remove()
    }
    for (const svg of document.querySelectorAll<SVGSVGElement>('svg.track')) {
      const left = number(svg, 'left')
      const step = number(svg, 'step')
      const top = number(svg, 'top')
      const bottom = number(svg, 'bottom')
      const path = document.createElementNS(SVG, 'path')
      path.setAttribute('class', 'column')
      path.setAttribute(
        'd',
        spans
          .split(' ')
          .filter(Boolean)
          .map(run => {
            const [start = 0, end = start] = run.split('-').map(Number)
            const x = left + (start - 1) * step
            const width = Math.max((end - start + 1) * step, 1.5)
            return `M${x} ${top}h${width}V${bottom}h${-width}z`
          })
          .join(''),
      )
      svg.append(path)
    }
  }
}

document.addEventListener('pointerover', event => draw(spansOf(event.target)))
document.documentElement.addEventListener('pointerleave', () => draw(''))
