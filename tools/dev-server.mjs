// Mini statische server voor het testen van de Suikerwater-PWA.
// Geen dependencies. Start vanuit de projectmap met:  node tools/dev-server.mjs
// Daarna op deze pc: http://localhost:8787
// Op je telefoon (zelfde wifi): http://<ip-van-deze-pc>:8787
//
// Een service worker werkt alleen op https:// of op localhost. Vandaar deze server:
// hiermee kun je het offline-gedrag en de install-prompt op localhost echt testen.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname, relative, isAbsolute } from 'node:path'
import { networkInterfaces } from 'node:os'

const ROOT = join(import.meta.dirname, '..', 'web')
const PORT = Number(process.env.PORT) || 8787

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
}

const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (rel.endsWith('/')) rel += 'index.html'

    // Pad-traversal blokkeren: normaliseren en daarna controleren dat het binnen
    // ROOT blijft. Via relative() en niet met startsWith: dat zou ook een map
    // naast ROOT doorlaten waarvan de naam met "web" begint, zoals web-oud.
    const abs = normalize(join(ROOT, rel))
    const inside = relative(ROOT, abs)
    if (inside.startsWith('..') || isAbsolute(inside)) {
      res.writeHead(403).end('Verboden')
      return
    }

    const info = await stat(abs)
    if (info.isDirectory()) {
      res.writeHead(302, { Location: rel.replace(/\/?$/, '/') + 'index.html' }).end()
      return
    }

    const body = await readFile(abs)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(abs).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      // Geen caching door de browser, zodat je tijdens ontwikkelen altijd de nieuwste
      // versie ziet. De service worker regelt het offline-cachen zelf.
      'Cache-Control': 'no-store',
    })
    res.end(body)
  } catch (err) {
    const code = err && err.code === 'ENOENT' ? 404 : 500
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(code === 404 ? 'Niet gevonden' : 'Serverfout')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Suikerwater draait op  http://localhost:${PORT}`)
  for (const list of Object.values(networkInterfaces())) {
    for (const nic of list ?? []) {
      if (nic.family === 'IPv4' && !nic.internal) {
        console.log(`Op je telefoon (zelfde wifi):  http://${nic.address}:${PORT}`)
      }
    }
  }
  console.log(`Map: ${ROOT}`)
})
