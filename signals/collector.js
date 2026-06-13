/**
 * TypingBiometrics — full keystroke tracker for Wesley to import.
 * Captures WPM, error rate, hesitations, hold times, flight times,
 * burst pattern, and correction loops.
 *
 * Usage:
 *   import { TypingBiometrics } from '../signals/collector.js';
 *   const tracker = new TypingBiometrics();
 *   inputEl.addEventListener('keydown', e => tracker.onKeyDown(e));
 *   inputEl.addEventListener('keyup',  e => tracker.onKeyUp(e));
 *   const metrics = tracker.getMetrics();
 *   tracker.reset();
 */
export class TypingBiometrics {
  constructor() {
    this.keydowns = [];
    this.keyups = [];
    this.backspaces = 0;
    this.hesitations = 0;
    this.lastKeyTime = null;
    this.corrections = 0;
    this.currentWordDeletes = 0;
    this.startTime = null;
  }

  onKeyDown(event) {
    const now = Date.now();
    if (!this.startTime) this.startTime = now;

    if (this.lastKeyTime && (now - this.lastKeyTime) > 3000) {
      this.hesitations++;
    }

    if (event.key === 'Backspace') {
      this.backspaces++;
      this.currentWordDeletes++;
      if (this.currentWordDeletes > 5) {
        this.corrections++;
        this.currentWordDeletes = 0;
      }
    } else {
      this.currentWordDeletes = 0;
    }

    this.keydowns.push({ key: event.key, time: now });
    this.lastKeyTime = now;
  }

  onKeyUp(event) {
    this.keyups.push({ key: event.key, time: Date.now() });
  }

  getMetrics() {
    if (!this.startTime || this.keydowns.length === 0) {
      return {
        typing_wpm: 0, error_rate: 0, hesitation_count: 0,
        burst_pattern: 'steady', avg_key_hold_ms: 0,
        flight_time_ms: 0, correction_loops: 0, response_time_ms: 0,
      };
    }

    const elapsed = (Date.now() - this.startTime) / 60000;
    const words = this.keydowns.filter(k => k.key === ' ').length + 1;
    const printable = this.keydowns.filter(k => k.key.length === 1);

    // Key hold durations (keydown → matching keyup)
    const holdTimes = [];
    for (const d of this.keydowns) {
      const u = this.keyups.find(u => u.key === d.key && u.time > d.time);
      if (u) holdTimes.push(u.time - d.time);
    }

    // Flight times (keyup → next keydown)
    const flightTimes = [];
    for (let i = 1; i < this.keydowns.length; i++) {
      const prevUp = this.keyups.find(
        u => u.time <= this.keydowns[i].time && u.time > this.keydowns[i - 1].time
      );
      if (prevUp) flightTimes.push(this.keydowns[i].time - prevUp.time);
    }

    // Burst pattern from inter-key gap variance
    const gaps = [];
    for (let i = 1; i < this.keydowns.length; i++) {
      gaps.push(this.keydowns[i].time - this.keydowns[i - 1].time);
    }
    const gapStdDev = _stdDev(gaps);
    const burstPattern = gapStdDev > 500 ? 'erratic' : gapStdDev > 200 ? 'burst-pause' : 'steady';

    return {
      typing_wpm:        Math.round(words / Math.max(elapsed, 0.01)) || 0,
      error_rate:        Math.round((this.backspaces / Math.max(printable.length, 1)) * 100),
      hesitation_count:  this.hesitations,
      burst_pattern:     burstPattern,
      avg_key_hold_ms:   Math.round(_avg(holdTimes)) || 0,
      flight_time_ms:    Math.round(_avg(flightTimes)) || 0,
      correction_loops:  this.corrections,
      response_time_ms:  Date.now() - this.startTime,
    };
  }

  reset() {
    this.keydowns = [];
    this.keyups = [];
    this.backspaces = 0;
    this.hesitations = 0;
    this.lastKeyTime = null;
    this.corrections = 0;
    this.currentWordDeletes = 0;
    this.startTime = null;
  }
}

function _avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function _stdDev(arr) {
  if (!arr.length) return 0;
  const avg = _avg(arr);
  return Math.sqrt(arr.map(x => (x - avg) ** 2).reduce((a, b) => a + b, 0) / arr.length);
}
