import Dexie from 'dexie'
import type { Table } from 'dexie'

export interface PhotoRow {
  id: string
  dayKey: string
  takenAt: number
  takenAtSource: 'exif' | 'mtime'
  lat?: number
  lon?: number
  geoSource: 'exif' | 'none'
  width: number
  height: number
  mime: string
  bytes: number
  importedAt: number
  source: 'folder' | 'picker'
}

export interface DayRow {
  date: string
  year: number
  month: string
  lat?: number
  lon?: number
  photoIds: string[]
  heroPhotoId: string
  photoCount: number
  band?: string
  /** exif：照片自带坐标；imputed：借用附近有坐标的那一天；none：都没有 */
  geoSource?: 'exif' | 'imputed' | 'none'
  favorite?: 0 | 1
  createdAt: number
}

export interface WeatherRow {
  key: string
  locKey: string
  locYear: string
  date: string
  tMax: number
  tMin: number
  feelsMax: number
  feelsMin: number
  precipSum: number
  windMax: number
  humidityMean: number | null
  uvMax: number | null
  weatherCode: number
  sunrise?: string
  sunset?: string
  fetchedAt: number
}

export interface MetaRow {
  k: string
  v: string
}

/** 用户对「这天和今天像不像」的标注，将来用来拟合权重 */
export interface FeedbackRow {
  date: string
  /** 1 = 像，-1 = 不像 */
  vote: 1 | -1
  /** 打分当时的相似度，便于事后分析 */
  score: number
  /** 投票那一刻的六维归一化差值，用于离线拟合权重 */
  deltas?: Record<string, number>
  at: number
}

class RewindDB extends Dexie {
  photos!: Table<PhotoRow, string>
  days!: Table<DayRow, string>
  weather!: Table<WeatherRow, string>
  thumbs!: Table<{ id: string; blob: Blob }, string>
  meta!: Table<MetaRow, string>
  feedback!: Table<FeedbackRow, string>

  constructor() {
    super('outfit-rewind')
    this.version(1).stores({
      photos: 'id, dayKey, takenAt',
      days: 'date, year, month',
      weather: 'key, locYear',
      thumbs: 'id',
      meta: 'k',
    })
    this.version(2).stores({
      photos: 'id, dayKey, takenAt',
      days: 'date, year, month, favorite',
      weather: 'key, locYear',
      thumbs: 'id',
      meta: 'k',
    })
    this.version(3).stores({
      photos: 'id, dayKey, takenAt',
      days: 'date, year, month, favorite',
      weather: 'key, locYear',
      thumbs: 'id',
      meta: 'k',
      feedback: 'date, vote',
    })
  }
}

export const db = new RewindDB()

export async function photoCount(): Promise<number> {
  return db.photos.count()
}

export async function dayCount(): Promise<number> {
  return db.days.count()
}

export async function thumbUrl(id: string): Promise<string | null> {
  const row = await db.thumbs.get(id)
  if (!row) return null
  return URL.createObjectURL(row.blob)
}

export async function clearAll(): Promise<void> {
  await Promise.all([db.photos.clear(), db.days.clear(), db.weather.clear(), db.thumbs.clear(), db.meta.clear()])
}

export async function estimatedUsage(): Promise<{ photos: number; days: number; bytes: number } | null> {
  if (!navigator.storage || !navigator.storage.estimate) return null
  const photos = await db.photos.count()
  const days = await db.days.count()
  const est = await navigator.storage.estimate()
  return { photos, days, bytes: est.usage ?? 0 }
}
