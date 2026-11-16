import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

import { type Locator, type Page, chromium } from 'playwright-core'

import { jbrowseUrl, REFSEQ_TRACK, sessionUrl } from './links.ts'
import { ROOT } from './paths.ts'

const BASE = '/isoform-explorer/'
const DIST = join(ROOT, 'dist')
const BLOG = join(ROOT, 'web', 'content', 'blog')

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
}

interface Shot {
  name: string
  dir: 'heroes' | 'figures'
  path: string
  follow?: string
  click?: string
  hover?: string
  prepare?: (page: Page) => Promise<void>
  clip?: string[]
  width?: number
  height: number
  wait: number
}

const SHOTS: Shot[] = [
  {
    name: 'signal-peptide',
    dir: 'heroes',
    path: 'figures/f2rl2/',
    clip: ['.hero-figure'],
    height: 900,
    wait: 1,
  },
  {
    name: 'expression',
    dir: 'heroes',
    path: 'figures/expression/',
    clip: ['.hero-figure'],
    height: 900,
    wait: 1,
  },
  {
    name: 'splice-acceptors',
    dir: 'heroes',
    path: 'figures/ndufc2/',
    clip: ['svg.acceptor-figure'],
    height: 900,
    wait: 1,
  },
  {
    name: 'palmitate',
    dir: 'heroes',
    path: 'figures/zdhhc16/',
    clip: ['svg.active-site-figure'],
    height: 900,
    wait: 1,
  },
  {
    name: 'start-codons',
    dir: 'heroes',
    path: 'figures/cebpb/',
    clip: ['svg.start-codons-figure'],
    height: 900,
    wait: 1,
  },
  {
    name: 'motor-neuron',
    dir: 'heroes',
    path: 'figures/smn/',
    clip: ['svg.motor-neuron-figure'],
    height: 900,
    wait: 1,
  },
  {
    name: 'tetramer',
    dir: 'heroes',
    path: 'figures/pkm/',
    clip: ['.hero-figure canvas'],
    height: 900,
    wait: 3,
  },
  {
    name: 'ndufc2-gene-view',
    dir: 'figures',
    path: 'gene/NDUFC2/',
    click: 'label:has(input[value="gene"])',
    hover: 'g.f[data-span="56-75"]',
    clip: ['.view-toggle', '.map-wrap'],
    width: 860,
    height: 900,
    wait: 1,
  },
  {
    name: 'zdhhc16-splice-changes',
    dir: 'figures',
    path: sessionUrl(
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'hg38',
            loc: 'chr10:97452350-97453900',
            tracks: [REFSEQ_TRACK],
            highlight: ['chr10:97452895-97452923', 'chr10:97453530-97453617'],
          },
        ],
      },
      jbrowseUrl(
        'https://cmdcolin.github.io/isoform-explorer/jbrowse/config.json',
      ),
    ),
    prepare: annotateZdhhc16,
    clip: ['[data-testid^="linear-genome-view-"]'],
    height: 800,
    wait: 3,
  },
  {
    name: 'f2rl2-genome',
    dir: 'figures',
    path: 'gene/F2RL2/',
    follow: '.gene-head a.button[href*="LinearGenomeView"]',
    height: 460,
    wait: 30,
  },
]

async function pickFromTrackMenu(page: Page, submenu: string, item: string) {
  await page.locator('[data-testid="track_menu_icon"]').first().click()
  await page.getByText(submenu, { exact: true }).click()
  await page.getByText(item, { exact: true }).click()
  await closeMenus(page)
}

async function closeMenus(page: Page) {
  for (const _ of [1, 2]) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
}

