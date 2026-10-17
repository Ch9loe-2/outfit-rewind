import type { DayRow } from './db'
import type { Place, Settings } from './types'

/** 命中多个时，后添加的那条生效 */
export function periodOf(day: DayRow, settings: Settings) {
  let best: { from: string; to: string; place: { lat: number; lon: number; name: string }; createdAt?: number; id: string } | undefined
  for (const period of settings.periods ?? []) {
    if (day.date < period.from || day.date > period.to) continue
    if (!best || (period.createdAt ?? 0) >= (best.createdAt ?? 0)) best = period
  }
  return best
}

export function overlaps(a: { from: string; to: string }, b: { from: string; to: string }): boolean {
  return a.from <= b.to && b.from <= a.to
}

/**
 * 优先级：照片自带坐标 > 时间段 > 年份 > 邻近推断 > 常驻城市
 * 推断出来的坐标是猜的，用户明确指定的时间段应该盖过它。
 */
export function placeOf(day: DayRow, settings: Settings): { lat: number; lon: number; label?: string } | null {
  const hasCoords = typeof day.lat === 'number' && typeof day.lon === 'number'
  const trusted = hasCoords && day.geoSource !== 'imputed'

  if (trusted) {
    return { lat: day.lat as number, lon: day.lon as number }
  }

  const period = periodOf(day, settings)
  if (period) return { lat: period.place.lat, lon: period.place.lon, label: period.place.name }

  const override = settings.yearPlaces[String(day.year)]
  if (override) return { lat: override.lat, lon: override.lon, label: override.name }

  if (hasCoords) return { lat: day.lat as number, lon: day.lon as number }

  if (settings.place) return { lat: settings.place.lat, lon: settings.place.lon, label: settings.place.name }
  return null
}

export function resolvePlace(day: DayRow, settings: Settings): { lat: number; lon: number } | null {
  const found = placeOf(day, settings)
  return found ? { lat: found.lat, lon: found.lon } : null
}

export function yearPlaceOf(day: DayRow, settings: Settings): Place | null {
  return settings.yearPlaces[String(day.year)] ?? null
}
