import { describe, expect, it } from 'vitest'
import { match, toFeature } from './similarity'

const base = {
  tMax: 22,
  tMin: 14,
  feelsMax: 23,
  feelsMin: 15,
  precipSum: 0,
  windMax: 12,
  humidityMean: 60,
  uvMax: 4,
}

describe('similarity.match', () => {
  it('同一天气得满分', () => {
    const result = match(toFeature(base), toFeature(base))
    expect(result.score).toBe(100)
    expect(result.confidence).toBe(1)
  })

  it('差异越大分数越低', () => {
    const near = match(toFeature(base), toFeature({ ...base, feelsMax: 25, feelsMin: 17 }))
    const far = match(toFeature(base), toFeature({ ...base, feelsMax: 38, feelsMin: 30 }))
    expect(near.score).toBeGreaterThan(far.score)
    expect(far.score).toBeLessThan(60)
  })

  it('缺 UV / 湿度时自动降权并降置信度', () => {
    const partial = match(
      toFeature({ ...base, humidityMean: null, uvMax: null }),
      toFeature({ ...base, humidityMean: null, uvMax: null }),
    )
    expect(partial.score).toBe(100)
    expect(partial.confidence).toBeLessThan(1)
    expect(partial.parts.every((p) => p.key !== 'uv' && p.key !== 'humidity')).toBe(true)
  })
})
