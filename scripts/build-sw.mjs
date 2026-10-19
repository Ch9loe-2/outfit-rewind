/**
 * 生成 Service Worker：把构建产物预缓存起来，断网也能打开。
 * 不用 workbox，避免额外依赖；文件名带内容哈希，缓存名随构建变化。
 */
import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const DIST = new URL('../dist/', import.meta.url).pathname
const SKIP = new Set(['sw.js'])

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else out.push(full)
  }
  return out
}

const files = (await walk(DIST))
  .map((full) => relative(DIST, full).replaceAll('\\', '/'))
  .filter((rel) => !SKIP.has(rel) && !rel.endsWith('.map'))
  .sort()

const hash = createHash('sha256')
for (const rel of files) {
  const info = await stat(join(DIST, rel))
  hash.update(rel + ':' + info.size)
}
const version = hash.digest('hex').slice(0, 12)

const sw = `/* 由 scripts/build-sw.mjs 生成，请勿手改 */
const CACHE = 'outfit-rewind-${version}'
const ASSETS = ${JSON.stringify(files, null, 2)}

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
`

await writeFile(join(DIST, 'sw.js'), sw)
console.log('sw.js 已生成：' + files.length + ' 个文件，版本 ' + version)
