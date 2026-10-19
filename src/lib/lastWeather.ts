import type { DailyWeather, WeatherBundle } from './types'

const KEY = 'outfit-rewind:last-weather'
const BUNDLE_KEY = 'outfit-rewind:last-bundle'

export function saveLastWeather(daily: DailyWeather): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(daily))
  } catch {
    /* 忽略配额错误 */
  }
}

/** 整包缓存（实况 + 今日预报），断网时用来降级显示 */
export function saveBundle(bundle: WeatherBundle): void {
  try {
    localStorage.setItem(BUNDLE_KEY, JSON.stringify({ bundle, savedAt: Date.now() }))
  } catch {
    /* 忽略配额错误 */
  }
}

export function readBundle(): { bundle: WeatherBundle; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(BUNDLE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { bundle: WeatherBundle; savedAt: number }
    if (!parsed?.bundle?.daily || typeof parsed.bundle.daily.feelsMax !== 'number') return null
    return parsed
  } catch {
    return null
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
