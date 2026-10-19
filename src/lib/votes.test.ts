import { describe, expect, it } from 'vitest'
import { votesToCsv } from './votes'

describe('votesToCsv', () => {
  it('表头固定，按时间排序', () => {
    const csv = votesToCsv([
      { date: 'a', vote: -1, score: 41, deltas: { feelsMean: 0.75, tempRange: 0.33 }, at: 2 },
      { date: 'b', vote: 1, score: 74, deltas: { feelsMean: 0.25 }, at: 1 },
    ])
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('vote,score,feelsMean,tempRange,precip,windMax,humidity,uv')
    expect(lines[1]).toContain('1,74,0.250')
    expect(lines[2]).toContain('-1,41,0.750,0.330')
  })

  it('缺差值时留空，不写 NaN', () => {
    const csv = votesToCsv([{ date: 'a', vote: 1, score: 60, at: 1 }])
    expect(csv).toContain('1,60,,,,,,')
    expect(csv).not.toContain('NaN')
  })

  it('不包含日期或地点', () => {
    const csv = votesToCsv([{ date: '2024-05-19', vote: 1, score: 60, at: 1 }])
    expect(csv).not.toContain('2024-05-19')
  })
})
