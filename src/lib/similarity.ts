import type { DailyWeather } from './types'

export interface DayWeather {
  date: string
  feelsMean: number
  tempRange: number
  precipSum: number
  windMax: number
  humidityMean: number
  uvMax: number
}

const SCALE = {
  feelsMean: 8,
  tempRange: 6,
  precipSum: 5,
  windMax: 20,
  humidityMean: 25,
  uvMax: 6,
}

const WEIGHT = {
  feelsMean: 0.35,
  tempRange: 0.15,
  precipSum: 0.2,
  windMax: 0.12,
  humidityMean: 0.1,
  uvMax: 0.08,
}

export function toDayWeather(w: DailyWeather): DayWeather {
  return {
    date: w.date,
    feelsMean: (w.feelsMax + w.feelsMin) / 2,
    tempRange: w.tempMax - w.tempMin,
    precipSum: w.precipSum,
    windMax: w.windMax,
    humidityMean: w.humidityMean ?? 60,
    uvMax: w.uvMax,
  }
}

export function similarity(today: DayWeather, other: DayWeather): number {
  const dims: Array<{ key: keyof typeof SCALE; a: number; b: number }> = [
    { key: 'feelsMean', a: today.feelsMean, b: other.feelsMean },
    { key: 'tempRange', a: today.tempRange, b: other.tempRange },
    { key: 'precipSum', a: Math.log1p(Math.max(0, today.precipSum)), b: Math.log1p(Math.max(0, other.precipSum)) },
    { key: 'windMax', a: today.windMax, b: other.windMax },
    { key: 'humidityMean', a: today.humidityMean, b: other.humidityMean },
    { key: 'uvMax', a: today.uvMax, b: other.uvMax },
  ]

  let weighted = 0
  let totalWeight = 0
  for (const dim of dims) {
    if (!Number.isFinite(dim.a) || !Number.isFinite(dim.b)) continue
    const w = WEIGHT[dim.key]
    weighted += w * (Math.abs(dim.a - dim.b) / SCALE[dim.key])
    totalWeight += w
  }
  if (totalWeight === 0) return 0
  const distance = weighted / totalWeight
  return Math.round(100 * Math.exp(-distance / 1.6))
}
