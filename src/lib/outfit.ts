import type { DailyWeather, Sensitivity } from './types'
import { windLevel } from './weather'

export interface LayerSet {
  base: string
  mid: string
  outer: string
}

export interface OutfitAdvice {
  layers: LayerSet
  accessories: string[]
  reason: string
  bandLabel: string
}

interface Band {
  min: number
  label: string
  base: string
  mid: string
  outer: string
  tip: string
}

const BANDS: Band[] = [
  { min: 30, label: '酷热', base: '无袖或速干短袖', mid: '', outer: '', tip: '避开正午，多补水' },
  { min: 25, label: '炎热', base: '短袖', mid: '', outer: '', tip: '选轻薄透气的料子' },
  { min: 20, label: '温暖', base: '短袖或薄长袖', mid: '薄衬衫', outer: '', tip: '室内空调房可加一层' },
  { min: 15, label: '温和', base: '长袖 T 恤', mid: '卫衣或薄针织', outer: '薄风衣', tip: '早晚可加一层' },
  { min: 10, label: '微凉', base: '长袖 T 恤', mid: '针织衫或卫衣', outer: '夹克', tip: '' },
  { min: 5, label: '偏冷', base: '保暖内衣', mid: '毛衣', outer: '厚外套或大衣', tip: '围巾更稳妥' },
  { min: 0, label: '寒冷', base: '保暖内衣', mid: '毛衣', outer: '羽绒服或棉服', tip: '手套别忘' },
  { min: -5, label: '严寒', base: '加厚保暖内衣', mid: '羊毛衫', outer: '长羽绒', tip: '帽子手套齐全' },
  { min: -Infinity, label: '极寒', base: '加厚保暖内衣', mid: '抓绒', outer: '长羽绒', tip: '尽量减少皮肤暴露' },
]

function pickBand(feels: number): Band {
  for (const band of BANDS) {
    if (feels >= band.min) return band
  }
  return BANDS[BANDS.length - 1]
}

function upgradeOuter(outer: string): string {
  const ladder = ['', '薄风衣', '夹克', '厚外套或大衣', '羽绒服或棉服', '长羽绒']
  if (!outer) return '防风外套'
  const idx = ladder.indexOf(outer)
  if (idx === -1) return outer + '（加防风）'
  return ladder[Math.min(idx + 1, ladder.length - 1)]
}

export function advise(weather: DailyWeather, sensitivity: Sensitivity): OutfitAdvice {
  const feelsMean = (weather.feelsMax + weather.feelsMin) / 2
  const adjusted = feelsMean + sensitivity * 2
  const band = pickBand(adjusted)

  const layers: LayerSet = {
    base: band.base,
    mid: band.mid,
    outer: band.outer,
  }
  const accessories: string[] = []
  const notes: string[] = []

  if (weather.precipProb >= 50 || weather.precipSum >= 1) {
    accessories.push('带伞')
    layers.outer = layers.outer ? layers.outer + '（防泼水）' : '防泼水外套'
    notes.push('有降水')
  }

  const level = windLevel(weather.windMax)
  if (level >= 4) {
    layers.outer = upgradeOuter(layers.outer)
    notes.push('风有点大，外套加一档')
  }

  if (weather.uvMax >= 6) {
    accessories.push('防晒霜')
    accessories.push('墨镜')
    notes.push('紫外线强')
  }

  const humidity = weather.humidityMean
  if (humidity !== null && humidity >= 85 && adjusted >= 25) {
    notes.push('湿度高，选透气面料')
  }

  const swing = weather.feelsMax - weather.feelsMin
  if (swing >= 10) {
    notes.push('温差 ' + Math.round(swing) + '°C，靠叠穿')
  }

  const duplicated = notes.some((note) => note.indexOf('防晒') >= 0)
  if (band.tip && !(duplicated && band.tip.indexOf('防晒') >= 0)) {
    notes.push(band.tip)
  }

  const range = Math.round(weather.tempMin) + '→' + Math.round(weather.tempMax) + '°C'
  const windText = '风 ' + level + ' 级'
  const head = range + '，' + windText
  const reason = notes.length ? head + '。' + notes.join('；') + '。' : head + '。'

  return { layers, accessories, reason, bandLabel: band.label }
}
