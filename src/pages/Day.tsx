import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../lib/db'
import type { DayRow, PhotoRow, WeatherRow } from '../lib/db'
import type { DailyWeather } from '../lib/types'
import { humanDate, weekdayOf } from '../lib/dates'
import { readLastWeather } from '../lib/lastWeather'
import { locKeyOf } from '../lib/archive'
import { match, toFeature, todayInput } from '../lib/similarity'
import { useSettings } from '../lib/settings'
import { resolvePlace } from '../lib/places'
import { useThumb } from '../lib/useThumb'
import { describe, icon, windLevel } from '../lib/weather'
import { deleteDay, moveDay } from '../lib/edit'

function PhotoThumb({ id, active, onSelect }: { id: string; active: boolean; onSelect: (id: string) => void }) {
  const url = useThumb(id)
  return (
    <button className={active ? 'shot shot-active' : 'shot'} onClick={() => onSelect(id)}>
      {url ? <img src={url} alt="" /> : <span className="shot-empty" />}
    </button>
  )
}

export default function Day() {
  const { date } = useParams()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [day, setDay] = useState<DayRow | null>(null)
  const [photos, setPhotos] = useState<PhotoRow[]>([])
  const [weather, setWeather] = useState<WeatherRow | null>(null)
  const [hero, setHero] = useState<string | undefined>(undefined)
  const [today, setToday] = useState<DailyWeather | null>(null)
  const [loading, setLoading] = useState(true)
  const [fav, setFav] = useState(false)
  const [moveTo, setMoveTo] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      if (!date) return
      setLoading(true)
      const row = await db.days.get(date)
      if (!alive) return
      if (!row) {
        setLoading(false)
        return
      }
      setDay(row)
      setFav(row.favorite === 1)
      setHero(row.heroPhotoId)
      const list = await db.photos.bulkGet(row.photoIds)
      if (!alive) return
      setPhotos((list.filter(Boolean) as PhotoRow[]).sort((a, b) => a.takenAt - b.takenAt))

      const place = resolvePlace(row, settings)
      if (place) {
        const key = locKeyOf(place.lat, place.lon) + ':' + row.date
        const w = await db.weather.get(key)
        if (alive) setWeather(w ?? null)
      } else {
        const anyWeather = await db.weather.where('date').equals(row.date).first().catch(() => undefined)
        if (alive) setWeather((anyWeather as WeatherRow | undefined) ?? null)
      }
      setToday(readLastWeather())
      setLoading(false)
    }
    void load()
    return () => {
      alive = false
    }
  }, [date, settings])

  const heroUrl = useThumb(hero)

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-card" />
      </div>
    )
  }

  if (!day) {
    return (
      <div className="page">
        <div className="card">
          <h2>没有这一天</h2>
          <p className="muted">可能已经被清除了，回回忆页看看。</p>
          <Link className="btn btn-ghost" to="/rewind">返回回忆</Link>
        </div>
      </div>
    )
  }

  const result = weather && today ? match(toFeature(todayInput(today)), toFeature(weather)) : null

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="place">{humanDate(day.date)}</div>
          <div className="date">{weekdayOf(day.date)} · {day.photoCount} 张照片</div>
        </div>
        <div className="topbar-actions">
          <button
            className={fav ? 'icon-btn icon-btn-fav' : 'icon-btn'}
            aria-label={fav ? '取消收藏' : '收藏这天'}
            onClick={async () => {
              const next = fav ? 0 : 1
              setFav(!fav)
              await db.days.update(day.date, { favorite: next as 0 | 1 })
            }}
          >
            {fav ? '♥' : '♡'}
          </button>
          <Link className="icon-btn" to="/rewind" aria-label="返回">←</Link>
        </div>
      </header>

      <div className="hero-photo">
        {heroUrl ? <img src={heroUrl} alt="" /> : <div className="hero-photo-empty">没有缩略图</div>}
      </div>

      {photos.length > 1 ? (
        <div className="shots">
          {photos.map((photo) => (
            <PhotoThumb key={photo.id} id={photo.id} active={photo.id === hero} onSelect={setHero} />
          ))}
        </div>
      ) : null}

      {weather ? (
        <section className="card">
          <header className="card-head">
            <h2>那天的天气</h2>
            {result ? <span className="pill">{result.score} 分</span> : null}
          </header>
          <div className="compare">
            <div className="compare-row compare-head">
              <span />
              <span>那天</span>
              <span>今天</span>
            </div>
            <CompareRow label="天气" a={describe(weather.weatherCode)} b={today ? describe(today.weatherCode) : '—'} icon={icon(weather.weatherCode)} />
            <CompareRow label="体感" a={Math.round((weather.feelsMax + weather.feelsMin) / 2) + '°'} b={today ? Math.round((today.feelsMax + today.feelsMin) / 2) + '°' : '—'} />
            <CompareRow label="温度" a={Math.round(weather.tMin) + '~' + Math.round(weather.tMax) + '°'} b={today ? Math.round(today.tempMin) + '~' + Math.round(today.tempMax) + '°' : '—'} />
            <CompareRow label="降水" a={weather.precipSum.toFixed(1) + ' mm'} b={today ? today.precipSum.toFixed(1) + ' mm' : '—'} />
            <CompareRow label="风" a={windLevel(weather.windMax) + ' 级'} b={today ? windLevel(today.windMax) + ' 级' : '—'} />
            <CompareRow label="湿度" a={weather.humidityMean === null ? '—' : weather.humidityMean + '%'} b={today && today.humidityMean !== null ? today.humidityMean + '%' : '—'} />
          </div>
        </section>
      ) : (
        <section className="card">
          <h2>还没拿到那天的天气</h2>
          <p className="muted">这个年份的天气可能还没同步，回回忆页刷新一下。</p>
        </section>
      )}

      <section className="card">
        <header className="card-head">
          <h2>修补</h2>
          <button className="link-btn" onClick={() => setEditing((prev) => !prev)}>
            {editing ? '收起' : '展开'}
          </button>
        </header>
        {editing ? (
          <>
            <p className="muted small">日期错了？把这一天的照片挪到正确的那天。搬过去会合并到目标日期。</p>
            <div className="two-col">
              <input
                className="input"
                type="date"
                value={moveTo || day.date}
                onChange={(event) => setMoveTo(event.target.value)}
              />
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  const target = moveTo || day.date
                  if (target === day.date) return
                  if (!confirm('把 ' + day.date + ' 的 ' + day.photoCount + ' 张照片挪到 ' + target + '？目标那天已有照片会合并。')) return
                  await moveDay(day.date, target)
                  navigate('/day/' + target)
                }}
              >
                改日期
              </button>
            </div>
            <div className="actions">
              <button
                className="btn btn-ghost danger"
                onClick={async () => {
                  if (!confirm('删除 ' + day.date + ' 这一天的 ' + day.photoCount + ' 张照片索引和缩略图？不可撤销。')) return
                  await deleteDay(day.date)
                  navigate('/rewind')
                }}
              >
                删除这一天
              </button>
            </div>
          </>
        ) : (
          <p className="muted small">支持改日期、删掉误导入的一天。</p>
        )}
      </section>

      {result ? (
        <section className="card">
          <h2>为什么是这天</h2>
          <div className="parts">
            {result.parts.map((part) => (
              <div className="part" key={part.key}>
                <span className="part-label">{part.label}</span>
                <div className="part-bar">
                  <div className="part-fill" style={{ width: Math.round(part.weight * 100 * 2.6) + '%' }} />
                </div>
                <span className="part-value">{Math.round(part.weight * 100)}%</span>
              </div>
            ))}
          </div>
          <p className="muted small">
            相似度 = 100 × exp(-加权距离 / 0.8)，缺失维度自动剔除并重新分配权重。
          </p>
        </section>
      ) : null}
    </div>
  )
}

function CompareRow({ label, a, b, icon }: { label: string; a: string; b: string; icon?: string }) {
  return (
    <div className="compare-row">
      <span className="compare-label">{icon ? icon + ' ' : ''}{label}</span>
      <span className="compare-a">{a}</span>
      <span className="compare-b">{b}</span>
    </div>
  )
}