async function annotateZdhhc16(page: Page) {
  await page.getByTestId('app-ready-marker').waitFor({ state: 'attached' })
  await page.waitForTimeout(10_000)
  await pickFromTrackMenu(page, 'Subfeature labels', 'Below')
  await page.getByText('Isoforms trimmed').click()
  await page.getByText('All transcripts', { exact: true }).click()
  await closeMenus(page)
  await pickFromTrackMenu(page, 'Feature height', 'Normal')
  await pickFromTrackMenu(page, 'Feature height', 'Grow the track')
  await page.mouse.move(0, 0)
  await page.waitForTimeout(2000)
  await page.locator('[data-testid="track_menu_icon"]').first().blur()
  const box = (locator: Locator) => locator.first().boundingBox()
  const [track, exon6, exon7, canonical, isoform3] = await Promise.all([
    box(page.getByTestId(/^trackRenderingContainer-/)),
    box(page.getByTestId('highlight-band').nth(0)),
    box(page.getByTestId('highlight-band').nth(1)),
    box(page.getByText('NM_198046.3', { exact: true })),
    box(page.getByText('NM_198044.3', { exact: true })),
  ])
  const html =
    track && exon6 && exon7 && canonical && isoform3
      ? [
          outline(canonical),
          outline(isoform3),
          note(
            'MANE Select, canonical protein →',
            exon6.x - 16,
            canonical.y - 12,
            '-100%',
          ),
          note('isoform 3 →', exon6.x - 16, isoform3.y - 12, '-100%'),
          note(
            'exon 6, 29 bases: skipped',
            exon6.x + exon6.width / 2,
            track.y + track.height - 24,
            '-50%',
          ),
          note(
            'first 88 bases of exon 7: skipped',
            exon7.x + exon7.width / 2,
            track.y + track.height - 24,
            '-50%',
          ),
        ].join('')
      : ''
  await page
    .locator('body')
    .evaluate((body, html) => body.insertAdjacentHTML('beforeend', html), html)
}

const RED = '#d00000'

function outline(b: { x: number; y: number; width: number; height: number }) {
  return `<div style="position:absolute;left:${b.x - 3}px;top:${b.y - 1}px;width:${b.width + 6}px;height:${b.height + 2}px;border:2px solid ${RED};border-radius:3px;z-index:10000;pointer-events:none"></div>`
}

function note(text: string, x: number, y: number, shift: string) {
  return `<div style="position:absolute;left:${x}px;top:${y}px;transform:translateX(${shift});color:${RED};font:bold 14px Roboto,sans-serif;background:rgba(255,255,255,0.9);padding:1px 4px;white-space:nowrap;z-index:10000;pointer-events:none">${text}</div>`
}

function serve() {
  const server = createServer((request, response) => {
    const path = normalize(
      decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname),
    )
    const inside = path.startsWith(BASE) ? path.slice(BASE.length - 1) : path
    const file = join(
      DIST,
      inside.endsWith('/') ? `${inside}index.html` : inside,
    )
    readFile(file).then(
      body => {
        response.writeHead(200, {
          'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
        })
        response.end(body)
      },
      () => {
        response.writeHead(404)
        response.end()
      },
    )
  })
  return new Promise<{ origin: string; close: () => void }>(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({
        origin:
          address && typeof address === 'object'
            ? `http://127.0.0.1:${address.port}${BASE}`
            : '',
        close: () => server.close(),
      })
    })
  })
}

async function capture(page: Page, shot: Shot, origin: string) {
  await page.setViewportSize({ width: shot.width ?? 1400, height: shot.height })
  await page.goto(new URL(shot.path, origin).href)
  if (shot.follow) {
    const target = await page.locator(shot.follow).first().getAttribute('href')
    await page.goto(target ?? '')
  }
  if (shot.click) {
    await page.locator(shot.click).click()
  }
  if (shot.hover) {
    await page.locator(shot.hover).first().hover()
  }
  await shot.prepare?.(page)
  await page.waitForTimeout(shot.wait * 1000)
  const file = join(BLOG, shot.dir, `${shot.name}.jpg`)
  const boxes = await Promise.all(
    (shot.clip ?? []).map(selector =>
      page.locator(selector).first().boundingBox(),
    ),
  )
  const found = boxes.flatMap(box => (box ? [box] : []))
  const left = Math.min(...found.map(b => b.x))
  const top = Math.min(...found.map(b => b.y))
  await page.screenshot({
    path: file,
    type: 'jpeg',
    quality: 85,
    fullPage: true,
    clip: found.length
      ? {
          x: left,
          y: top,
          width: Math.max(...found.map(b => b.x + b.width)) - left,
          height: Math.max(...found.map(b => b.y + b.height)) - top,
        }
      : undefined,
  })
  console.log(file)
}

const wanted = process.argv.slice(2)
const site = await serve()
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  args: ['--enable-unsafe-swiftshader', '--hide-scrollbars'],
})
try {
  const context = await browser.newContext({ deviceScaleFactor: 2 })
  const page = await context.newPage()
  for (const shot of SHOTS.filter(
    s => wanted.length === 0 || wanted.includes(s.name),
  )) {
    await capture(page, shot, site.origin)
  }
} finally {
  await browser.close()
  site.close()
}
