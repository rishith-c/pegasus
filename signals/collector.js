// KeystrokeTracker — captures typing dynamics in the browser.
// Owner: Dhruva (/signals). Wesley imports this in the frontend:
//   import { KeystrokeTracker } from "../../signals/collector.js";
// (or copy into /frontend/src if cross-folder import is awkward with Vite).

export class KeystrokeTracker {
  constructor() {
    this.keystrokes = [];
    this.backspaces = 0;
    this.startTime = null;
  }

  onKeyDown(e) {
    if (!this.startTime) this.startTime = Date.now();
    if (e.key === "Backspace") this.backspaces++;
    this.keystrokes.push({ key: e.key, time: Date.now() });
  }

  getMetrics() {
    if (!this.startTime || this.keystrokes.length === 0) {
      return { typing_wpm: 0, error_rate: 0, response_time_ms: 0 };
    }
    const elapsedMin = (Date.now() - this.startTime) / 1000 / 60;
    const words = this.keystrokes.filter((k) => k.key === " ").length + 1;
    return {
      typing_wpm: elapsedMin > 0 ? Math.round(words / elapsedMin) : 0,
      error_rate: Math.round((this.backspaces / this.keystrokes.length) * 100),
      response_time_ms: Date.now() - this.startTime,
    };
  }

  reset() {
    this.keystrokes = [];
    this.backspaces = 0;
    this.startTime = null;
  }
}
