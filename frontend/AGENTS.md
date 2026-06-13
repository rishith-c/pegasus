# `/frontend` — SHARED by Rishith + Wesley (Expo app, :3000)

This is an **Expo (React Native + TypeScript)** app with **two owners**. Stay
strictly in your files so you never overwrite each other.

## Rishith owns — the DATA LAYER
```
frontend/src/services/api.ts
frontend/src/services/config.ts
frontend/src/hooks/*          (useResponseTracker, useBurnoutScore, useCamera)
frontend/src/types/index.ts
```
Plus the one-time Expo bootstrap (`package.json`, `app.json`, `tsconfig.json`,
`babel.config.js`, `index.ts`) — but `App.tsx` and everything below is Wesley's.

## Wesley owns — the VISUAL LAYER
```
frontend/App.tsx
frontend/src/navigation/*
frontend/src/screens/*
frontend/src/components/*
frontend/src/utils/*          (colors.ts, formatting.ts)
```
Wesley **imports** Rishith's types/api/hooks and never edits them.

## The interface (stable — Wesley imports these)
```ts
import { Stimulus, UserResponse, BurnoutResult, BrainData, FacialAnalysis, VoiceAnalysis } from "./src/types";
import { getStimulus, submitResponse, getScore, getHistory, getBrainData, getMetrics, submitVideo } from "./src/services/api";
import { useResponseTracker } from "./src/hooks/useResponseTracker"; // { onKeyPress, onChangeText, getMetrics, reset }
import { useBurnoutScore } from "./src/hooks/useBurnoutScore";       // { score, loading, error, refresh }
import { useCamera } from "./src/hooks/useCamera";                   // { cameraRef, granted, requestPermission, isRecording, startRecording, stopRecording }
```

## Commit staging (NEVER `git add frontend/` or `git add .`)
```bash
# Rishith:
git add frontend/src/services/ frontend/src/hooks/ frontend/src/types/ ml/ video/
# Wesley:
git add frontend/App.tsx frontend/src/navigation/ frontend/src/screens/ frontend/src/components/ frontend/src/utils/
```

## Run
```bash
cd frontend && npm install
npx expo install react-native-chart-kit react-native-svg @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context expo-linear-gradient expo-haptics react-native-reanimated
npx expo start     # press i (iOS) / a (Android), or scan with Expo Go
```
Set your laptop's LAN IP in `src/services/config.ts` so the phone reaches the backend.
