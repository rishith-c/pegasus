# Pegasus API Contract

**Owner:** Jason (`/shared`). This is the single source of truth. If you need a
field changed, change it HERE first, then tell the affected owner.

```
Frontend (Wesley)  :3000   React
Backend  (Jason)   :8001   FastAPI + SQLite   ← orchestrator
Signals  (Dhruva)  :8002   FastAPI
ML       (Rishith) :8003   FastAPI + TRIBE v2
```

## Data flow

```
1. Frontend asks Backend for today's stimulus        GET  :8001/stimulus/today
2. User responds; Frontend captures keystrokes/timing
3. Frontend submits the check-in                     POST :8001/checkin
4. Backend → Signals  analyze behavioral text/typing POST :8002/signals/analyze
5. Backend → ML       predict healthy brain response POST :8003/predict
6. Backend → ML       score deviation = burnout      POST :8003/score
7. Backend → ML       generate intervention (Claude) POST :8003/intervention
8. If level == "red": Backend → Signals send SMS     POST :8002/alert
9. Backend returns engine light + intervention to Frontend
```

---

## Core types

```jsonc
// Stimulus — the daily prompt shown to the user
{ "stimulus_id": "str", "type": "image|audio|text", "content": "str (url or text)", "prompt": "str" }

// CheckIn — what the frontend submits
{
  "user_id": "str",
  "stimulus_id": "str",
  "text_response": "str",
  "response_time_ms": 0,     // ms from stimulus shown → submit
  "typing_wpm": 0,
  "error_rate": 0            // % backspaces, 0-100
}

// BehavioralSignal — Signals service output
{ "sentiment_score": 0.0, "energy_level": "low|medium|high",
  "flags": ["future_tense_low","high_self_reference"], "combined_signal_score": 0.0 }

// BrainPrediction — ML /predict output (what a healthy brain does with the stimulus)
{ "predicted_engagement": 0.0, "predicted_valence": 0.0, "activation_summary": [0.0] }

// BurnoutScore — ML /score output
{ "score": 0, "level": "green|yellow|red", "deviation": 0.0,
  "components": { "engagement_gap": 0.0, "valence_gap": 0.0, "signal_gap": 0.0 } }

// Intervention — ML /intervention output (Claude-generated)
{ "message": "str", "suggested_action": "str" }
```

---

## Endpoints

### ML — Rishith — :8003
| Method | Path           | Body                                            | Returns          |
|--------|----------------|-------------------------------------------------|------------------|
| GET    | `/health`      | —                                               | `{status,model}` |
| POST   | `/predict`     | `{ stimulus }`                                  | `BrainPrediction`|
| POST   | `/score`       | `{ stimulus, prediction, signal, checkin }`     | `BurnoutScore`   |
| POST   | `/intervention`| `{ burnout, recent_signals }`                   | `Intervention`   |

### Signals — Dhruva — :8002
| Method | Path                | Body                                                  | Returns           |
|--------|---------------------|-------------------------------------------------------|-------------------|
| GET    | `/health`           | —                                                     | `{status}`        |
| POST   | `/signals/analyze`  | `{ user_id, text, typing_wpm, error_rate, response_time_ms }` | `BehavioralSignal`|
| GET    | `/signals/{user_id}`| —                                                     | latest `BehavioralSignal` |
| POST   | `/alert`            | `{ user_id, phone, score, level, intervention }`      | `{ sent, message_sid }` |

### Backend — Jason — :8001  (orchestrator)
| Method | Path                 | Body / Query              | Returns                                   |
|--------|----------------------|---------------------------|-------------------------------------------|
| GET    | `/health`            | —                         | `{status}`                                |
| POST   | `/users`             | `{ name, phone }`         | `{ user_id, name, phone }`                |
| GET    | `/users/{user_id}`   | —                         | user                                      |
| GET    | `/stimulus/today`    | `?user_id=`               | `Stimulus`                                |
| POST   | `/checkin`           | `CheckIn`                 | `{ score, level, deviation, intervention, alerted }` |
| GET    | `/status/{user_id}`  | —                         | `{ latest, history: [...] }`              |

### Frontend — Wesley — :3000
React app. Calls **only the Backend** (`:8001`). Captures keystroke metrics
with `signals/collector.js` (`KeystrokeTracker`). Renders the Check Engine
Light: 🟢 green / 🟡 yellow / 🔴 red + the intervention message.

---

## Engine light thresholds (Backend decides level from ML score)
| Score   | Level  | Light |
|---------|--------|-------|
| 0–39    | green  | 🟢    |
| 40–69   | yellow | 🟡    |
| 70–100  | red    | 🔴 → SMS alert |
