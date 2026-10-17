const LATE_NIGHT_HOUR = 4

export function dateKeyOf(ts: number): string {
  const d = new Date(ts)
  return pad(d.getFullYear()) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

export function shiftLateNight(ts: number): string {
  const d = new Date(ts)
  if (d.getHours() < LATE_NIGHT_HOUR) {
    d.setDate(d.getDate() - 1)
  }
  return pad(d.getFullYear()) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

export function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function todayKey(): string {
  return dateKeyOf(Date.now())
}

export function yearOf(dateKey: string): number {
  return Number(dateKey.slice(0, 4))
}

export function monthOf(dateKey: string): string {
  return dateKey.slice(0, 7)
}

export function seasonOf(dateKey: string): 'spring' | 'summer' | 'autumn' | 'winter' {
  const m = Number(dateKey.slice(5, 7))
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}

export function humanDate(dateKey: string): string {
  const y = dateKey.slice(0, 4)
  const m = Number(dateKey.slice(5, 7))
  const d = Number(dateKey.slice(8, 10))
  return y + ' 年 ' + m + ' 月 ' + d + ' 日'
}

export function weekdayOf(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00')
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
}

export function median(values: number[]): number | undefined {
  if (!values.length) return undefined
  const sorted = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
