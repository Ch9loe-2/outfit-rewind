/* 由 scripts/build-sw.mjs 生成，请勿手改 */
const CACHE = 'outfit-rewind-f36d01644506'
const ASSETS = [
  "assets/Day-BT_maaxR.js",
  "assets/Import-JRA7r_mL.js",
  "assets/Settings-CXFEqCBC.js",
  "assets/full.esm-DoFl4RTa.js",
  "assets/heic2any-DcAyGuPE.js",
  "assets/importer-ZeScZjmJ.js",
  "assets/index-Wh1-yL4a.css",
  "assets/index-kGwmABTh.js",
  "favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest"
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // 只管自己的静态资源；天气接口交给浏览器直连
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(new URL('index.html', self.registration.scope).href)),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy))
        return response
      })
    }),
  )
})
