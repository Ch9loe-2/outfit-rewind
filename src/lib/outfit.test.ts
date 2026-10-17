import { describe, expect, it } from 'vitest'
import { advise } from './outfit'
import type { DailyWeather } from './types'

function day(patch: Partial<DailyWeather>): DailyWeather {
  return {
    date: '2026-10-17',
    weatherCode: 3,
    tempMax: 20,
    tempMin: 12,
    feelsMax: 20,
    feelsMin: 12,
    sunrise: '2026-10-17T06:00',
    sunset: '2026-10-17T17:30',
    uvMax: 3,
    precipProb: 0,
    precipSum: 0,
    windMax: 10,
    humidityMean: 60,
    ...patch,
  }
}

describe('outfit.advise', () => {
  it('炎热天气只给内搭', () => {
    const advice = advise(day({ feelsMax: 32, feelsMin: 26 }), 0)
    expect(advice.layers.base).toBeTruthy()
    expect(advice.layers.outer).toBe('')
  })

  it('寒冷天气给三层', () => {
    const advice = advise(day({ feelsMax: 2, feelsMin: -4 }), 0)
    expect(advice.layers.mid).toBeTruthy()
    expect(advice.layers.outer).toBeTruthy()
  })

  it('下雨加伞，紫外线强加防晒', () => {
    const advice = advise(day({ precipProb: 80, precipSum: 6, uvMax: 8 }), 0)
    expect(advice.accessories).toContain('带伞')
    expect(advice.accessories).toContain('防晒霜')
  })

  it('怕冷的人整体下移一档', () => {
    const normal = advise(day({ feelsMax: 21, feelsMin: 19 }), 0)
    const cold = advise(day({ feelsMax: 21, feelsMin: 19 }), -1)
    expect(cold.bandLabel).not.toBe(normal.bandLabel)
  })
})
