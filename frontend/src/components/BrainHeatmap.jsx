import React from 'react'

function activationColor(value) {
  // 0 -> blue (calm), 1 -> red (high activation)
  const hue = 240 - value * 240
  return `hsl(${hue}, 80%, 55%)`
}

export default function BrainHeatmap({ regions }) {
  if (!regions || Object.keys(regions).length === 0) {
    return <div className="brain-heatmap brain-empty">No brain activity data yet.</div>
  }

  const entries = Object.entries(regions).sort((a, b) => b[1] - a[1])

  return (
    <div className="brain-heatmap">
      <h3>Brain Activation</h3>
      <div className="brain-grid">
        {entries.map(([region, value]) => (
          <div key={region} className="brain-cell">
            <div
              className="brain-cell-fill"
              style={{ backgroundColor: activationColor(value), opacity: 0.4 + value * 0.6 }}
            >
              <span className="brain-cell-value">{Math.round(value * 100)}%</span>
            </div>
            <div className="brain-cell-label">{region}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
