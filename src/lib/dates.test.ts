import { describe, expect, it } from 'vitest'
import { median, shiftLateNight } from './dates'

describe('dates', () => {
  it('凌晨 0–4 点归到前一天', () => {
    const ts = new Date(2026, 9, 2, 1, 30).getTime()
    expect(shiftLateNight(ts)).toBe('2026-10-01')
  })

  it('中午不往前挪', () => {
    const ts = new Date(2026, 9, 2, 12, 0).getTime()
    expect(shiftLateNight(ts)).toBe('2026-10-02')
  })

  it('4 点整算当天', () => {
    const ts = new Date(2026, 9, 2, 4, 0).getTime()
    expect(shiftLateNight(ts)).toBe('2026-10-02')
  })

  it('中位数', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeUndefined()
  })
})
