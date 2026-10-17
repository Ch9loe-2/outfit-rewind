import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Metric from '../components/Metric'
import OutfitCard from '../components/OutfitCard'
import { advise } from '../lib/outfit'
import { currentPosition } from '../lib/location'
import { useSettings } from '../lib/settings'
import type { WeatherBundle } from '../lib/types'
import { clock, describe, fetchWeather, icon, windLevel } from '../lib/weather'

function todayLabel(): string {
  const now = new Date()
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
  return String(now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日 · ' + week
}

export default function Today() {
  const { settings } = useSettings()
  const [weather, setWeather] = useState<WeatherBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [placeName, setPlaceName] = useState(settings.place ? settings.place.name : '当前位置')
  const [notice, setNotice] = useState<string | null>(null)

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
        setNotice(message + '，先用「' + settings.place.name + '」的天气')
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '天气加载失败')
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

      {notice ? <div className="banner">{notice}</div> : null}

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
          <span className="pill pill-soft">即将上线</span>
        </header>
        <p className="muted">
          导入相册后，这里会显示 {settings.historyStartYear} 年以来「天气和今天差不多」的那些日子里，你穿了什么。
        </p>
        <Link className="btn btn-ghost" to="/rewind">
          看看计划中的样子 →
        </Link>
      </section>

      <footer className="foot">
        天气数据来自 Open-Meteo（CC-BY-4.0）· 照片不会离开这台设备
      </footer>
    </div>
  )
}
