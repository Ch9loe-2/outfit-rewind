export interface CurrentWeather {
  temperature: number
  apparent: number
  humidity: number
  precipitation: number
  weatherCode: number
  windSpeed: number
  isDay: boolean
  time: string
}

export interface DailyWeather {
  date: string
  weatherCode: number
  tempMax: number
  tempMin: number
  feelsMax: number
  feelsMin: number
  sunrise: string
  sunset: string
  uvMax: number
  precipProb: number
  precipSum: number
  windMax: number
  humidityMean: number | null
}

export interface WeatherBundle {
  current: CurrentWeather
  daily: DailyWeather
  timezone: string
  fetchedAt: number
}

export interface Place {
  name: string
  lat: number
  lon: number
  country?: string
  admin?: string
}

export type Sensitivity = -1 | 0 | 1

/** 一段时间在某个城市（旅行、出差、异地读书） */
export interface Period {
  id: string
  from: string
  to: string
  place: Place
}

export interface Settings {
  mode: 'auto' | 'fixed'
  place: Place | null
  unit: 'c' | 'f'
  sensitivity: Sensitivity
  historyStartYear: number
  matchThreshold: number
  yearPlaces: Record<string, Place>
  periods: Period[]
}
