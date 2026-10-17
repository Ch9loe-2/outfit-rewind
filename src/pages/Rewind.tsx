import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import type { DayRow, WeatherRow } from '../lib/db'
import { ensureWeather, locKeyOf } from '../lib/archive'
import { readLastWeather } from '../lib/lastWeather'
import { placeOf, resolvePlace } from '../lib/places'
import { match, toFeature, todayInput } from '../lib/similarity'
import type { MatchResult } from '../lib/similarity'
import { useSettings } from '../lib/settings'
import { useThumb } from '../lib/useThumb'
import { describe, icon, windLevel } from '../lib/weather'

interface Row {
  day: DayRow
  weather: WeatherRow | null
  result: MatchResult | null
}

function Thumb({ id }: { id: string }) {
  const url = useThumb(id)
  return <div className="list-thumb">{url ? <img src={url} alt="" /> : <span className="shot-empty" />}</div>
}

export default function Rewind() {
  const { settings } = useSettings()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [year, setYear] = useState<'all' | number>('all')
  const [threshold, setThreshold] = useState(settings.matchThreshold)
  const [view, setView] = useState<'score' | 'time'>('score')
  const [onlyFav, setOnlyFav] = useState(false)
  const autoSynced = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    const days = (await db.days.toArray()).sort((a, b) => (a.date < b.date ? 1 : -1))
    const today = readLastWeather()

    const keys: string[] = []
    const places = new Map<string, { lat: number; lon: number } | null>()
    for (const day of days) {
      const place = resolvePlace(day, settings)
      places.set(day.date, place)
      if (place) keys.push(locKeyOf(place.lat, place.lon) + ':' + day.date)
    }
    const weathers = keys.length ? await db.weather.bulkGet(keys) : []
    const weatherByKey = new Map<string, WeatherRow>()
    keys.forEach((key, index) => {
      const row = weathers[index]
      if (row) weatherByKey.set(key, row)
    })

    const next: Row[] = days.map((day) => {
      const place = places.get(day.date)
      const key = place ? locKeyOf(place.lat, place.lon) + ':' + day.date : ''
      const weather = key ? weatherByKey.get(key) ?? null : null
      const result = today && weather ? match(toFeature(todayInput(today)), toFeature(weather)) : null
      return { day, weather, result }
    })

    next.sort((a, b) => {
      if (a.result && b.result) return b.result.score - a.result.score
      if (a.result) return -1
      if (b.result) return 1
      return a.day.date < b.day.date ? 1 : -1
    })

    setRows(next)
    setLoading(false)
  }, [settings])

  useEffect(() => {
    void load()
  }, [load])

  async function syncWeather() {
    setSyncing(true)
    const days = await db.days.toArray()
    // 和展示用同一套解析：照片坐标 > 时间段 > 年份 > 推断 > 常驻
    const byDate = new Map(days.map((day) => [day.date, placeOf(day, settings)]))
    await ensureWeather(
      days.map((d) => ({ date: d.date, lat: d.lat, lon: d.lon })),
      (day) => {
        const place = byDate.get(day.date)
        return place ? { lat: place.lat, lon: place.lon } : null
      },
    )
    await load()
    setSyncing(false)
  }

  const years = useMemo(() => {
    const set = new Set<number>()
    rows.forEach((row) => set.add(row.day.year))
    return Array.from(set).sort((a, b) => b - a)
  }, [rows])

  const visible = useMemo(() => {
    const list = rows.filter((row) => {
      if (year !== 'all' && row.day.year !== year) return false
      if (onlyFav && row.day.favorite !== 1) return false
      if (view === 'score' && row.result && row.result.score < threshold) return false
      return true
    })
    if (view === 'time') {
      return list.slice().sort((a, b) => (a.day.date < b.day.date ? 1 : -1))
    }
    return list
  }, [rows, year, threshold, onlyFav, view])

  // 注意：所有 hook 必须在这之前调用（下面有两个提前 return）
  const groups = useMemo(() => {
    const map = new Map<number, Row[]>()
    for (const row of visible) {
      const list = map.get(row.day.year)
      if (list) list.push(row)
      else map.set(row.day.year, [row])
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([groupYear, list]) => ({ year: groupYear, list }))
  }, [visible])

  const missing = rows.filter((row) => !row.weather).length

  useEffect(() => {
    if (loading || syncing) return
    if (missing === 0) return
    if (autoSynced.current) return
    autoSynced.current = true
    void syncWeather()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, missing])

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="page">
        <header className="topbar">
          <div>
            <div className="place">回忆</div>
            <div className="date">那天你穿了什么</div>
          </div>
        </header>
        <section className="card">
          <h2>还没有照片</h2>
          <p className="muted">
            导入相册后，这里会把 {settings.historyStartYear} 年以来「天气和今天差不多」的日子排给你看。
          </p>
          <Link className="btn" to="/import">导入相册 →</Link>
        </section>
        <section className="card">
          <h2>怎么算「像」</h2>
          <p className="muted small">体感 35% · 温差 15% · 降水 20% · 风 12% · 湿度 10% · 紫外线 8%</p>
        </section>
      </div>
    )
  }

  const favCount = rows.filter((row) => row.day.favorite === 1).length

  function renderRow({ day, weather, result }: Row) {
    return (
      <Link className="list-row" key={day.date} to={'/day/' + day.date}>
        <Thumb id={day.heroPhotoId} />
        <div className="list-body">
          <div className="list-title">
            <span>
              {day.date}
              {day.favorite === 1 ? <span className="fav-mark">♥</span> : null}
            </span>
            <span className="muted small">{day.photoCount} 张</span>
          </div>
          <div className="muted small">
            {weather
              ? icon(weather.weatherCode) + ' ' + describe(weather.weatherCode) + ' · ' + Math.round(weather.tMin) + '~' + Math.round(weather.tMax) + '° · 风 ' + windLevel(weather.windMax) + ' 级'
              : '天气待补齐'}
          </div>
        </div>
        {view === 'score' ? (
          result ? (
            <span className={result.score >= 80 ? 'score score-high' : 'score'}>{result.score}</span>
          ) : (
            <span className="score score-empty">—</span>
          )
        ) : null}
      </Link>
    )
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="place">回忆</div>
          <div className="date">
            {rows.length} 个穿搭日 · {favCount} 个收藏
          </div>
        </div>
        <Link className="icon-btn" to="/import" aria-label="导入">＋</Link>
      </header>

      <div className="filters">
        <div className="view-switch">
          <button className={view === 'score' ? 'view-btn view-btn-active' : 'view-btn'} onClick={() => setView('score')}>
            按相似度
          </button>
          <button className={view === 'time' ? 'view-btn view-btn-active' : 'view-btn'} onClick={() => setView('time')}>
            时间轴
          </button>
        </div>
        <select
          className="input input-compact"
          value={String(year)}
          onChange={(event) => setYear(event.target.value === 'all' ? 'all' : Number(event.target.value))}
        >
          <option value="all">全部年份</option>
          {years.map((item) => (
            <option key={item} value={item}>{item} 年</option>
          ))}
        </select>
      </div>

      <div className="filters">
        {view === 'score' ? (
          <select className="input input-compact" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))}>
            <option value={0}>全部相似度</option>
            <option value={60}>≥ 60</option>
            <option value={70}>≥ 70</option>
            <option value={80}>≥ 80</option>
            <option value={90}>≥ 90</option>
          </select>
        ) : (
          <div className="spacer" />
        )}
        <button
          className={onlyFav ? 'chip chip-active' : 'chip'}
          onClick={() => setOnlyFav((prev) => !prev)}
        >
          {onlyFav ? '♥ 只看收藏' : '♡ 只看收藏'}
        </button>
      </div>

      {missing > 0 ? (
        <div className="banner banner-soft">
          <span>{missing} 天还没对上天气</span>
          <button className="link-btn" onClick={() => void syncWeather()} disabled={syncing}>
            {syncing ? '补齐中…' : '补齐'}
          </button>
        </div>
      ) : null}

      {view === 'score' ? (
        <div className="list">{visible.map(renderRow)}</div>
      ) : (
        groups.map((group) => (
          <div key={group.year}>
            <div className="year-head">{group.year} 年</div>
            <div className="list">{group.list.map(renderRow)}</div>
          </div>
        ))
      )}

      {!visible.length ? (
        <p className="muted small center">
          {onlyFav ? '还没有收藏。点进某一天，按右上角的 ♡ 收藏。' : '这个筛选下没有结果，放宽一点试试。'}
        </p>
      ) : null}

      <p className="muted small center">
        {visible.length === rows.length ? '共 ' + rows.length + ' 天' : '显示 ' + visible.length + ' / ' + rows.length + ' 天'}
      </p>

      <footer className="foot">只比对本机照片，不上传</footer>
    </div>
  )
}
