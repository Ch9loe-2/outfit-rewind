import type { FeedbackRow } from './db'

const DIMENSIONS = ['feelsMean', 'tempRange', 'precip', 'windMax', 'humidity', 'uv']

/**
 * 只导出数字：投票、分数、六维差值。
 * 不含照片、地点、日期——发出去也不泄露隐私。
 */
export function votesToCsv(rows: FeedbackRow[]): string {
  const header = ['vote', 'score', ...DIMENSIONS].join(',')
  const lines = rows
    .slice()
    .sort((a, b) => a.at - b.at)
    .map((row) => {
      const deltas = row.deltas ?? {}
      const cells = DIMENSIONS.map((key) => {
        const value = deltas[key]
        return typeof value === 'number' ? value.toFixed(3) : ''
      })
      return [String(row.vote), String(row.score), ...cells].join(',')
    })
  return [header, ...lines].join('\n') + '\n'
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
