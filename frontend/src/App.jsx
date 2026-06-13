import React, { useEffect, useState } from 'react'
import CheckEngine from './components/CheckEngine'
import StimulusPlayer from './components/StimulusPlayer'
import ResponseCapture from './components/ResponseCapture'
import BrainHeatmap from './components/BrainHeatmap'
import HistoryGraph from './components/HistoryGraph'
import AlertBanner from './components/AlertBanner'
import { sendResponse, getHistory, getBrain, sendStimulus } from './api'

const USER_ID = 'demo-user'

const MOCK_STIMULUS = {
  id: 'calm_01',
  type: 'text',
  url: 'Picture yourself by a quiet lake at sunrise. The water is still and the air is cool.',
  category: 'calm',
}

const MOCK_RESULT = {
  score: 28,
  level: 'green',
  tribe_deviation: 0.12,
  behavioral_deviation: 0.15,
  top_indicators: ['typing_speed_normal', 'sentiment_positive'],
  intervention: "You're doing well today. Keep up your routine.",
  brain_regions_flagged: [],
  confidence: 0.8,
  timestamp: new Date().toISOString(),
}

const MOCK_BRAIN = {
  'Prefrontal Cortex': 0.42,
  Amygdala: 0.65,
  Hippocampus: 0.38,
  'Anterior Cingulate': 0.55,
  Insula: 0.48,
}

const MOCK_HISTORY = [
  { timestamp: '2026-06-08T09:00:00Z', score: 22, level: 'green' },
  { timestamp: '2026-06-09T09:00:00Z', score: 30, level: 'green' },
  { timestamp: '2026-06-10T09:00:00Z', score: 45, level: 'yellow' },
  { timestamp: '2026-06-11T09:00:00Z', score: 58, level: 'yellow' },
  { timestamp: '2026-06-12T09:00:00Z', score: 71, level: 'red' },
  { timestamp: '2026-06-13T09:00:00Z', score: 64, level: 'yellow' },
]

export default function App() {
  const [stimulus, setStimulus] = useState(null)
  const [result, setResult] = useState(null)
  const [brain, setBrain] = useState(null)
  const [history, setHistory] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [alertVisible, setAlertVisible] = useState(false)

  useEffect(() => {
    sendStimulus(USER_ID, MOCK_STIMULUS.id)
      .then(setStimulus)
      .catch(() => setStimulus(MOCK_STIMULUS))

    getHistory(USER_ID)
      .then((data) => setHistory(data.history ?? data))
      .catch(() => setHistory(MOCK_HISTORY))
  }, [])

  const handleSubmit = async (responseSignals) => {
    setSubmitting(true)
    const payload = {
      user_id: USER_ID,
      stimulus_id: stimulus?.id ?? MOCK_STIMULUS.id,
      timestamp: new Date().toISOString(),
      ...responseSignals,
    }

    try {
      const burnoutResult = await sendResponse(payload)
      setResult(burnoutResult)
      setAlertVisible(burnoutResult.level === 'red')

      const brainData = await getBrain(USER_ID).catch(() => MOCK_BRAIN)
      setBrain(brainData.regions ?? brainData)
    } catch (err) {
      console.warn('Backend unavailable, showing mock result', err)
      setResult(MOCK_RESULT)
      setBrain(MOCK_BRAIN)
      setAlertVisible(MOCK_RESULT.level === 'red')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Pegasus</h1>
        <p className="app-subtitle">Your Mental Health Check Engine Light</p>
      </header>

      <main className="app-main">
        <section className="app-section">
          <h2>Today's Stimulus</h2>
          <StimulusPlayer stimulus={stimulus} />
        </section>

        <section className="app-section">
          <h2>Your Response</h2>
          <ResponseCapture onSubmit={handleSubmit} disabled={submitting} />
        </section>

        {result && (
          <section className="app-section app-result">
            <h2>Your Check Engine Light</h2>
            <CheckEngine score={result.score} level={result.level} />
            {result.top_indicators?.length > 0 && (
              <div className="app-indicators">
                {result.top_indicators.map((indicator) => (
                  <span key={indicator} className="indicator-pill">
                    {indicator}
                  </span>
                ))}
              </div>
            )}
            {result.intervention && <p className="app-intervention">{result.intervention}</p>}
          </section>
        )}

        {brain && (
          <section className="app-section">
            <BrainHeatmap regions={brain} />
          </section>
        )}

        <section className="app-section">
          <HistoryGraph history={history} />
        </section>
      </main>

      <AlertBanner
        visible={alertVisible}
        intervention={result?.intervention}
        onClose={() => setAlertVisible(false)}
      />
    </div>
  )
}
