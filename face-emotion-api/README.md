# Pegasus Face‑Emotion

A small, reusable framework + HTTP API for **facial affect and multimodal emotion
detection**, built for [Pegasus](../README.md) (our mental‑health "check engine
light"). It turns a face — and optionally a voice — into a compact, product‑ready
read: the dominant emotion, the full distribution, valence/arousal, and a
**healthy‑vs‑distress** affect score.

We extracted this from Pegasus's video pipeline so it can be dropped into any
wellbeing app that needs a quiet, passive emotion signal.

## Why

Most emotion APIs hand you raw class probabilities. Wellbeing apps need a
*single, calm signal* — "is this person reading as regulated or distressed?" —
plus the nuance to tell a forced smile from a genuine one. Pegasus Face‑Emotion
maps the raw FER‑7 distribution into valence/arousal and a stress score, and
fuses it with voice acoustics so the two modalities corroborate each other.

## Install

```bash
pip install -r requirements.txt
export HF_TOKEN=hf_...        # a Hugging Face token
```

## Library

```python
from face_emotion import EmotionDetector, fuse

det = EmotionDetector()                       # default: trpakov/vit-face-expression
face = det.detect("selfie.jpg")               # bytes | path | URL
# {'dominant_emotion': 'sad', 'valence': -0.41, 'arousal': 0.38,
#  'stress_score': 71, 'health_alignment': 0.29, 'emotions': {...}, ...}

clip = det.detect_frames([f1, f2, f3])        # aggregate across video frames

read = fuse(face, voice={"pitch_variability": 72, "voice_tremor": True})
# {'mood': 'negative', 'stress_score': 78, 'signals': ['face:sad', 'voice:shaky'], ...}
```

## API

```bash
uvicorn api:app --port 8010
```

| Method | Path             | Body                       | Returns                  |
|--------|------------------|----------------------------|--------------------------|
| POST   | `/detect`        | multipart `image`          | emotion read             |
| POST   | `/detect/frames` | multipart `images` (many)  | aggregated read          |
| POST   | `/fuse`          | json `{face, voice}`       | multimodal mood + stress |
| GET    | `/health`        | —                          | status                   |

```bash
curl -F image=@selfie.jpg http://localhost:8010/detect
```

## How it works

1. **Classify** — a Vision Transformer fine‑tuned for facial expression
   (Hugging Face `trpakov/vit-face-expression`, FER‑7) gives a probability over
   `angry · disgust · fear · happy · neutral · sad · surprise`.
2. **Map** — those probabilities are projected onto **valence** (pleasant↔unpleasant)
   and **arousal** (calm↔activated), and onto a **healthy‑affect** vs **distress‑affect**
   mass → a 0–100 stress score and a `health_alignment`.
3. **Fuse** — `fuse()` blends the facial stress with voice acoustics (pitch
   variability + tremor), facial affect leading (0.6) and voice supporting (0.4).

Everything degrades gracefully: a missing model/face yields an `unknown` read
rather than an exception.

## Layout

```
face-emotion-api/
├── api.py                 # FastAPI service
├── face_emotion/
│   ├── __init__.py
│   ├── detector.py        # EmotionDetector — classify + map
│   └── fusion.py          # fuse() — face + voice
├── requirements.txt
└── pyproject.toml
```

Built by the Pegasus team — Rishith, Wesley, Dhruva and Jason.
