const CACHE_NAME = '4e-crm-static-v2'
const STATIC_ASSETS = ['/4ELogo.png']
const CACHEABLE_DESTINATIONS = new Set(['style', 'script', 'worker', 'font', 'image'])
const STATIC_FILE_PATTERN =
  /\.(?:css|js|mjs|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf)$/i

function isCacheableStaticRequest(request) {
  if (request.method !== 'GET') return false
  if (request.mode === 'navigate') return false

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return false

  if (url.pathname.startsWith('/api/')) return false

  if (url.pathname.startsWith('/_next/')) return true

  if (STATIC_ASSETS.includes(url.pathname)) return true

  if (CACHEABLE_DESTINATIONS.has(request.destination)) return true

  return STATIC_FILE_PATTERN.test(url.pathname)
}

async function cacheFirst(request) {
  const cached = await caches.match(request)

  if (cached) {
    return cached
  }

  const response = await fetch(request)

  if (!response || !response.ok) {
    return response
  }

  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response.clone())

  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (!isCacheableStaticRequest(request)) {
    return
  }

  event.respondWith(cacheFirst(request))
})
