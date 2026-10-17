import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { ensureWeather } from '../lib/archive'
import { importFiles } from '../lib/importer'
import type { ImportProgress, ImportResult } from '../lib/importer'
import { resolvePlace } from '../lib/places'
import { useSettings } from '../lib/settings'

type Phase = 'idle' | 'running' | 'done'

export default function ImportPage() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const folderRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [weatherNote, setWeatherNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(files: FileList | null, source: 'folder' | 'picker') {
    if (!files || !files.length) return
    setPhase('running')
    setError(null)
    setResult(null)
    setWeatherNote(null)

    try {
      const list = Array.from(files)
      const res = await importFiles(list, source, setProgress)
      setResult(res)
      setPhase('done')

      const days = await db.days.toArray()
      setWeatherNote('正在补齐历史天气…')
      const synced = await ensureWeather(
        days.map((d) => ({ date: d.date, lat: d.lat, lon: d.lon })),
        (day) => resolvePlace({ ...day, year: Number(day.date.slice(0, 4)), month: '', photoIds: [], heroPhotoId: '', photoCount: 0, createdAt: 0 }, settings),
      )
      setWeatherNote(
        synced.years > 0
          ? '已补齐 ' + synced.years + ' 个年份的天气（' + synced.fetched + ' 天）'
          : synced.failed > 0
            ? '有 ' + synced.failed + ' 个年份没取到天气，稍后可在回忆页重试'
            : '历史天气已是最新',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败')
      setPhase('idle')
    }
  }

  const percent = progress && progress.total ? Math.round((progress.scanned / progress.total) * 100) : 0

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="place">导入相册</div>
          <div className="date">照片只在这台设备上解析</div>
        </div>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          ←
        </button>
      </header>

      {phase === 'idle' ? (
        <>
          <section className="card">
            <h2>选一个来源</h2>
            <p className="muted">
              桌面浏览器可以一次选整个文件夹，上万张也没问题；手机上可以分批选，已导入的不会重复。
            </p>
            <div className="actions">
              <button className="btn" onClick={() => folderRef.current?.click()}>
                选择文件夹
              </button>
              <button className="btn btn-ghost" onClick={() => pickerRef.current?.click()}>
                选择照片
              </button>
            </div>
            <input
              ref={folderRef}
              type="file"
              className="hidden-input"
              // @ts-expect-error 非标准属性，但 Chrome/Edge/Safari 都支持
              webkitdirectory=""
              directory=""
              multiple
              onChange={(event) => void run(event.target.files, 'folder')}
            />
            <input
              ref={pickerRef}
              type="file"
              className="hidden-input"
              accept="image/*"
              multiple
              onChange={(event) => void run(event.target.files, 'picker')}
            />
          </section>

          <section className="card">
            <h2>会读到什么</h2>
            <ul className="plain-list">
              <li>
                <span>拍摄时间</span>
                <span className="muted">EXIF，缺失时用文件时间</span>
              </li>
              <li>
                <span>拍摄地点</span>
                <span className="muted">EXIF 里的 GPS</span>
              </li>
              <li>
                <span>缩略图</span>
                <span className="muted">200px，存在本机</span>
              </li>
              <li>
                <span>原图</span>
                <span className="muted">不保存、不上传</span>
              </li>
            </ul>
          </section>
        </>
      ) : null}

      {phase === 'running' && progress ? (
        <section className="card">
          <h2>正在扫描</h2>
          <div className="progress">
            <div className="progress-bar" style={{ width: percent + '%' }} />
          </div>
          <div className="stat-row">
            <span>{progress.scanned} / {progress.total}</span>
            <span>{progress.accepted} 张 · {progress.days} 天</span>
          </div>
          <p className="muted small">已跳过 {progress.skipped} 张（重复或无法读取）</p>
        </section>
      ) : null}

      {phase === 'done' && result ? (
        <>
          <section className="card">
            <h2>导入完成</h2>
            <ul className="plain-list">
              <li>
                <span>新增照片</span>
                <span>{result.imported} 张</span>
              </li>
              <li>
                <span>穿搭日</span>
                <span>{result.days} 天</span>
              </li>
              <li>
                <span>拍摄时间</span>
                <span>
                  EXIF {result.exifTime} · 文件时间 {result.mtime}
                </span>
              </li>
              <li>
                <span>带 GPS</span>
                <span>
                  {result.gps} 张（{result.imported ? Math.round((result.gps / result.imported) * 100) : 0}%）
                </span>
              </li>
              <li>
                <span>年份</span>
                <span>{result.years.length ? result.years.join(' / ') : '—'}</span>
              </li>
              <li>
                <span>跳过</span>
                <span>{result.skipped} 张</span>
              </li>
            </ul>
            {result.mtime > result.exifTime ? (
              <p className="muted small">
                大部分照片没有拍摄时间，只能退回文件时间——通常是被微信/相册转存过。这会让日期失真，建议用原始照片。
              </p>
            ) : null}
            {result.gps / Math.max(1, result.imported) < 0.5 ? (
              <p className="muted small">
                过半照片没有 GPS，会按默认城市取天气。搬过家就去「设置 → 给某一年指定城市」补一下。
              </p>
            ) : null}
            {weatherNote ? <p className="muted small">{weatherNote}</p> : null}
            <div className="actions">
              <Link className="btn" to="/rewind">
                去看回忆 →
              </Link>
              <button className="btn btn-ghost" onClick={() => {
                setPhase('idle')
                setProgress(null)
                setResult(null)
                setWeatherNote(null)
              }}>
                再导入一批
              </button>
            </div>
          </section>
        </>
      ) : null}

      {error ? <div className="banner banner-error">{error}</div> : null}

      <footer className="foot">照片不会离开这台设备 · 只有坐标和年份会发给 Open-Meteo</footer>
    </div>
  )
}
