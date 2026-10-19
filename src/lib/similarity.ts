export interface WeatherInput {
  tMax: number
  tMin: number
  feelsMax: number
  feelsMin: number
  precipSum: number
  windMax: number
  humidityMean: number | null
  uvMax: number | null
}

export interface Feature {
  feelsMean: number
  tempRange: number
  precip: number
  windMax: number
  humidity: number | null
  uv: number | null
}

const SCALE: Record<string, number> = {
  feelsMean: 8,
  tempRange: 6,
  precip: 5,
  windMax: 20,
  humidity: 25,
  uv: 6,
}

/**
 * 体感坐到 0.50：风、湿度本来就已算进 apparent_temperature，
 * 单列只是补充，不该和体感平起平坐。
 */
const WEIGHT: Record<string, number> = {
  feelsMean: 0.5,
  tempRange: 0.15,
  precip: 0.2,
  windMax: 0.08,
  humidity: 0.05,
  uv: 0.02,
}

export const DIM_LABEL: Record<string, string> = {
  feelsMean: '体感',
  tempRange: '温差',
  precip: '降水',
  windMax: '风',
  humidity: '湿度',
  uv: '紫外线',
}

export function todayInput(d: {
  tempMax: number
  tempMin: number
  feelsMax: number
  feelsMin: number
  precipSum: number
  windMax: number
  humidityMean: number | null
  uvMax: number | null
}): WeatherInput {
  return {
    tMax: d.tempMax,
    tMin: d.tempMin,
    feelsMax: d.feelsMax,
    feelsMin: d.feelsMin,
    precipSum: d.precipSum,
    windMax: d.windMax,
    humidityMean: d.humidityMean,
    uvMax: d.uvMax,
  }
}

export function toFeature(w: WeatherInput): Feature {
  return {
    feelsMean: (w.feelsMax + w.feelsMin) / 2,
    tempRange: w.tMax - w.tMin,
    precip: Math.log1p(Math.max(0, w.precipSum)),
    windMax: w.windMax,
    humidity: w.humidityMean,
    uv: w.uvMax,
  }
}

export interface MatchResult {
  score: number
  parts: Array<{ key: string; label: string; weight: number; delta: number }>
  confidence: number
}

/** 投票时把六维差值一起存下来，之后不用回看天气也能拟合权重 */
export function deltasOf(result: MatchResult): Record<string, number> {
  const out: Record<string, number> = {}
  for (const part of result.parts) {
    out[part.key] = Math.round(part.delta * 1000) / 1000
  }
  return out
}

export function match(today: Feature, other: Feature): MatchResult {
  let weighted = 0
  let total = 0
  let used = 0
  const parts: Array<{ key: string; label: string; weight: number; delta: number }> = []

  for (const key of Object.keys(WEIGHT)) {
    const a = (today as unknown as Record<string, number | null>)[key]
    const b = (other as unknown as Record<string, number | null>)[key]
    if (a === null || b === null || a === undefined || b === undefined) continue
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    const w = WEIGHT[key]
    const delta = Math.abs(a - b) / SCALE[key]
    weighted += w * delta
    total += w
    used += 1
    parts.push({ key, label: DIM_LABEL[key], weight: w, delta })
  }

  if (!total) return { score: 0, parts: [], confidence: 0 }

  const distance = weighted / total
  // 0.8 的衰减：体感差 2°C ≈ 90 分，差 5°C ≈ 76，差 10°C ≈ 58，差 16°C ≈ 42
  const score = Math.round(100 * Math.exp(-distance / 0.8))
  const partsSorted = parts
    .map((p) => ({ ...p, weight: p.weight / total }))
    .sort((x, y) => y.weight - x.weight)

  return { score, parts: partsSorted, confidence: Math.min(1, used / 6) }
}
