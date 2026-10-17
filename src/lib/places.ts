import type { DayRow } from './db'
import type { Place, Settings } from './types'

export function periodOf(day: DayRow, settings: Settings) {
  return (settings.periods ?? []).find((p) => day.date >= p.from && day.date <= p.to)
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
