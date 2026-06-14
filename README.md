# Pegasus

Pegasus is a multimodal burnout detection and mental wellness platform. It works like a check engine light for the mind — passively collecting behavioral signals throughout the day, fusing them into a single wellness score, and surfacing a grounded, personalized intervention when that score drops.

## Architecture

Pegasus is composed of four services that communicate over HTTP:

| Service | Port | Stack | Owner |
|---|---|---|---|
| Backend orchestrator | 8001 | FastAPI, SQLite | Jason |
| Signals processor | 8002 | FastAPI, HuggingFace | Dhruva |
| ML / TRIBE scorer | 8003 | FastAPI, Modal, HuggingFace | Rishith |
| Video analyzer | 8004 | FastAPI | Rishith |

The Expo React Native mobile app connects to the backend at port 8001. The SMS bot runs alongside the signals service and polls iMessage via a local AppleScript bridge.

## Features

### Multimodal Wellness Scoring

The scoring engine fuses up to five behavioral streams into a single wellness score from 0 to 100 (higher is better). Each stream contributes a burnout sub-score that is weighted and normalized depending on which signals are actually present in a given check-in.

| Stream | Weight | Signal |
|---|---|---|
| iMessage / text sentiment | 25% | HuggingFace emotion model (j-hartmann/emotion-english-distilroberta-base) |
| Typing biometrics | 20% | WPM, error rate, hesitation count, key hold time, flight time, correction loops |
| Facial stress | 30% | Video frame analysis via the video service |
| Voice stress | 15% | Audio analysis via the video service |
| TRIBE deviation | 10% | Distance from the user's healthy brain-activity baseline |

The score is inverted from a burnout reading so that rising numbers always mean the user is doing better. Scores above 70 are green, 40-69 are yellow, and below 40 are red.

### TRIBE Baseline Model

TRIBE (Temporal Representation of Integrated Brain Events) v2 is a deployed Modal endpoint that models healthy brain activation patterns across six macro-regions: Attention, Auditory, Emotion, Language, Motor, and Visual. For each daily stimulus, Pegasus calls TRIBE once to establish the user's expected healthy-state baseline, then measures deviation from that baseline as a behavioral burnout signal. TRIBE results are cached per stimulus to avoid repeated GPU calls.

### Crisis and Masking Detection

The scoring engine applies a keyword override layer on top of the emotion model to catch signals the model tends to under-read:

- Crisis terms (suicidal ideation, self-harm language) force the iMessage sub-score to 100 regardless of the emotion model output.
- Concern terms (hopeless, burned out, can't cope, etc.) floor the sub-score proportionally to the number of terms present.
- Masking language (clustered over-reassurance such as "I'm fine, totally fine, don't worry") is detected as a tell and pulls the score out of the green even when the emotion model reads positive.

When the overall score reaches red, the backend routes the user to human support rather than an automated intervention.

### RAG Intervention Engine

When the wellness score drops, Pegasus generates a single, warm, specific recommended action using a retrieval-augmented generation pipeline:

1. A mental health coping corpus is embedded using sentence-transformers/all-MiniLM-L6-v2.
2. The most relevant snippet is retrieved using cosine similarity.
3. A HuggingFace chat model (Qwen/Qwen2.5-7B-Instruct by default) generates a grounded response using only the retrieved content.

The pipeline degrades gracefully at every step: if HuggingFace is unreachable, the raw retrieved snippet is returned; if the corpus is unavailable, a level-appropriate canned response is used. The intervention call never raises.

### Signal Collection

The signals service collects and analyzes behavioral data from multiple sources:

- **iMessage polling** — an AppleScript bridge reads the local Messages database and extracts response text, response time, and typing metadata.
- **Keystroke biometrics** — a JavaScript collector (collector.js) captures WPM, error rate, hesitation count, key hold duration, inter-key flight time, burst pattern, and correction loops from in-app typing sessions.
- **Sentiment analysis** — HuggingFace Inference API replaces any Claude-based sentiment pipeline; the model degrades to a neutral 0.5 score if the API is unreachable.
- **Linguistic analysis** — structural and lexical features of response text.
- **Temporal analysis** — time-of-day and response latency patterns.

The signals service maintains a rolling in-memory history of the last 30 readings per user and exposes them to the backend via a typed JSON contract.

### SMS Bot

The SMS bot provides a low-friction check-in channel for users who are not on the mobile app:

- Outbound check-in prompts are sent via Bloo.io SMS.
- Inbound replies are received via a webhook and routed through the full signal analysis and scoring pipeline.
- Automated reminders run on a configurable cadence.
- Stimulus prompts are sent on the same schedule as the in-app experience.

### Video Check-in

The mobile app includes a video check-in flow:

1. The user records a short clip via the in-app camera (60-second maximum, with a countdown ring).
2. The clip is submitted to the video service, which extracts facial stress and voice stress scores.
3. Results are fused into the wellness score and displayed alongside the brain visualization immediately after analysis.

### Mobile App

The Expo React Native app is the primary user-facing interface:

- **Home screen** — an animated breathing orb displays the current wellness score in the user's level color (green, yellow, red), along with the top behavioral indicators and the current intervention suggestion. A red reading triggers a haptic alert and a full-screen support prompt.
- **Check-in screen** — live camera with face-oval overlay, rotating wellness prompts, recording controls, and a post-analysis results view.
- **Brain screen** — a 3D brain visualization that highlights the TRIBE regions currently flagged as elevated.
- **Metrics screen** — historical wellness score charts and breakdown by signal stream.
- **History screen** — a chronological log of past check-ins and score readings.
- **Chat / Talk screen** — a conversational interface for in-app text check-ins.

The UI uses a liquid glass visual language with level-reactive accent colors throughout.

### Backend API

The FastAPI backend at port 8001 is the single point of integration for the mobile app and SMS bot. It persists all readings to SQLite with WAL mode for concurrency, handles first-time-user race conditions, and exposes the following route groups:

| Route | Purpose |
|---|---|
| `/stimulus` | Deliver the daily check-in prompt |
| `/response` | Accept a text or keystroke-biometric check-in response |
| `/score` | Return the latest wellness score for a user |
| `/brain` | Return TRIBE brain region data for the 3D visualization |
| `/history` | Return the user's check-in history |
| `/metrics` | Return aggregated score and breakdown data for charts |
| `/video` | Accept a video submission and return facial/voice analysis |

### Infrastructure

A launchd supervisor script keeps all four services, the iMessage poller, and the ngrok tunnel alive, restarting any process that exits. The sync script handles safe periodic state synchronization without reverting or deleting data.

## Branch Structure

```
main
 └── dev
      ├── feat/jason-api     backend/, shared/
      ├── feat/wesley-ui     frontend/
      ├── feat/rishith-ml    ml/
      └── feat/dhruva-sig    signals/
```

`feat/integration` and `feat/scaffold` are integration and scaffolding branches used during active development.

## License

MIT License

Copyright (c) 2024 Pegasus Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
