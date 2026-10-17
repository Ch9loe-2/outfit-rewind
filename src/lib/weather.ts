import type { CurrentWeather, DailyWeather, WeatherBundle } from './types'

const DESCRIPTIONS: Record<number, string> = {
  0: '晴',
  1: '大致晴朗',
  2: '多云',
  3: '阴',
  45: '有雾',
  48: '雾凇',
  51: '小毛毛雨',
  53: '毛毛雨',
  55: '大毛毛雨',
  56: '冻毛毛雨',
  57: '冻毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '冻雨',
  67: '冻雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '米雪',
  80: '阵雨',
  81: '强阵雨',
  82: '暴雨',
  85: '阵雪',
  86: '强阵雪',
  95: '雷阵雨',
  96: '雷阵雨伴冰雹',
  99: '强雷暴伴冰雹',
}

export const ICONS: Record<number, string> = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  56: '🌧️',
  57: '🌧️',
  61: '🌦️',
  63: '🌧️',
  65: '🌧️',
  66: '🌧️',
  67: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '❄️',
  77: '🌨️',
  80: '🌦️',
  81: '🌧️',
  82: '⛈️',
  85: '🌨️',
  86: '❄️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️',
}

export function describe(code: number): string {
  return DESCRIPTIONS[code] ?? '未知天气'
}

export function icon(code: number): string {
  return ICONS[code] ?? '🌡️'
}

interface OpenMeteoResponse {
  timezone: string
  current: {
    time: string
    temperature_2m: number
    relative_humidity_2m: number
    apparent_temperature: number
    precipitation: number
    weather_code: number
    wind_speed_10m: number
    is_day: number
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    apparent_temperature_max: number[]
    apparent_temperature_min: number[]
    sunrise: string[]
    sunset: string[]
    uv_index_max: number[]
    precipitation_probability_max: number[]
    precipitation_sum: number[]
    wind_speed_10m_max: number[]
  }
  hourly: {
    time: string[]
    relative_humidity_2m: number[]
  }
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherBundle> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',
    hourly: 'relative_humidity_2m',
    timezone: 'auto',
    forecast_days: '1',
  })

  const res = await fetch('https://api.open-meteo.com/v1/forecast?' + params.toString())
  if (!res.ok) {
    throw new Error('天气请求失败：' + res.status)
  }
  const data = (await res.json()) as OpenMeteoResponse
  const day = data.daily.time[0]
  const humidity = data.hourly.time
    .map((t, i) => ({ t, v: data.hourly.relative_humidity_2m[i] }))
    .filter((x) => x.t.startsWith(day))
    .map((x) => x.v)

  const current: CurrentWeather = {
    temperature: data.current.temperature_2m,
    apparent: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    precipitation: data.current.precipitation,
    weatherCode: data.current.weather_code,
    windSpeed: data.current.wind_speed_10m,
    isDay: data.current.is_day === 1,
    time: data.current.time,
  }

  const daily: DailyWeather = {
    date: day,
    weatherCode: data.daily.weather_code[0],
    tempMax: data.daily.temperature_2m_max[0],
    tempMin: data.daily.temperature_2m_min[0],
    feelsMax: data.daily.apparent_temperature_max[0],
    feelsMin: data.daily.apparent_temperature_min[0],
    sunrise: data.daily.sunrise[0],
    sunset: data.daily.sunset[0],
    uvMax: data.daily.uv_index_max[0],
    precipProb: data.daily.precipitation_probability_max[0] ?? 0,
    precipSum: data.daily.precipitation_sum[0] ?? 0,
    windMax: data.daily.wind_speed_10m_max[0],
    humidityMean: humidity.length
      ? Math.round(humidity.reduce((a, b) => a + b, 0) / humidity.length)
      : null,
  }

  return { current, daily, timezone: data.timezone, fetchedAt: Date.now() }
}

export interface GeoResult {
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
}

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  if (!query.trim()) return []
  const params = new URLSearchParams({
    name: query.trim(),
    count: '8',
    language: 'zh',
    format: 'json',
  })
  const res = await fetch('https://geocoding-api.open-meteo.com/v1/search?' + params.toString())
  if (!res.ok) return []
  const data = (await res.json()) as { results?: GeoResult[] }
  return data.results ?? []
}

export function windLevel(kmh: number): number {
  const steps = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118]
  let level = 0
  for (const s of steps) {
    if (kmh >= s) level += 1
  }
  return level
}

export function clock(iso: string): string {
  const part = iso.split('T')[1]
  return part ? part.slice(0, 5) : iso
}
