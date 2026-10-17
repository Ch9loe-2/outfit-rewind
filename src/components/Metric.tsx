interface Props {
  label: string
  value: string
  hint?: string
}

export default function Metric({ label, value, hint }: Props) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </div>
  )
}
