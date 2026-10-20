import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Metric from '../components/Metric'
import OutfitCard from '../components/OutfitCard'
import { advise } from '../lib/outfit'
import { currentPosition } from '../lib/location'
import { readBundle, saveBundle, saveLastWeather } from '../lib/lastWeather'
import { db } from '../lib/db'
import { buildMatches } from '../lib/matches'
import type { MatchRow } from '../lib/matches'
import { useSettings } from '../lib/settings'
import { useThumb } from '../lib/useThumb'
import type { WeatherBundle } from '../lib/types'
import { clock, describe, fetchWeather, icon, windLevel } from '../lib/weather'

function TopCard({ row }: { row: MatchRow }) {
  const url = useThumb(row.day.heroPhotoId)
  return (
    <Link className="top-card" to={'/day/' + row.day.date}>
      <div className="top-thumb">{url ? <img src={url} alt="" /> : <span className="shot-empty" />}</div>
      <div className="top-meta">
        <span className="top-date">{row.day.date.slice(2)}</span>
        <span className="top-score">{row.result ? row.result.score : '—'}</span>
      </div>
    </Link>
  )
}

function todayLabel(): string {
  const now = new Date()
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
  return String(now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日 · ' + week
}

export default function Today() {
  const { settings, update } = useSettings()
  const [weather, setWeather] = useState<WeatherBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [placeName, setPlaceName] = useState(settings.place ? settings.place.name : '当前位置')
  const [notice, setNotice] = useState<string | null>(null)
  const [days, setDays] = useState(0)
  const [top, setTop] = useState<MatchRow[]>([])
  const [showWechatTip, setShowWechatTip] = useState(false)
  const [geoPermission, setGeoPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')

  useEffect(() => {
    db.days.count().then(setDays).catch(() => setDays(0))
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          setGeoPermission(status.state as 'granted' | 'denied' | 'prompt')
          status.onchange = () => setGeoPermission(status.state as 'granted' | 'denied' | 'prompt')
        })
        .catch(() => setGeoPermission('unknown'))
    }
    const inWechat = /MicroMessenger/i.test(navigator.userAgent)
    const dismissed = localStorage.getItem('outfit-rewind:wechat-tip') === '1'
    setShowWechatTip(inWechat && !dismissed)
  }, [])

  useEffect(() => {
    if (!weather) return
    let alive = true
    buildMatches(settings, weather.daily)
      .then((rows) => {
        if (!alive) return
        const ranked = rows
          .filter((row) => row.result)
          .sort((a, b) => (b.result?.score ?? 0) - (a.result?.score ?? 0))
          .slice(0, 3)
        setTop(ranked)
      })
      .catch(() => {
        if (alive) setTop([])
      })
    return () => {
      alive = false
    }
  }, [weather, settings])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotice(null)

    let lat: number
    let lon: number

    if (settings.mode === 'auto') {
      try {
        const coords = await currentPosition()
        lat = coords.lat
        lon = coords.lon
        setPlaceName('当前位置')
      } catch (err) {
        const message = err instanceof Error ? err.message : '定位失败'
        if (!settings.place) {
          setError(message + '，请到设置里手动选择城市')
          setLoading(false)
          return
        }
        lat = settings.place.lat
        lon = settings.place.lon
        setPlaceName(settings.place.name)
        setNotice(message)
      }
    } else {
      const place = settings.place
      if (!place) {
        setError('还没有选城市，请到设置里挑一个')
        setLoading(false)
        return
      }
      lat = place.lat
      lon = place.lon
      setPlaceName(place.name)
    }

    try {
      const data = await fetchWeather(lat, lon)
      setWeather(data)
      saveLastWeather(data.daily)
      saveBundle(data)
    } catch (err) {
      // 断网时退回上次成功拿到的天气，并明确标注是缓存
      const cached = readBundle()
      if (cached) {
        setWeather(cached.bundle)
        const time = new Date(cached.savedAt)
        const stamp = time.getMonth() + 1 + '/' + time.getDate() + ' ' + String(time.getHours()).padStart(2, '0') + ':' + String(time.getMinutes()).padStart(2, '0')
        setNotice('离线，显示 ' + stamp + ' 的缓存')
      } else {
        const message = err instanceof Error ? err.message : '天气加载失败'
        setError(message === 'Failed to fetch' ? '网络不可用，且还没有缓存过天气' : message)
      }
    } finally {
      setLoading(false)
    }
  }, [settings.mode, settings.place])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !weather) {
    return (
      <div className="page">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-temp" />
        <div className="skeleton skeleton-card" />
      </div>
    )
  }

  if (error && !weather) {
    return (
      <div className="page">
        <div className="card error-card">
          <h2>没能拿到天气</h2>
          <p>{error}</p>
          <button className="btn" onClick={() => void load()}>
            重试
          </button>
        </div>
      </div>
    )
  }

  if (!weather) return null

  const { current, daily } = weather
  const advice = advise(daily, settings.sensitivity)
  const feels = Math.round(current.apparent)

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="place">{placeName}</div>
          <div className="date">{todayLabel()}</div>
        </div>
        <button className="icon-btn" onClick={() => void load()} aria-label="刷新">
          ↻
        </button>
      </header>

      {notice ? (
        <div className="banner">
          <span>{notice.startsWith('离线') ? notice : notice + '，当前显示「' + placeName + '」'}</span>
          {settings.mode === 'auto' ? (
            <button className="link-btn" onClick={() => void load()}>
              重试定位
            </button>
          ) : (
            <Link className="link-btn" to="/settings">手动选城市</Link>
          )}
        </div>
      ) : null}

      {settings.mode === 'fixed' && geoPermission === 'granted' ? (
        <div className="banner">
          <span>浏览器已授权定位，但当前用的是手动城市「{placeName}」</span>
          <button
            className="link-btn"
            onClick={() => {
              update({ mode: 'auto' })
            }}
          >
            用定位
          </button>
        </div>
      ) : null}

      {showWechatTip ? (
        <div className="banner">
          <span>微信内置浏览器会限制定位和本地存储，建议点右上角「…」→ 在浏览器打开。</span>
          <button
            className="link-btn"
            onClick={() => {
              localStorage.setItem('outfit-rewind:wechat-tip', '1')
              setShowWechatTip(false)
            }}
          >
            知道了
          </button>
        </div>
      ) : null}

      <section className="hero">
        <div className="hero-icon">{icon(current.weatherCode)}</div>
        <div className="hero-temp">{Math.round(current.temperature)}°</div>
        <div className="hero-desc">{describe(current.weatherCode)}</div>
        <div className="hero-feels">体感 {feels}°</div>
      </section>

      <section className="metrics">
        <Metric label="最高 / 最低" value={Math.round(daily.tempMax) + '° / ' + Math.round(daily.tempMin) + '°'} />
        <Metric label="降水概率" value={Math.round(daily.precipProb) + '%'} hint={daily.precipSum > 0 ? daily.precipSum.toFixed(1) + ' mm' : '暂无降水'} />
        <Metric label="风" value={windLevel(daily.windMax) + ' 级'} hint={Math.round(daily.windMax) + ' km/h'} />
        <Metric label="湿度" value={(daily.humidityMean ?? current.humidity) + '%'} />
        <Metric label="紫外线" value={Math.round(daily.uvMax) + ''} hint={daily.uvMax >= 6 ? '偏强' : '温和'} />
        <Metric label="日出 / 日落" value={clock(daily.sunrise) + ' / ' + clock(daily.sunset)} />
      </section>

      <OutfitCard advice={advice} />

      <section className="card">
        <header className="card-head">
          <h2>那年今天</h2>
          {days > 0 ? <span className="pill">{days} 天</span> : <span className="pill pill-soft">待导入</span>}
        </header>
        {top.length ? (
          <>
            <div className="top-matches">
              {top.map((row) => (
                <TopCard key={row.day.date} row={row} />
              ))}
            </div>
            <Link className="btn btn-ghost" to="/rewind">
              看全部 {days} 天 →
            </Link>
          </>
        ) : days > 0 ? (
          <>
            <p className="muted">
              已有 {days} 个穿搭日，但还没对上天气，回回忆页补齐一下就能看到最像的几天。
            </p>
            <Link className="btn" to="/rewind">
              打开回忆 →
            </Link>
          </>
        ) : (
          <>
            <p className="muted">
              导入相册后，这里会显示 {settings.historyStartYear} 年以来「天气和今天差不多」的那些日子里，你穿了什么。
            </p>
            <Link className="btn" to="/import">
              导入相册 →
            </Link>
          </>
        )}
      </section>

      <footer className="foot">
        天气数据来自 Open-Meteo（CC-BY-4.0）· 照片不会离开这台设备
      </footer>
    </div>
  )
}
