import { db } from './db'
import type { DayRow, PhotoRow } from './db'
import { monthOf, median, shiftLateNight, yearOf } from './dates'
import { isImage, makeThumb, readPhotoMeta, toPhotoRow } from './photo'

export interface ImportProgress {
  total: number
  scanned: number
  accepted: number
  skipped: number
  days: number
}

export interface ImportResult {
  imported: number
  days: number
  skipped: number
  exifTime: number
  mtime: number
  gps: number
  years: number[]
}

const CHUNK = 24

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export async function importFiles(
  files: File[],
  source: 'folder' | 'picker',
  onProgress: (p: ImportProgress) => void,
): Promise<ImportResult> {
  const images = files.filter(isImage)
  const progress: ImportProgress = { total: images.length, scanned: 0, accepted: 0, skipped: 0, days: 0 }
  onProgress({ ...progress })

  const importedAt = Date.now()
  const touched = new Set<string>()
  let pending: PhotoRow[] = []
  let pendingThumbs: Array<{ id: string; blob: Blob }> = []
  let imported = 0
  let skipped = 0
  let exifTime = 0
  let mtime = 0
  let gps = 0
  const years = new Set<number>()

  async function flush(): Promise<void> {
    if (!pending.length) return
    await db.transaction('rw', db.photos, db.thumbs, async () => {
      await db.photos.bulkPut(pending)
      if (pendingThumbs.length) await db.thumbs.bulkPut(pendingThumbs)
    })
    imported += pending.length
    pending = []
    pendingThumbs = []
  }

  for (let i = 0; i < images.length; i += 1) {
    const file = images[i]
    progress.scanned = i + 1

    try {
      const meta = await readPhotoMeta(file)
      const existing = await db.photos.get(meta.id)
      if (existing) {
        skipped += 1
        progress.skipped = skipped
        if (i % CHUNK === 0) onProgress({ ...progress })
        continue
      }

      const dayKey = shiftLateNight(meta.takenAt)
      const row = toPhotoRow(meta, dayKey, importedAt, source)
      pending.push(row)
      touched.add(dayKey)
      if (meta.takenAtSource === 'exif') exifTime += 1
      else mtime += 1
      if (meta.geoSource === 'exif') gps += 1
      years.add(Number(dayKey.slice(0, 4)))

      const thumb = await makeThumb(file)
      if (thumb) pendingThumbs.push({ id: meta.id, blob: thumb })

      progress.accepted += 1
      if (pending.length >= CHUNK) {
        await flush()
        onProgress({ ...progress })
        await yieldToUi()
      } else if (i % 8 === 0) {
        onProgress({ ...progress })
        await yieldToUi()
      }
    } catch {
      skipped += 1
      progress.skipped = skipped
    }
  }

  await flush()
  const days = await rebuildDays(Array.from(touched))
  progress.days = days
  onProgress({ ...progress })
  return {
    imported,
    days,
    skipped,
    exifTime,
    mtime,
    gps,
    years: Array.from(years).sort((a, b) => a - b),
  }
}

const IMPUTE_MAX_DAYS = 3

function dayDiff(a: string, b: string): number {
  return Math.abs(new Date(a + 'T12:00:00').getTime() - new Date(b + 'T12:00:00').getTime()) / 86400000
}

/** 没有 GPS 的日子，借用前后 3 天内最近的、有坐标的那一天 */
function imputeDays(days: DayRow[]): void {
  const anchors = days.filter((d) => typeof d.lat === 'number' && typeof d.lon === 'number')
  if (!anchors.length) return

  for (const day of days) {
    if (typeof day.lat === 'number' && typeof day.lon === 'number') {
      day.geoSource = 'exif'
      continue
    }
    let best: DayRow | null = null
    let bestGap = Infinity
    for (const anchor of anchors) {
      const gap = dayDiff(day.date, anchor.date)
      if (gap <= IMPUTE_MAX_DAYS && gap < bestGap) {
        best = anchor
        bestGap = gap
      }
    }
    if (best) {
      day.lat = best.lat
      day.lon = best.lon
      day.geoSource = 'imputed'
    } else {
      day.geoSource = 'none'
    }
  }
}

export async function rebuildDays(_dateKeys?: string[]): Promise<number> {
  const photos = await db.photos.toArray()
  const groups = new Map<string, PhotoRow[]>()
  for (const photo of photos) {
    const list = groups.get(photo.dayKey)
    if (list) list.push(photo)
    else groups.set(photo.dayKey, [photo])
  }

  const days: DayRow[] = []
  for (const [date, list] of groups) {
    const lats = list.filter((p) => typeof p.lat === 'number').map((p) => p.lat as number)
    const lons = list.filter((p) => typeof p.lon === 'number').map((p) => p.lon as number)

    let hero = list[0]
    let best = hero.width * hero.height
    for (const photo of list) {
      const area = photo.width * photo.height
      if (area > best || (area === best && photo.takenAt < hero.takenAt)) {
        hero = photo
        best = area
      }
    }

    days.push({
      date,
      year: yearOf(date),
      month: monthOf(date),
      lat: median(lats),
      lon: median(lons),
      photoIds: list.map((p) => p.id),
      heroPhotoId: hero.id,
      photoCount: list.length,
      createdAt: Date.now(),
    })
  }

  days.sort((a, b) => (a.date < b.date ? -1 : 1))
  imputeDays(days)

  const existing = await db.days.toArray()
  const stale = existing.filter((d) => !groups.has(d.date)).map((d) => d.date)
  if (stale.length) await db.days.bulkDelete(stale)

  await db.days.bulkPut(days)
  return days.length
}

export async function allDayKeys(): Promise<string[]> {
  return db.days.orderBy('date').keys() as Promise<string[]>
}
