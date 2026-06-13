import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { KeystrokeTracker } from "./keystroke.js";
import EngineLight from "./EngineLight.jsx";

export default function App() {
  const [userId, setUserId] = useState(localStorage.getItem("pegasus_uid") || "");
  const [stimulus, setStimulus] = useState(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const tracker = useRef(new KeystrokeTracker());

  // Ensure we have a user + today's stimulus.
  useEffect(() => {
    (async () => {
      try {
        let uid = userId;
        if (!uid) {
          const u = await api.createUser("Demo User", null);
          uid = u.user_id;
          localStorage.setItem("pegasus_uid", uid);
          setUserId(uid);
        }
        setStimulus(await api.todayStimulus(uid));
      } catch (e) {
        setError("Backend not reachable on :8001 — start it and refresh.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (!text.trim() || !stimulus) return;
    setLoading(true);
    setError(null);
    const metrics = tracker.current.getMetrics();
    try {
      const res = await api.checkin({
        user_id: userId,
        stimulus_id: stimulus.stimulus_id,
        text_response: text,
        ...metrics,
      });
      setResult(res);
    } catch (e) {
      setError("Check-in failed — is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Pegasus</h1>
        <p className="tagline">A check-engine light for your mind.</p>
      </header>

      {error && <div className="card error">{error}</div>}

      {stimulus && !result && (
        <div className="card">
          <div className="stimulus-content">{stimulus.content}</div>
          <p className="stimulus-prompt">{stimulus.prompt}</p>
          <textarea
            value={text}
            placeholder="Type your honest response…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => tracker.current.onKeyDown(e)}
            rows={5}
          />
          <button onClick={submit} disabled={loading || !text.trim()}>
            {loading ? "Reading your signals…" : "Submit check-in"}
          </button>
        </div>
      )}

      <EngineLight result={result} />

      {result && (
        <button
          className="ghost"
          onClick={() => {
            setResult(null);
            setText("");
            tracker.current.reset();
          }}
        >
          New check-in
        </button>
      )}
    </div>
  );
}
