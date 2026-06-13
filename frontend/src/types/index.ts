// Pegasus shared types. Owned by Rishith. Wesley imports these into screens.
// Mirror of the backend contract — keep shape-compatible with Jason's API.

export interface Stimulus {
  id: string;
  type: "image" | "audio" | "text";
  url: string;
  category: "calm" | "neutral" | "activating";
  prompt: string;
}

export interface UserResponse {
  user_id: string;
  stimulus_id: string;
  response_text: string;
  response_time_ms: number;
  response_latency_ms: number;
  typing_wpm: number;
  error_rate: number;
  source: "app" | "sms";
  timestamp: string;
}

export interface BurnoutResult {
  score: number;
  level: "green" | "yellow" | "red";
  tribe_deviation: number;
  behavioral_deviation: number;
  top_indicators: string[];
  intervention: string;
  brain_regions_flagged: string[];
  confidence: number;
  breakdown: {
    imessage: number;
    typing: number;
    facial: number;
    voice: number;
    tribe: number;
  };
  timestamp: string;
}

export interface FacialAnalysis {
  facial_stress_score: number;
  eye_indicators: {
    blink_rate_per_min: number;
    eye_openness: number;
    gaze_stability: number;
  };
  facial_indicators: {
    brow_furrow: number;
    lip_compression: number;
    jaw_clench: number;
    forced_smile: boolean;
    overall_affect: "positive" | "neutral" | "negative" | "flat";
  };
}

export interface VoiceAnalysis {
  transcript: string;
  pitch_mean_hz: number;
  pitch_variability: number;
  speaking_rate_wpm: number;
  pause_frequency: number;
  voice_tremor: boolean;
}

export interface BrainData {
  regions: {
    prefrontal_cortex: number;
    amygdala_region: number;
    temporal_lobe: number;
    motor_cortex: number;
    visual_cortex: number;
  };
  activation_mean: number;
}

// Returned by POST /video/submit (facial + voice + combined).
export interface VideoResult {
  facial: FacialAnalysis;
  voice: VoiceAnalysis;
  combined_score: number;
}
