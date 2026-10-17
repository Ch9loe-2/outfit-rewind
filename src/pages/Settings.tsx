import { useEffect, useState } from 'react'
import { useSettings } from '../lib/settings'
import type { GeoResult } from '../lib/weather'
import { searchPlaces } from '../lib/weather'
import type { Sensitivity } from '../lib/types'
import { clearAll, db, estimatedUsage } from '../lib/db'

const START_YEAR = 2015

function yearsToNow(): number[] {
  const now = new Date().getFullYear()
  const list: number[] = []
  for (let y = now; y >= START_YEAR; y -= 1) list.push(y)
  return list
}

export default function SettingsPage() {
  const { settings, update, setYearPlace, reset } = useSettings()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [searching, setSearching] = useState(false)
  const [target, setTarget] = useState<'home' | number>('home')
  const [stats, setStats] = useState<{ photos: number; days: number; mb: number } | null>(null)
  const [diag, setDiag] = useState<{ exif: number; mtime: number; gps: number; years: number[] } | null>(null)

  useEffect(() => {
    void refreshStats()
    void refreshDiag()
  }, [])

  async function refreshDiag() {
    const photos = await db.photos.toArray()
    const days = await db.days.toArray()
    const years = Array.from(new Set(days.map((d) => d.year))).sort((a, b) => a - b)
    setDiag({
      exif: photos.filter((p) => p.takenAtSource === 'exif').length,
      mtime: photos.filter((p) => p.takenAtSource !== 'exif').length,
      gps: photos.filter((p) => p.geoSource === 'exif').length,
      years,
    })
  }

  async function refreshStats() {
    const usage = await estimatedUsage()
    if (usage) {
      setStats({ photos: usage.photos, days: usage.days, mb: Math.round((usage.bytes / 1024 / 1024) * 10) / 10 })
    }
  }

  async function runSearch(value: string) {
    setQuery(value)
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      setResults(await searchPlaces(value))
    } finally {
      setSearching(false)
    }
  }

  function choose(place: GeoResult) {
    const value = {
      name: place.name,
      lat: place.latitude,
      lon: place.longitude,
      country: place.country,
      admin: place.admin1,
    }
    if (target === 'home') {
      update({ mode: 'fixed', place: value })
    } else {
      setYearPlace(target, value)
    }
    setResults([])
    setQuery('')
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
        {settings.place ? (
          <p className="muted small">
            当前城市：{settings.place.name}
            {settings.place.admin ? ' · ' + settings.place.admin : ''}
          </p>
        ) : null}
      </section>

      <section className="card">
        <h2>给某一年指定城市</h2>
        <p className="muted small">
          搬过家的话，早期的照片可能没有 GPS。指定年份后，那一年没有定位的照片会按这个城市取天气。
        </p>
        <select
          className="input"
          value={String(target)}
          onChange={(event) => {
            setTarget(event.target.value === 'home' ? 'home' : Number(event.target.value))
            setResults([])
            setQuery('')
          }}
        >
          <option value="home">用于：默认城市</option>
          {yearsToNow().map((year) => (
            <option key={year} value={year}>用于：{year} 年</option>
          ))}
        </select>
        <input
          className="input"
          placeholder={target === 'home' ? '搜索默认城市' : '搜索 ' + target + ' 年的城市'}
          value={query}
          onChange={(event) => void runSearch(event.target.value)}
        />
        {searching ? <p className="muted small">搜索中…</p> : null}
        {results.length ? (
          <ul className="result-list">
            {results.map((item) => (
              <li key={item.latitude + ':' + item.longitude}>
                <button className="result" onClick={() => choose(item)}>
                  <span>{item.name}</span>
                  <span className="muted small">{[item.admin1, item.country].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

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
          <li>
            <span>天气来源</span>
            <span className="muted">Open-Meteo</span>
          </li>
        </ul>
        <div className="actions">
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
