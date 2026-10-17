import { Link } from 'react-router-dom'
import { useSettings } from '../lib/settings'

export default function Rewind() {
  const { settings } = useSettings()

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="place">回忆</div>
          <div className="date">那天你穿了什么</div>
        </div>
      </header>

      <section className="card">
        <h2>这一步还在路上</h2>
        <p className="muted">
          照片导入和相似度匹配在下一个版本里。现在这里先放一张"会长什么样"的草图。
        </p>
        <div className="mock-list">
          <div className="mock-item">
            <div className="mock-thumb" />
            <div className="mock-body">
              <div className="mock-line w60" />
              <div className="mock-line w40" />
            </div>
            <div className="mock-score">92</div>
          </div>
          <div className="mock-item">
            <div className="mock-thumb" />
            <div className="mock-body">
              <div className="mock-line w50" />
              <div className="mock-line w30" />
            </div>
            <div className="mock-score">88</div>
          </div>
          <div className="mock-item">
            <div className="mock-thumb" />
            <div className="mock-body">
              <div className="mock-line w70" />
              <div className="mock-line w40" />
            </div>
            <div className="mock-score">85</div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>怎么算"像"</h2>
        <p className="muted">
          体感温度 {Math.round(35)}% · 日温差 15% · 降水 20% · 风 12% · 湿度 10% · 紫外线 8%
        </p>
        <p className="muted small">
          起点年份：{settings.historyStartYear} · 相似度阈值：{settings.matchThreshold}
        </p>
      </section>

      <Link className="btn btn-ghost" to="/">
        回到今天
      </Link>
    </div>
  )
}
