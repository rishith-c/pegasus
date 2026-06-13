import React from 'react'

const LEVEL_COLORS = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
}

const WIDTH = 600
const HEIGHT = 200
const PADDING = 30

export default function HistoryGraph({ history }) {
  if (!history || history.length === 0) {
    return <div className="history-graph history-empty">No history yet.</div>
  }

  const innerHeight = HEIGHT - PADDING * 2
  const yFor = (score) => HEIGHT - PADDING - (score / 100) * innerHeight

  const points = history.map((entry, i) => {
    const x = PADDING + (i / Math.max(history.length - 1, 1)) * (WIDTH - PADDING * 2)
    return { x, y: yFor(entry.score), ...entry }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="history-graph">
      <h3>Burnout Score Over Time</h3>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="history-svg">
        <line x1={PADDING} x2={WIDTH - PADDING} y1={yFor(30)} y2={yFor(30)} stroke="#22c55e" strokeDasharray="4 4" opacity="0.4" />
        <line x1={PADDING} x2={WIDTH - PADDING} y1={yFor(65)} y2={yFor(65)} stroke="#ef4444" strokeDasharray="4 4" opacity="0.4" />
        <path d={pathD} fill="none" stroke="#94a3b8" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="5" fill={LEVEL_COLORS[p.level] || '#94a3b8'} />
        ))}
      </svg>
    </div>
  )
}
