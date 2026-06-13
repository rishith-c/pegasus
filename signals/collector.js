/**
 * KeystrokeTracker — import this in Wesley's frontend to capture typing signals.
 *
 * Usage:
 *   import { KeystrokeTracker } from '../signals/collector.js';
 *   const tracker = new KeystrokeTracker();
 *   inputEl.addEventListener('keydown', e => tracker.onKeyDown(e));
 *   const metrics = tracker.getMetrics(); // { typing_wpm, error_rate, response_time_ms }
 *   tracker.reset(); // call after sending metrics to /analyze
 */
export class KeystrokeTracker {
  constructor() {
    this.keystrokes = [];
    this.backspaces = 0;
    this.startTime = null;
  }

  onKeyDown(e) {
    if (!this.startTime) this.startTime = Date.now();
    if (e.key === 'Backspace') this.backspaces++;
    this.keystrokes.push({ key: e.key, time: Date.now() });
  }

  getMetrics() {
    if (!this.startTime || this.keystrokes.length === 0) {
      return { typing_wpm: 0, error_rate: 0, response_time_ms: 0 };
    }

    const elapsedMinutes = (Date.now() - this.startTime) / 1000 / 60;
    const wordCount = this.keystrokes.filter(k => k.key === ' ').length + 1;

    return {
      typing_wpm: Math.round(wordCount / Math.max(elapsedMinutes, 0.01)),
      error_rate: Math.round((this.backspaces / Math.max(this.keystrokes.length, 1)) * 100),
      response_time_ms: Date.now() - this.startTime,
    };
  }

  reset() {
    this.keystrokes = [];
    this.backspaces = 0;
    this.startTime = null;
  }
}
