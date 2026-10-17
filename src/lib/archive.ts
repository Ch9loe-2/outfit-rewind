import { db } from './db'
import type { WeatherRow } from './db'

const ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive'
const FIELDS =
  'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,wind_speed_10m_max,weather_code,sunrise,sunset,relative_humidity_2m_mean'

export interface DayRef {
  date: string
  lat?: number
  lon?: number
}

export function locKeyOf(lat: number, lon: number): string {
  return lat.toFixed(1) + ',' + lon.toFixed(1)
}

interface ArchiveResponse {
  error?: boolean
  reason?: string
  daily?: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    apparent_temperature_max: number[]
    apparent_temperature_min: number[]
    precipitation_sum: number[]
    wind_speed_10m_max: number[]
    weather_code: number[]
    sunrise: string[]
    sunset: string[]
    relative_humidity_2m_mean?: Array<number | null>
  }
}

async function fetchYear(lat: number, lon: number, year: number): Promise<ArchiveResponse | null> {
  const today = new Date()
  const isCurrent = today.getFullYear() === year
  const start = year + '-01-01'
  const end = isCurrent
    ? year + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
    : year + '-12-31'

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: start,
    end_date: end,
    daily: FIELDS,
    timezone: 'auto',
  })

  const res = await fetch(ENDPOINT + '?' + params.toString())
  if (!res.ok) return null
  const data = (await res.json()) as ArchiveResponse
  if (data.error || !data.daily) return null
  return data
}

export interface WeatherSyncResult {
  fetched: number
  years: number
  failed: number
}

/**
 * 把一批「穿搭日」对应年份的天气补齐。按 位置×年 批量拉，跨年只发一次请求。
 */
export async function ensureWeather(
  days: DayRef[],
  resolve: (day: DayRef) => { lat: number; lon: number } | null,
  onProgress?: (done: number, total: number) => void,
): Promise<WeatherSyncResult> {
  const groups = new Map<string, { lat: number; lon: number; year: number }>()

  for (const day of days) {
    const place = resolve(day)
    if (!place) continue
    const year = Number(day.date.slice(0, 4))
    if (year < 1990) continue
    const locKey = locKeyOf(place.lat, place.lon)
    const id = locKey + ':' + year
    if (!groups.has(id)) {
      groups.set(id, { lat: place.lat, lon: place.lon, year })
    }
  }

  const entries = Array.from(groups.entries())
  let fetched = 0
  let years = 0
  let failed = 0
  let done = 0

  for (const [id, group] of entries) {
    const locKey = id.split(':')[0]
    const locYear = id
    const existing = await db.weather.where('locYear').equals(locYear).count()
    if (existing > 0) {
      done += 1
      onProgress?.(done, entries.length)
      continue
    }

    const data = await fetchYear(group.lat, group.lon, group.year)
    if (!data || !data.daily) {
      failed += 1
      done += 1
      onProgress?.(done, entries.length)
      continue
    }

    const daily = data.daily
    const rows: WeatherRow[] = []
    for (let i = 0; i < daily.time.length; i += 1) {
      const date = daily.time[i]
      const tMax = daily.temperature_2m_max[i]
      const tMin = daily.temperature_2m_min[i]
      if (typeof tMax !== 'number' || typeof tMin !== 'number') continue
      rows.push({
        key: locKey + ':' + date,
        locKey,
        locYear,
        date,
        tMax,
        tMin,
        feelsMax: daily.apparent_temperature_max[i] ?? tMax,
        feelsMin: daily.apparent_temperature_min[i] ?? tMin,
        precipSum: daily.precipitation_sum[i] ?? 0,
        windMax: daily.wind_speed_10m_max[i] ?? 0,
        humidityMean: daily.relative_humidity_2m_mean ? daily.relative_humidity_2m_mean[i] ?? null : null,
        uvMax: null,
        weatherCode: daily.weather_code[i] ?? 0,
        sunrise: daily.sunrise[i],
        sunset: daily.sunset[i],
        fetchedAt: Date.now(),
      })
    }

    if (rows.length) {
      await db.weather.bulkPut(rows)
      fetched += rows.length
      years += 1
    } else {
      failed += 1
    }

    done += 1
    onProgress?.(done, entries.length)
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  return { fetched, years, failed }
}
