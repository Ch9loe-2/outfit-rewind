import { useEffect, useState } from 'react'
import CitySearch from '../components/CitySearch'
import { useSettings } from '../lib/settings'
import type { Sensitivity } from '../lib/types'
import { clearAll, db, estimatedUsage } from '../lib/db'
import { rebuildDays } from '../lib/importer'

const START_YEAR = 2015

function yearsToNow(): number[] {
  const now = new Date().getFullYear()
  const list: number[] = []
  for (let y = now; y >= START_YEAR; y -= 1) list.push(y)
  return list
}

export default function SettingsPage() {
  const { settings, update, setYearPlace, reset } = useSettings()
  const [targetYear, setTargetYear] = useState(new Date().getFullYear())
  const [stats, setStats] = useState<{ photos: number; days: number; mb: number } | null>(null)
  const [diag, setDiag] = useState<{
    exif: number
    mtime: number
    gps: number
    years: number[]
    gaps: Array<{ year: number; total: number; none: number; imputed: number }>
  } | null>(null)
  const [rebuilding, setRebuilding] = useState(false)

  useEffect(() => {
    void refreshStats()
    void refreshDiag()
  }, [])

  async function refreshStats() {
    const usage = await estimatedUsage()
    if (usage) {
      setStats({ photos: usage.photos, days: usage.days, mb: Math.round((usage.bytes / 1024 / 1024) * 10) / 10 })
    }
  }

  async function refreshDiag() {
    const photos = await db.photos.toArray()
    const days = await db.days.toArray()
    const years = Array.from(new Set(days.map((d) => d.year))).sort((a, b) => a - b)

    const byYear = new Map<number, { total: number; none: number; imputed: number }>()
    for (const day of days) {
      const row = byYear.get(day.year) ?? { total: 0, none: 0, imputed: 0 }
      row.total += 1
      if (day.geoSource === 'imputed') row.imputed += 1
      else if (day.geoSource === 'none' || (day.geoSource === undefined && typeof day.lat !== 'number')) row.none += 1
      byYear.set(day.year, row)
    }
    const gaps = Array.from(byYear.entries())
      .map(([year, v]) => ({ year, ...v }))
      .sort((a, b) => b.year - a.year)

    setDiag({
      exif: photos.filter((p) => p.takenAtSource === 'exif').length,
      mtime: photos.filter((p) => p.takenAtSource !== 'exif').length,
      gps: photos.filter((p) => p.geoSource === 'exif').length,
      years,
      gaps,
    })
  }

  const overrides = Object.entries(settings.yearPlaces).sort((a, b) => Number(b[0]) - Number(a[0]))

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="place">设置</div>
          <div className="date">只看你需要的</div>
        </div>
      </header>

      <section className="card">
        <h2>位置</h2>
        <div className="segmented">
          <button
            className={settings.mode === 'auto' ? 'seg seg-active' : 'seg'}
            onClick={() => update({ mode: 'auto' })}
          >
            自动定位
          </button>
          <button
            className={settings.mode === 'fixed' ? 'seg seg-active' : 'seg'}
            onClick={() => update({ mode: 'fixed' })}
          >
            手动选城市
          </button>
        </div>
        <p className="muted small">
          当前生效：
          {settings.mode === 'auto'
            ? '自动定位' + (settings.place ? '（定位失败时用 ' + settings.place.name + '）' : '')
            : '手动 · ' + (settings.place ? settings.place.name : '未选择')}
        </p>
        {settings.place && settings.mode === 'fixed' ? (
          <p className="muted small">
            当前城市：{settings.place.name}
            {settings.place.admin ? ' · ' + settings.place.admin : ''}
          </p>
        ) : null}
        <CitySearch placeholder="搜索城市，例如 杭州" onPick={(place) => update({ mode: 'fixed', place })} />
        <p className="muted small">
          定位被拒也能用：选一个城市后，首页会一直用它。iPhone 想让定位恢复，去「设置 → 隐私与安全性 → 定位服务 → Safari 网站」。
        </p>
      </section>

      <section className="card">
        <h2>给某一年指定城市</h2>
        <p className="muted small">搬过家时，早期的照片可能没有 GPS。给那一年指定城市后，没定位的照片就按这个城市取天气。</p>
        <select
          className="input"
          value={targetYear}
          onChange={(event) => setTargetYear(Number(event.target.value))}
        >
          {yearsToNow().map((year) => (
            <option key={year} value={year}>{year} 年</option>
          ))}
        </select>
        <CitySearch
          placeholder={'搜索 ' + targetYear + ' 年的城市'}
          onPick={(place) => setYearPlace(targetYear, place)}
        />
        {overrides.length ? (
          <ul className="plain-list">
            {overrides.map(([year, place]) => (
              <li key={year}>
                <span>{year} 年 · {place.name}</span>
                <button className="link-btn" onClick={() => setYearPlace(Number(year), null)}>移除</button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card">
        <h2>体感偏好</h2>
        <p className="muted small">会整体平移推荐区间 2°C，只影响建议，不影响天气数据。</p>
        <div className="segmented">
          {[
            { value: -1 as Sensitivity, label: '怕冷' },
            { value: 0 as Sensitivity, label: '正常' },
            { value: 1 as Sensitivity, label: '怕热' },
          ].map((option) => (
            <button
              key={option.value}
              className={settings.sensitivity === option.value ? 'seg seg-active' : 'seg'}
              onClick={() => update({ sensitivity: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>历史起点</h2>
        <select
          className="input"
          value={settings.historyStartYear}
          onChange={(event) => update({ historyStartYear: Number(event.target.value) })}
        >
          {yearsToNow().map((year) => (
            <option key={year} value={year}>{year} 年</option>
          ))}
        </select>
      </section>

      <section className="card">
        <h2>本机数据</h2>
        <ul className="plain-list">
          <li>
            <span>照片</span>
            <span>{stats ? stats.photos + ' 张' : '—'}</span>
          </li>
          <li>
            <span>穿搭日</span>
            <span>{stats ? stats.days + ' 天' : '—'}</span>
          </li>
          <li>
            <span>占用</span>
            <span>{stats ? stats.mb + ' MB' : '—'}</span>
          </li>
          <li>
            <span>拍摄时间</span>
            <span>{diag ? 'EXIF ' + diag.exif + ' · 文件 ' + diag.mtime : '—'}</span>
          </li>
          <li>
            <span>带 GPS</span>
            <span>{diag && stats && stats.photos ? Math.round((diag.gps / stats.photos) * 100) + '%' : '—'}</span>
          </li>
          <li>
            <span>覆盖年份</span>
            <span>{diag && diag.years.length ? diag.years[0] + '–' + diag.years[diag.years.length - 1] : '—'}</span>
          </li>
        </ul>
        {diag && diag.gaps.some((g) => g.none > 0) ? (
          <div className="gap-list">
            <p className="muted small">这些年份有照片没有定位，会按「给某一年指定城市」或默认城市取天气：</p>
            {diag.gaps
              .filter((g) => g.none > 0)
              .map((g) => (
                <div className="gap-row" key={g.year}>
                  <span>{g.year} 年</span>
                  <span className="muted small">
                    {g.total} 天 · {g.none} 天无定位
                    {g.imputed ? ' · ' + g.imputed + ' 天按邻近推断' : ''}
                  </span>
                </div>
              ))}
          </div>
        ) : null}
        <div className="actions">
          <button
            className="btn btn-ghost"
            disabled={rebuilding}
            onClick={async () => {
              setRebuilding(true)
              await rebuildDays()
              await refreshStats()
              await refreshDiag()
              setRebuilding(false)
            }}
          >
            {rebuilding ? '重新聚合中…' : '重新聚合'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              if (!confirm('清空本机所有照片索引、缩略图和天气缓存？此操作不可撤销。')) return
              await clearAll()
              await refreshStats()
              await refreshDiag()
            }}
          >
            清空本机数据
          </button>
        </div>
      </section>

      <section className="card">
        <h2>其他</h2>
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (confirm('恢复默认设置？照片和回忆不会被删除。')) reset()
          }}
        >
          恢复默认设置
        </button>
      </section>

      <footer className="foot">outfit-rewind · MIT · 数据 CC-BY-4.0</footer>
    </div>
  )
}
