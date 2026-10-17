import type { OutfitAdvice } from '../lib/outfit'

export default function OutfitCard({ advice }: { advice: OutfitAdvice }) {
  const layers = [
    { label: '内搭', value: advice.layers.base },
    { label: '中层', value: advice.layers.mid },
    { label: '外套', value: advice.layers.outer },
  ].filter((layer) => layer.value)

  return (
    <section className="card">
      <header className="card-head">
        <h2>今天这样穿</h2>
        <span className="pill">{advice.bandLabel}</span>
      </header>

      <div className="layers">
        {layers.map((layer) => (
          <div className="layer" key={layer.label}>
            <span className="layer-label">{layer.label}</span>
            <span className="layer-value">{layer.value}</span>
          </div>
        ))}
      </div>

      {advice.accessories.length ? (
        <div className="accessories">
          {advice.accessories.map((item) => (
            <span className="tag" key={item}>
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <p className="reason">{advice.reason}</p>
    </section>
  )
}
