import { db, voteId } from './db'
import type { VoteRow } from './db'
import { todayKey } from './dates'

const DIMENSIONS = ['feelsMean', 'tempRange', 'precip', 'windMax', 'humidity', 'uv']

/** 某一天的标注，只有基准日一致才算数 */
export async function loadVotes(baseline = todayKey()): Promise<Record<string, 1 | -1>> {
  const rows = await db.votes.where('baseline').equals(baseline).toArray()
  const map: Record<string, 1 | -1> = {}
  for (const row of rows) map[row.date] = row.vote
  return map
}

export async function setVote(
  date: string,
  baseline: string,
  vote: 1 | -1,
  score: number,
  deltas?: Record<string, number>,
): Promise<VoteRow> {
  const row: VoteRow = { id: voteId(date, baseline), date, baseline, vote, score, deltas, at: Date.now() }
  await db.votes.put(row)
  return row
}

export async function clearVote(date: string, baseline: string): Promise<void> {
  await db.votes.delete(voteId(date, baseline))
}

/** 把旧的、只按日期存的标注迁进来，基准日取投票当天 */
export async function migrateLegacyVotes(): Promise<number> {
  const legacy = await db.feedback.toArray()
  if (!legacy.length) return 0

  const rows: VoteRow[] = legacy.map((row) => {
    const baseline = new Date(row.at).toISOString().slice(0, 10)
    return {
      id: voteId(row.date, baseline),
      date: row.date,
      baseline,
      vote: row.vote,
      score: row.score,
      deltas: row.deltas,
      at: row.at,
    }
  })

  await db.transaction('rw', db.votes, db.feedback, async () => {
    await db.votes.bulkPut(rows)
    await db.feedback.clear()
  })

  return rows.length
}

/**
 * 只导出数字：投票、分数、六维差值。
 * 不含照片、地点、日期——发出去也不泄露隐私。
 */
export function votesToCsv(
  rows: Array<{ vote: 1 | -1; score: number; deltas?: Record<string, number>; at: number; date?: string }>,
): string {
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
