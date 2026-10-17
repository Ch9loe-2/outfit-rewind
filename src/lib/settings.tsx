import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Place, Settings } from './types'

const KEY = 'outfit-rewind:settings:v1'

export const DEFAULT_SETTINGS: Settings = {
  mode: 'auto',
  place: { name: '杭州', lat: 30.2741, lon: 120.1551 },
  unit: 'c',
  sensitivity: 0,
  historyStartYear: 2015,
  matchThreshold: 50,
  yearPlaces: {},
  periods: [],
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      yearPlaces: parsed.yearPlaces ?? {},
      periods: parsed.periods ?? [],
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

interface Ctx {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  setYearPlace: (year: number, place: Place | null) => void
  addPeriod: (from: string, to: string, place: Place) => void
  removePeriod: (id: string) => void
  reset: () => void
}

const SettingsContext = createContext<Ctx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings))
  }, [settings])

  const value = useMemo<Ctx>(
    () => ({
      settings,
      update: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
      setYearPlace: (year, place) =>
        setSettings((prev) => {
          const next = { ...prev.yearPlaces }
          if (place) next[String(year)] = place
          else delete next[String(year)]
          return { ...prev, yearPlaces: next }
        }),
      addPeriod: (from, to, place) =>
        setSettings((prev) => ({
          ...prev,
          periods: [
            ...(prev.periods ?? []),
            { id: from + '-' + to + '-' + Date.now().toString(36), from, to, place, createdAt: Date.now() },
          ].sort((a, b) => (a.from < b.from ? -1 : 1)),
        })),
      removePeriod: (id) =>
        setSettings((prev) => ({ ...prev, periods: (prev.periods ?? []).filter((p) => p.id !== id) })),
      reset: () => setSettings(DEFAULT_SETTINGS),
    }),
    [settings],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings 必须在 SettingsProvider 内使用')
  return ctx
}
