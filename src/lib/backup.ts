import { db } from './db'
import type { DayRow, FeedbackRow, PhotoRow, WeatherRow } from './db'
import { createZip, readZip } from './zip'
import type { ZipEntry } from './zip'

const SETTINGS_KEY = 'outfit-rewind:settings:v1'
const MANIFEST = 'backup.json'
const VERSION = 1

interface Manifest {
  version: number
  exportedAt: string
  settings: string | null
  days: DayRow[]
  photos: PhotoRow[]
  weather: WeatherRow[]
  feedback?: FeedbackRow[]
}

export interface BackupStats {
  days: number
  photos: number
  weather: number
  thumbs: number
  feedback: number
  bytes: number
}

export async function exportBackup(includeThumbs = true): Promise<{ blob: Blob; stats: BackupStats }> {
  const [days, photos, weather, thumbs, feedback] = await Promise.all([
    db.days.toArray(),
    db.photos.toArray(),
    db.weather.toArray(),
    includeThumbs ? db.thumbs.toArray() : Promise.resolve([]),
    db.feedback.toArray(),
  ])

  const manifest: Manifest = {
    version: VERSION,
    exportedAt: new Date().toISOString(),
    settings: localStorage.getItem(SETTINGS_KEY),
    days,
    photos,
    weather,
    feedback,
  }

  const entries: ZipEntry[] = [
    { name: MANIFEST, data: new TextEncoder().encode(JSON.stringify(manifest)) },
  ]

  for (const thumb of thumbs) {
    const buffer = await thumb.blob.arrayBuffer()
    entries.push({ name: 'thumbs/' + thumb.id + '.webp', data: new Uint8Array(buffer) })
  }

  const bytes = createZip(entries)
  const blob = new Blob([bytes], { type: 'application/zip' })
  return {
    blob,
    stats: {
      days: days.length,
      photos: photos.length,
      weather: weather.length,
      thumbs: thumbs.length,
      feedback: feedback.length,
      bytes: bytes.length,
    },
  }
}

export interface ImportResult {
  days: number
  photos: number
  thumbs: number
  weather: number
  hasSettings: boolean
}

export async function importBackup(file: File): Promise<ImportResult> {
  const entries = readZip(await file.arrayBuffer())
  const manifestEntry = entries.find((entry) => entry.name === MANIFEST)
  if (!manifestEntry) throw new Error('这个 zip 里没有 backup.json')

  const manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data)) as Manifest
  if (manifest.version !== VERSION) throw new Error('备份版本不兼容：' + manifest.version)

  const thumbEntries = entries.filter((entry) => entry.name.startsWith('thumbs/'))

  // 照片和缩略图按 id 去重，避免重复导入
  const existingPhotos = await db.photos.bulkGet(manifest.photos.map((photo) => photo.id))
  const newPhotos = manifest.photos.filter((_, index) => !existingPhotos[index])

  const thumbRows = thumbEntries.map((entry) => ({
    id: entry.name.slice('thumbs/'.length).replace(/\.webp$/, ''),
    blob: new Blob([entry.data], { type: 'image/webp' }),
  }))
  const existingThumbs = await db.thumbs.bulkGet(thumbRows.map((row) => row.id))
  const newThumbs = thumbRows.filter((_, index) => !existingThumbs[index])

  await db.transaction('rw', db.photos, db.days, db.weather, db.thumbs, db.feedback, async () => {
    if (newPhotos.length) await db.photos.bulkPut(newPhotos)
    if (newThumbs.length) await db.thumbs.bulkPut(newThumbs)
    if (manifest.days.length) await db.days.bulkPut(manifest.days)
    if (manifest.weather.length) await db.weather.bulkPut(manifest.weather)
    if (manifest.feedback?.length) await db.feedback.bulkPut(manifest.feedback)
  })

  if (manifest.settings) localStorage.setItem(SETTINGS_KEY, manifest.settings)

  return {
    days: manifest.days.length,
    photos: newPhotos.length,
    thumbs: newThumbs.length,
    weather: manifest.weather.length,
    hasSettings: Boolean(manifest.settings),
  }
}
