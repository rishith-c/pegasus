import React, { useRef, useState } from 'react'

export default function ResponseCapture({ onSubmit, disabled }) {
  const [text, setText] = useState('')
  const startTimeRef = useRef(null)
  const keystrokesRef = useRef(0)
  const backspacesRef = useRef(0)

  const handleKeyDown = (e) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now()
    }
    if (e.key === 'Backspace') {
      backspacesRef.current += 1
    }
    keystrokesRef.current += 1
  }

  const handleSubmit = () => {
    if (disabled || !text.trim()) return

    const now = Date.now()
    const responseTimeMs = startTimeRef.current ? now - startTimeRef.current : 0
    const elapsedMinutes = responseTimeMs / 1000 / 60
    const wordCount = text.trim().split(/\s+/).length
    const typingWpm = elapsedMinutes > 0 ? Math.round(wordCount / elapsedMinutes) : 0
    const errorRate = keystrokesRef.current > 0
      ? Math.round((backspacesRef.current / keystrokesRef.current) * 100)
      : 0

    onSubmit({
      response_text: text,
      response_time_ms: responseTimeMs,
      typing_wpm: typingWpm,
      error_rate: errorRate,
    })

    setText('')
    startTimeRef.current = null
    keystrokesRef.current = 0
    backspacesRef.current = 0
  }

  return (
    <div className="response-capture">
      <textarea
        className="response-textarea"
        placeholder="How does this make you feel? Type whatever comes to mind..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={5}
      />
      <button
        className="response-submit"
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
      >
        Submit Response
      </button>
    </div>
  )
}
