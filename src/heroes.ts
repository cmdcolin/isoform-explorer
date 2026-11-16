import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

import { type Page, chromium } from 'playwright-core'

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
    name: 'alternative-acceptor',
    dir: 'heroes',
    path: 'gene/NDUFC2/',
    click: 'label:has(input[value="gene"])',
    hover: 'g.f[data-span="56-75"]',
    clip: ['.view-toggle', '.map-wrap'],
    width: 860,
    height: 900,
    wait: 1,
  },
  {
    name: 'active-site',
    dir: 'heroes',
    path: 'gene/ZDHHC16/',
    follow: '#Q969W1-3 a.button[href*="ProteinView"]',
    height: 800,
    wait: 45,
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
  await page.goto(`${origin}${shot.path}`)
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
