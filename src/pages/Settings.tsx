import { useState } from 'react'
import { useSettings } from '../lib/settings'
import type { GeoResult } from '../lib/weather'
import { searchPlaces } from '../lib/weather'
import type { Sensitivity } from '../lib/types'

const YEARS = Array.from({ length: 12 }, (_, i) => 2015 + i)

export default function SettingsPage() {
  const { settings, update, reset } = useSettings()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [searching, setSearching] = useState(false)

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
    update({
      mode: 'fixed',
      place: {
        name: place.name,
        lat: place.latitude,
        lon: place.longitude,
        country: place.country,
        admin: place.admin1,
      },
    })
    setResults([])
    setQuery('')
  }

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

        <input
          className="input"
          placeholder="搜索城市，例如 杭州、成都"
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
                  <span className="muted small">
                    {[item.admin1, item.country].filter(Boolean).join(' · ')}
                  </span>
                </button>
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
        <p className="muted small">只比对这一年之后的照片，越近数据越准。</p>
        <select
          className="input"
          value={settings.historyStartYear}
          onChange={(event) => update({ historyStartYear: Number(event.target.value) })}
        >
          {YEARS.map((year) => (
            <option key={year} value={year}>
              {year} 年
            </option>
          ))}
        </select>
      </section>

      <section className="card">
        <h2>数据</h2>
        <ul className="plain-list">
          <li>
            <span>天气来源</span>
            <span className="muted">Open-Meteo</span>
          </li>
          <li>
            <span>照片</span>
            <span className="muted">仅在本机解析</span>
          </li>
          <li>
            <span>账号</span>
            <span className="muted">不需要</span>
          </li>
        </ul>
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (confirm('清空本机的偏好设置？')) reset()
          }}
        >
          恢复默认设置
        </button>
      </section>

      <footer className="foot">outfit-rewind · MIT · 数据 CC-BY-4.0</footer>
    </div>
  )
}
