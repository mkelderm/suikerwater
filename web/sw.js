// Service worker: maakt de app volledig offline bruikbaar.
//
// De app haalt niets van buiten (geen CDN, geen webfont, geen API), dus het is
// genoeg om alle bestanden één keer op te slaan.
//
// Strategie: stale-while-revalidate. Een verzoek wordt onmiddellijk uit de cache
// beantwoord — dus altijd snel, en zonder netwerk net zo goed — en daarna wordt
// de cache op de achtergrond bijgewerkt. Een wijziging in de app is daarmee bij
// de volgende start zichtbaar, zonder dat je hier iets voor hoeft te doen.
//
// Verhoog VERSION alleen als je een update meteen wilt forceren; dat gooit de
// oude cache in één keer weg in plaats van bestand voor bestand.

const VERSION = 'v4'
const CACHE = `suikerwater-${VERSION}`

// Relatieve paden, zodat de app ook werkt in een submap (zoals op GitHub Pages).
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './calc.js',
  './manifest.webmanifest',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // Niet cache.addAll: dat laat de hele installatie mislukken zodra één
      // bestand niet op te halen is. Per bestand proberen is hier veiliger.
      await Promise.all(
        ASSETS.map(url =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      )
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter(name => name.startsWith('suikerwater-') && name !== CACHE)
          .map(name => caches.delete(name))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', event => {
  const { request } = event

  // Alleen gewone GET-verzoeken naar onze eigen oorsprong gaan via de cache.
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request, { ignoreSearch: true })

      // Het netwerk wordt altijd geprobeerd, maar nooit afgewacht als er al
      // iets in de cache zit.
      const fromNetwork = fetch(request)
        .then(response => {
          if (response.ok && response.type === 'basic') {
            cache.put(request, response.clone()).catch(() => {})
          }
          return response
        })
        .catch(() => null)

      if (cached) {
        // Bijwerken mag doorlopen nadat het antwoord al verstuurd is.
        event.waitUntil(fromNetwork)
        return cached
      }

      const response = await fromNetwork
      if (response) return response

      // Offline en niets in de cache: voor een paginabezoek alsnog de app
      // teruggeven, zodat je nooit op een browserfoutpagina belandt.
      if (request.mode === 'navigate') {
        const shell = await cache.match('./index.html')
        if (shell) return shell
      }
      return Response.error()
    })()
  )
})
