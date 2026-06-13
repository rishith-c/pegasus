import React from 'react'

export default function StimulusPlayer({ stimulus }) {
  if (!stimulus) {
    return <div className="stimulus-player stimulus-empty">Loading today's stimulus...</div>
  }

  const { type, url, category } = stimulus

  return (
    <div className="stimulus-player">
      {category && (
        <div className={`stimulus-badge stimulus-${category}`}>{category}</div>
      )}
      {type === 'image' && <img className="stimulus-media" src={url} alt="Daily stimulus" />}
      {type === 'audio' && <audio className="stimulus-media" controls src={url} />}
      {type === 'video' && <video className="stimulus-media" controls src={url} />}
      {type === 'text' && <p className="stimulus-text">{url}</p>}
    </div>
  )
}
