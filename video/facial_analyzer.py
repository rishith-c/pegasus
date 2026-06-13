# Custom facial stress analysis (Rishith). MediaPipe Face Mesh is used as a
# LIBRARY (468 landmarks, runs locally, free, no API) — ALL stress
# interpretation logic below is my own, derived from landmark geometry.
import cv2
import mediapipe as mp
import numpy as np


class FacialStressAnalyzer:
    def __init__(self):
        self.mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        )

    def _dist(self, lm, a, b):
        return float(np.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y))

    def analyze_frame(self, frame):
        res = self.mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        if not res.multi_face_landmarks:
            return None
        lm = res.multi_face_landmarks[0].landmark

        # Eye openness (EAR-style): vertical / horizontal eye ratio.
        left_eye = self._dist(lm, 159, 145) / (self._dist(lm, 33, 133) + 1e-6)
        right_eye = self._dist(lm, 386, 374) / (self._dist(lm, 362, 263) + 1e-6)
        eye_open = (left_eye + right_eye) / 2

        # Brow furrow: inner-brow gap (smaller = furrowed = stress).
        brow_gap = self._dist(lm, 70, 300)
        brow_furrow = max(0.0, 1 - brow_gap * 5)

        # Lip compression: lip height / width (smaller = pressed = tension).
        lip_h = self._dist(lm, 13, 14)
        lip_w = self._dist(lm, 61, 291)
        lip_compression = max(0.0, 1 - (lip_h / (lip_w + 1e-6)) * 4)

        # Jaw tension proxy: jaw width relative to face height.
        jaw = self._dist(lm, 234, 454) / (self._dist(lm, 10, 152) + 1e-6)

        return {
            "eye_openness": eye_open,
            "brow_furrow": brow_furrow,
            "lip_compression": lip_compression,
            "jaw_clench": jaw,
        }

    def analyze_video(self, frames):
        results, blinks, prev = [], 0, None
        for f in frames:
            r = self.analyze_frame(f)
            if r:
                results.append(r)
                if prev is not None and prev > 0.25 and r["eye_openness"] < 0.12:
                    blinks += 1
                prev = r["eye_openness"]
        if not results:
            return {"error": "no face detected", "facial_stress_score": 0}

        dur_min = len(frames) / 3 / 60  # ~3fps sampled (every 10th of 30fps)
        brow = float(np.mean([r["brow_furrow"] for r in results]))
        lip = float(np.mean([r["lip_compression"] for r in results]))
        jaw = float(np.mean([r["jaw_clench"] for r in results]))
        eye = 1 - float(np.mean([r["eye_openness"] for r in results]))
        stress = min(int((brow * 0.3 + lip * 0.25 + jaw * 0.25 + eye * 0.2) * 100), 100)
        affect = "negative" if (brow > 0.5 and lip > 0.4) else "flat" if (brow < 0.2 and lip < 0.2) else "neutral"

        return {
            "facial_stress_score": stress,
            "eye_indicators": {
                "blink_rate_per_min": round(blinks / max(dur_min, 0.1), 1),
                "eye_openness": round(float(np.mean([r["eye_openness"] for r in results])), 3),
                "gaze_stability": 0.7,  # placeholder — needs iris tracking
            },
            "facial_indicators": {
                "brow_furrow": round(brow, 3),
                "lip_compression": round(lip, 3),
                "jaw_clench": round(jaw, 3),
                "forced_smile": False,  # placeholder — needs AU6+AU12 mismatch
                "overall_affect": affect,
            },
        }
