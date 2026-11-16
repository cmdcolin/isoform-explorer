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

const GENOME_VIEW = '[data-testid^="linear-genome-view-"]'

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
    prepare: annotateNdufc2,
    clip: ['.view-toggle', '.map-wrap'],
    width: 860,
    height: 900,
    wait: 1,
  },
  {
    name: 'f2rl2-genome',
    dir: 'figures',
    path: genomeSession('chr5:76615423-76623700', [
      'chr5:76623167-76623230',
      'chr5:76618638-76618640',
    ]),
    prepare: annotateF2rl2,
    clip: [GENOME_VIEW],
    height: 800,
    wait: 1,
  },
]

function genomeSession(loc: string, highlight: string[]) {
  return sessionUrl(
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc,
          tracks: [REFSEQ_TRACK],
          highlight,
        },
      ],
    },
    jbrowseUrl(
      'https://cmdcolin.github.io/isoform-explorer/jbrowse/config.json',
    ),
  )
}

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

async function showTranscriptNames(page: Page, gene: string, last: string) {
  await page.getByTestId(`feature-name-${gene}`).waitFor()
  await pickFromTrackMenu(page, 'Subfeature labels', 'Below')
  const trimmed = page.getByText('Isoforms trimmed')
  if (await trimmed.isVisible()) {
    await trimmed.click()
    await page.getByText('All transcripts', { exact: true }).click()
    await closeMenus(page)
  }
  await pickFromTrackMenu(page, 'Feature height', 'Normal')
  await pickFromTrackMenu(page, 'Feature height', 'Grow the track')
  await page.mouse.move(0, 0)
  await page.getByText(last, { exact: true }).waitFor()
  await page.locator('[data-testid="track_menu_icon"]').first().blur()
}

function boxes(page: Page) {
  const box = (locator: Locator) => locator.first().boundingBox()
  return {
    track: () => box(page.getByTestId(/^trackRenderingContainer-/)),
    chip: () => box(page.getByTestId('highlight-chip')),
    band: (n: number) => box(page.getByTestId('highlight-band').nth(n)),
    text: (text: string) => box(page.getByText(text, { exact: true })),
  }
}

async function overlay(page: Page, notes: string[]) {
  await page
    .locator('body')
    .evaluate(
      (body, html) => body.insertAdjacentHTML('beforeend', html),
      notes.join(''),
    )
}

async function annotateNdufc2(page: Page) {
  const box = (selector: string) => page.locator(selector).first().boundingBox()
  const [helix, protein, transcript] = await Promise.all([
    box('svg.map g.f.tm[data-span="56-75"]'),
    box('svg.map g.iso[data-isoform="O95298-2"]'),
    box('svg.structure g.exon[data-span="104-119"] >> nth=1'),
  ])
  await overlay(
    page,
    helix && protein && transcript
      ? [
          note(
            'transmembrane helix, residues 56–75 →',
            helix.x - 8,
            helix.y + helix.height / 2 - 8,
            '-100%',
            RED,
            11,
          ),
          note(
            'gap: residues 56–78',
            helix.x + 6,
            protein.y + protein.height / 2 - 8,
            '0',
            RED,
            11,
          ),
          note(
            '← isoform 4: exon 2 starts later',
            transcript.x + transcript.width + 8,
            transcript.y + transcript.height / 2 - 8,
            '0',
            RED,
            11,
          ),
        ]
      : [],
  )
}

async function annotateF2rl2(page: Page) {
  await showTranscriptNames(page, 'F2RL2', 'NM_001256566.2')
  const find = boxes(page)
  const [neighbour, signal, start, canonical, isoform2] = await Promise.all([
    find.text('NM_001285460.2'),
    find.band(0),
    find.band(1),
    find.text('NM_004101.4'),
    find.text('NM_001256566.2'),
  ])
  await overlay(
    page,
    neighbour && signal && start && canonical && isoform2
      ? [
          note(
            '← IQGAP2, on the other strand: F2RL2 lies in one of its introns',
            neighbour.x + neighbour.width + 8,
            neighbour.y - 2,
            '0',
            '#555',
          ),
          outline(canonical),
          outline(isoform2),
          note(
            'MANE Select: signal peptide, residues 1–21 →',
            signal.x - 8,
            canonical.y - 12,
            '-100%',
          ),
          note(
            'isoform 2: exon 1 untranslated →',
            signal.x - 8,
            isoform2.y - 12,
            '-100%',
          ),
          note(
            '← isoform 2 starts here, at methionine 23',
            start.x + start.width + 8,
            isoform2.y - 12,
            '0',
          ),
        ]
      : [],
  )
}

const RED = '#d00000'

type Box = { x: number; y: number; width: number; height: number }

function outline(b: Box) {
  return `<div style="position:absolute;left:${b.x - 3}px;top:${b.y - 1}px;width:${b.width + 6}px;height:${b.height + 2}px;border:2px solid ${RED};border-radius:3px;z-index:10000;pointer-events:none"></div>`
}

function note(
  text: string,
  x: number,
  y: number,
  shift: string,
  colour = RED,
  size = 14,
) {
  return `<div style="position:absolute;left:${x}px;top:${y}px;transform:translateX(${shift});color:${colour};font:bold ${size}px Roboto,sans-serif;background:rgba(255,255,255,0.9);padding:1px 4px;white-space:nowrap;z-index:10000;pointer-events:none">${text}</div>`
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
