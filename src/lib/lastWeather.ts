import type { DailyWeather } from './types'

const KEY = 'outfit-rewind:last-weather'

export function saveLastWeather(daily: DailyWeather): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(daily))
  } catch {
    /* 忽略配额错误 */
  }
}

export function readLastWeather(): DailyWeather | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DailyWeather
    if (!parsed || typeof parsed.feelsMax !== 'number') return null
    return parsed
  } catch {
    return null
  }
}
