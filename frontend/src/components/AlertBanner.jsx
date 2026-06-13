import React from 'react'

export default function AlertBanner({ visible, intervention, onClose }) {
  if (!visible) return null

  return (
    <div className="alert-banner">
      <div className="alert-banner-content">
        <div className="alert-banner-icon">⚠</div>
        <h2>Check Engine Light: RED</h2>
        <p>
          {intervention ||
            'Your signals indicate significant burnout risk. Please take a moment for yourself.'}
        </p>
        <button className="alert-banner-close" onClick={onClose}>
          I see this
        </button>
      </div>
    </div>
  )
}
