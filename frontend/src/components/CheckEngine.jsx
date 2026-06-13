import React from 'react'

const LEVEL_CONFIG = {
  green: {
    color: '#22c55e',
    glow: 'rgba(34, 197, 94, 0.6)',
    label: 'STABLE',
    pulseClass: 'pulse-green',
  },
  yellow: {
    color: '#eab308',
    glow: 'rgba(234, 179, 8, 0.65)',
    label: 'STRAINED',
    pulseClass: 'pulse-yellow',
  },
  red: {
    color: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.75)',
    label: 'CRITICAL',
    pulseClass: 'pulse-red',
  },
}

export default function CheckEngine({ score = 0, level = 'green' }) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.green

  return (
    <div className="check-engine">
      <div
        className={`check-engine-light ${config.pulseClass}`}
        style={{
          '--glow-color': config.glow,
          '--core-color': config.color,
        }}
      >
        <div className="check-engine-score">{Math.round(score)}</div>
      </div>
      <div className="check-engine-label" style={{ color: config.color }}>
        {config.label}
      </div>
    </div>
  )
}
