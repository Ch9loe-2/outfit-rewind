import type { DayRow } from './db'
import type { Place, Settings } from './types'

export function resolvePlace(day: DayRow, settings: Settings): { lat: number; lon: number } | null {
  if (typeof day.lat === 'number' && typeof day.lon === 'number') {
    return { lat: day.lat, lon: day.lon }
  }
  const override = settings.yearPlaces[String(day.year)]
  if (override) return { lat: override.lat, lon: override.lon }
  if (settings.place) return { lat: settings.place.lat, lon: settings.place.lon }
  return null
}

export function yearPlaceOf(day: DayRow, settings: Settings): Place | null {
  return settings.yearPlaces[String(day.year)] ?? null
}
