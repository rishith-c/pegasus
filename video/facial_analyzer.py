"""Facial stress analysis via MediaPipe Face Mesh (468 landmarks).

Heavy deps (mediapipe, opencv, numpy) are imported lazily so the FastAPI app
can boot and answer /health before the models are available.
"""
from __future__ import annotations

from typing import Dict, List, Optional


class FacialStressAnalyzer:
    def __init__(self) -> None:
        import mediapipe as mp  # lazy

        self._mp = mp
        self.face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        )

    # --- single frame ------------------------------------------------------
    def analyze_frame(self, frame) -> Optional[Dict]:
        import cv2  # lazy

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb)
        if not results.multi_face_landmarks:
            return None
        lm = results.multi_face_landmarks[0]

        left_open = self._eye_openness(lm, "left")
        right_open = self._eye_openness(lm, "right")
        return {
            "eye_openness": (left_open + right_open) / 2,
            "brow_furrow": max(0.0, 1 - self._brow_height(lm)),
            "lip_compression": max(0.0, 1 - self._lip_distance(lm)),
            "jaw_clench": self._jaw_width(lm),
        }

    # --- full clip ---------------------------------------------------------
    def analyze_video(self, frames: List, fps: int = 30) -> Dict:
        import numpy as np  # lazy

        frame_results: List[Dict] = []
        blink_count = 0
        prev_eye_open = None
        for frame in frames:
            r = self.analyze_frame(frame)
            if not r:
                continue
            frame_results.append(r)
            if prev_eye_open is not None and prev_eye_open > 0.3 and r["eye_openness"] < 0.15:
                blink_count += 1
            prev_eye_open = r["eye_openness"]

        if not frame_results:
            return {"error": "no face detected"}

        duration_mins = max(len(frames) / fps / 60, 0.1)
        brow = float(np.mean([r["brow_furrow"] for r in frame_results]))
        lip = float(np.mean([r["lip_compression"] for r in frame_results]))
        jaw = float(np.mean([r["jaw_clench"] for r in frame_results]))
        eye = float(np.mean([r["eye_openness"] for r in frame_results]))

        stress = int(min((brow * 0.3 + lip * 0.25 + jaw * 0.25 + (1 - eye) * 0.2) * 100, 100))
        return {
            "facial_stress_score": stress,
            "eye_indicators": {
                "blink_rate_per_min": round(blink_count / duration_mins, 1),
                "eye_openness": round(eye, 3),
                "gaze_stability": 0.7,  # placeholder — needs iris tracking
            },
            "facial_indicators": {
                "brow_furrow": round(brow, 3),
                "lip_compression": round(lip, 3),
                "jaw_clench": round(jaw, 3),
                "forced_smile": False,  # placeholder — needs AU6+AU12 mismatch
                "overall_affect": self._affect(brow, lip),
            },
        }

    # --- landmark helpers --------------------------------------------------
    @staticmethod
    def _eye_openness(lm, side: str) -> float:
        top, bottom = (159, 145) if side == "left" else (386, 374)
        return abs(lm.landmark[top].y - lm.landmark[bottom].y)

    @staticmethod
    def _brow_height(lm) -> float:
        return abs(lm.landmark[70].y - lm.landmark[159].y)

    @staticmethod
    def _lip_distance(lm) -> float:
        return abs(lm.landmark[13].y - lm.landmark[14].y)

    @staticmethod
    def _jaw_width(lm) -> float:
        return abs(lm.landmark[234].x - lm.landmark[454].x)

    @staticmethod
    def _affect(brow: float, lip: float) -> str:
        if brow > 0.6 and lip > 0.5:
            return "negative"
        if brow < 0.2 and lip < 0.2:
            return "flat"
        if brow < 0.3 and lip < 0.3:
            return "positive"
        return "neutral"
