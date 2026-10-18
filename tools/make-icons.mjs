// Genereert de app-iconen als echte PNG-bestanden.
//
//   node tools/make-icons.mjs
//
// Chrome op Android heeft voor de install-prompt een PNG nodig; een SVG of een
// data-URI in het manifest is daarvoor niet betrouwbaar. Dit script schrijft de
// PNG's met de hand (IHDR/IDAT/IEND + CRC32), zodat er geen enkele dependency
// nodig is. Het hoeft alleen opnieuw te draaien als het beeldmerk verandert.
//
// Het schrijft zowel de iconen van de webapp (web/) als de lagen van het
// adaptieve icoon van de Android-app (android/app/src/main/res/mipmap-*).

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

/* ─── PNG schrijven ───────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

/** Zet RGBA-pixels om naar een PNG-bestand (8 bits, kleurtype 6). */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 //  bitdiepte
  ihdr[9] = 6 //  kleurtype RGBA
  ihdr[10] = 0 // compressie: deflate
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // geen interlace

  // Elke scanline krijgt een filterbyte 0 (geen filter) vooraf.
  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ─── Het beeldmerk ───────────────────────────────────────────────────────── */

const GROUND = [0xc8, 0x86, 0x2a] //  amber, de kleur van het bier
const DROP = [0xfd, 0xf7, 0xee] //    room, de druppel suikerwater
const CRYSTAL = [0x3a, 0x2a, 0x16] // donkerbruin, de suikerkorrels

// Een druppel, opgebouwd uit een cirkel met daarboven de twee tangentlijnen
// vanuit de punt. Door de tangent te gebruiken loopt de overgang exact vloeiend.
const APEX = -0.55 //        de punt bovenaan
const CENTER = 0.15 //       middelpunt van de bol
const RADIUS = 0.42 //       straal van de bol
const TANGENT_Y = -0.102 //  waar de lijnen de bol raken
const SLOPE = 0.75 //        tan van de tangenthoek: RADIUS / sqrt(d^2 - RADIUS^2)

const inDroplet = (x, y) =>
  (y >= APEX && y <= TANGENT_Y && Math.abs(x) <= (y - APEX) * SLOPE) ||
  x * x + (y - CENTER) * (y - CENTER) <= RADIUS * RADIUS

// Drie geroteerde vierkantjes: kristalsuiker. Ruim binnen de bol gehouden, en
// bewust in een aflopende diagonaal met verschillende maten. Symmetrisch
// geplaatst gaan drie vormen onmiddellijk als een gezichtje lezen.
const CRYSTALS = [
  { x: -0.2, y: 0.08, half: 0.068 },
  { x: -0.02, y: 0.19, half: 0.095 },
  { x: 0.18, y: 0.3, half: 0.06 },
]

const inCrystal = (x, y) =>
  CRYSTALS.some(c => Math.abs(x - c.x) + Math.abs(y - c.y) <= c.half)

const SAMPLES = 3 // 3x3 per pixel, genoeg om de rand glad te krijgen

/**
 * @param size   breedte en hoogte in pixels
 * @param scale  hoe groot het beeldmerk mag worden; de druppel reikt tot
 *               0,57 x scale vanaf het midden (1 = halve canvasbreedte)
 * @param layer  'full'        dekkend icoon met amber ondergrond (web)
 *               'foreground'  alleen de druppel, rest transparant (Android)
 *               'monochrome'  silhouet voor de thema-iconen van Android 13+:
 *                             alleen de alfa telt, de kristallen zijn gaten
 */
function drawIcon(size, scale, layer = 'full') {
  const rgba = Buffer.alloc(size * size * 4)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let drop = 0
      let crystal = 0

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          // Naar coördinaten van -1 tot 1, daarna terugschalen naar vormruimte.
          const x = ((px + (sx + 0.5) / SAMPLES) / size * 2 - 1) / scale
          const y = ((py + (sy + 0.5) / SAMPLES) / size * 2 - 1) / scale

          if (inDroplet(x, y)) {
            drop++
            if (inCrystal(x, y)) crystal++
          }
        }
      }

      const total = SAMPLES * SAMPLES
      const dropCover = drop / total
      const crystalCover = crystal / total

      const i = (py * size + px) * 4

      if (layer === 'monochrome') {
        rgba.fill(255, i, i + 3)
        rgba[i + 3] = Math.round((dropCover - crystalCover) * 255)
        continue
      }

      if (layer === 'foreground') {
        // De achtergrond levert Android zelf; hier dus alleen de druppel, met
        // de dekking als alfa. Kristallen liggen ruim binnen de druppel, dus
        // waar de druppel deels dekt is crystal altijd 0.
        const share = drop > 0 ? crystal / drop : 0
        for (let ch = 0; ch < 3; ch++) {
          rgba[i + ch] = Math.round(DROP[ch] + (CRYSTAL[ch] - DROP[ch]) * share)
        }
        rgba[i + 3] = Math.round(dropCover * 255)
        continue
      }

      for (let ch = 0; ch < 3; ch++) {
        // Eerst de druppel over de ondergrond, dan de kristallen daarbinnen.
        const onGround = GROUND[ch] + (DROP[ch] - GROUND[ch]) * dropCover
        rgba[i + ch] = Math.round(onGround + (CRYSTAL[ch] - onGround) * crystalCover)
      }
      rgba[i + 3] = 255 // volledig dekkend; launchers verwachten geen transparantie
    }
  }

  return encodePng(size, size, rgba)
}

/* ─── Schrijven ───────────────────────────────────────────────────────────── */

const root = join(import.meta.dirname, '..')
const web = join(root, 'web')
const res = join(root, 'android', 'app', 'src', 'main', 'res')

// Een maskable icoon wordt door Android afgekapt tot een vorm naar keuze. Alleen
// de binnenste 80% (straal 0,8) is gegarandeerd zichtbaar, dus daar blijft het
// beeldmerk met ruime marge binnen: 0,57 x 1,20 = 0,68.
const targets = [
  { file: join(web, 'icon-192.png'), size: 192, scale: 1.45 },
  { file: join(web, 'icon-512.png'), size: 512, scale: 1.45 },
  { file: join(web, 'icon-maskable-512.png'), size: 512, scale: 1.2 },
]

// Adaptief icoon voor de Android-app: 108 dp per laag, waarvan de launcher
// hooguit de binnenste 72 dp laat zien en alleen een cirkel van 66 dp
// gegarandeerd is (straal 0,61). Met 0,92 reikt de druppel tot 0,52: binnen de
// veilige zone, en in dezelfde verhouding tot de rand als het maskable icoon
// hierboven, zodat de app en de webversie op het beginscherm even groot ogen.
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [density, factor] of Object.entries(DENSITIES)) {
  const size = 108 * factor
  const dir = join(res, `mipmap-${density}`)
  targets.push(
    { file: join(dir, 'ic_launcher_foreground.png'), size, scale: 0.92, layer: 'foreground' },
    { file: join(dir, 'ic_launcher_monochrome.png'), size, scale: 0.92, layer: 'monochrome' },
  )
}

for (const { file, size, scale, layer } of targets) {
  const png = drawIcon(size, scale, layer)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, png)
  const name = relative(root, file).replaceAll('\\', '/')
  console.log(`${name.padEnd(68)} ${String(size).padStart(3)}px  ${String(png.length).padStart(6)} bytes`)
}
