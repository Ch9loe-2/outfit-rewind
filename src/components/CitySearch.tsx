import { useEffect, useMemo, useState } from 'react'
import type { CityEntry } from '../lib/cities'
import { searchCities } from '../lib/cities'
import { searchPlaces } from '../lib/weather'
import type { Place } from '../lib/types'

interface Props {
  onPick: (place: Place) => void
  placeholder?: string
}

interface Item {
  key: string
  name: string
  hint: string
  lat: number
  lon: number
}

function toItem(name: string, admin: string, country: string, lat: number, lon: number): Item {
  const hint = [admin, country].filter(Boolean).join(' · ')
  return { key: name + ':' + lat.toFixed(2) + ',' + lon.toFixed(2), name, hint, lat, lon }
}

export default function CitySearch({ onPick, placeholder }: Props) {
  const [query, setQuery] = useState('')
  const [local, setLocal] = useState<CityEntry[]>([])
  const [remote, setRemote] = useState<Item[]>([])
  const [state, setState] = useState<'idle' | 'searching' | 'error'>('idle')

  useEffect(() => {
    setLocal(searchCities(query))
  }, [query])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setRemote([])
      setState('idle')
      return
    }
    let alive = true
    setState('searching')
    const timer = setTimeout(() => {
      searchPlaces(q)
        .then((results) => {
          if (!alive) return
          setRemote(
            results.map((item) => toItem(item.name, item.admin1 ?? '', item.country ?? '', item.latitude, item.longitude)),
          )
          setState('idle')
        })
        .catch(() => {
          if (!alive) return
          setRemote([])
          setState('error')
        })
    }, 320)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query])

  const items = useMemo(() => {
    const seen = new Set<string>()
    const out: Item[] = []
    for (const city of local) {
      const item = toItem(city.name, city.admin, '', city.lat, city.lon)
      if (seen.has(item.key)) continue
      seen.add(item.key)
      out.push(item)
    }
    for (const item of remote) {
      if (seen.has(item.key)) continue
      seen.add(item.key)
      out.push(item)
    }
    return out.slice(0, 10)
  }, [local, remote])

  const trimmed = query.trim()
  const empty = trimmed.length >= 2 && items.length === 0 && state !== 'searching'

  return (
    <div className="city-search">
      <input
        className="input"
        placeholder={placeholder ?? '搜索城市'}
        value={query}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
      />
      {state === 'searching' ? <p className="muted small">搜索中…</p> : null}
      {items.length ? (
        <ul className="result-list">
          {items.map((item) => (
            <li key={item.key}>
              <button
                className="result"
                onClick={() => {
                  onPick({ name: item.name, lat: item.lat, lon: item.lon })
                  setQuery('')
                  setRemote([])
                }}
              >
                <span>{item.name}</span>
                <span className="muted small">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {empty ? (
        <p className="muted small">
          {state === 'error' ? '联网搜索不可用，只能匹配内置城市表。' : '没有找到，换个写法试试（比如只输前两个字）。'}
        </p>
      ) : null}
    </div>
  )
}
