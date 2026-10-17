import { describe, expect, it } from 'vitest'
import { CITIES, searchCities } from './cities'

describe('cities.search', () => {
  it('中文精确匹配排第一', () => {
    expect(searchCities('杭州')[0].name).toBe('杭州')
    expect(searchCities('焦作')[0].name).toBe('焦作')
  })

  it('拼音和首字母都能命中', () => {
    expect(searchCities('hangzhou')[0].name).toBe('杭州')
    expect(searchCities('jz')[0].name).toBe('焦作')
    expect(searchCities('bj')[0].name).toBe('北京')
  })

  it('覆盖全部地级市', () => {
    expect(CITIES.length).toBeGreaterThan(300)
    const names = new Set(CITIES.map((c) => c.name))
    for (const city of ['焦作', '三门峡', '丽水', '克拉玛依', '三亚']) {
      expect(names.has(city)).toBe(true)
    }
  })

  it('空查询返回空', () => {
    expect(searchCities('   ')).toEqual([])
  })
})
