import { db } from './db'
import type { DayRow, WeatherRow } from './db'
import { locKeyOf } from './archive'
import { placeOf } from './places'
import { match, toFeature, todayInput } from './similarity'
import type { MatchResult } from './similarity'
import type { DailyWeather, Settings } from './types'

export interface MatchRow {
  day: DayRow
  weather: WeatherRow | null
  result: MatchResult | null
}

/** 把「穿搭日」和「那天天气」对齐，并算好与今天的相似度。Rewind 和首页共用。 */
export async function buildMatches(settings: Settings, today: DailyWeather | null): Promise<MatchRow[]> {
  const days = await db.days.toArray()
  if (!days.length) return []

  const keys: string[] = []
  const places = new Map<string, { lat: number; lon: number } | null>()

  for (const day of days) {
    const place = placeOf(day, settings)
    places.set(day.date, place)
    if (place) keys.push(locKeyOf(place.lat, place.lon) + ':' + day.date)
  }

  const weathers = keys.length ? await db.weather.bulkGet(keys) : []
  const weatherByKey = new Map<string, WeatherRow>()
  keys.forEach((key, index) => {
    const row = weathers[index]
    if (row) weatherByKey.set(key, row)
  })

  const todayFeature = today ? toFeature(todayInput(today)) : null

  return days.map((day) => {
    const place = places.get(day.date)
    const key = place ? locKeyOf(place.lat, place.lon) + ':' + day.date : ''
    const weather = key ? weatherByKey.get(key) ?? null : null
    const result = todayFeature && weather ? match(todayFeature, toFeature(weather)) : null
    return { day, weather, result }
  })
}
