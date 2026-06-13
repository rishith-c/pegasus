const LIGHTS = {
  green: { emoji: "🟢", label: "All clear", color: "#22c55e" },
  yellow: { emoji: "🟡", label: "Some drift", color: "#eab308" },
  red: { emoji: "🔴", label: "Check engine", color: "#ef4444" },
};

export default function EngineLight({ result }) {
  if (!result) return null;
  const light = LIGHTS[result.level] || LIGHTS.green;
  return (
    <div className="card" style={{ borderColor: light.color }}>
      <div className="light-row">
        <span className="light-emoji">{light.emoji}</span>
        <div>
          <div className="light-label" style={{ color: light.color }}>
            {light.label}
          </div>
          <div className="light-score">
            burnout score {result.score}/100
            {result.alerted ? " · SMS sent" : ""}
          </div>
        </div>
      </div>

      {result.intervention && (
        <div className="intervention">
          <p className="intervention-message">{result.intervention.message}</p>
          <p className="intervention-action">
            ↳ {result.intervention.suggested_action}
          </p>
        </div>
      )}

      {result.components && (
        <div className="components">
          {Object.entries(result.components).map(([k, v]) => (
            <span key={k} className="chip">
              {k.replace(/_/g, " ")}: {Number(v).toFixed(2)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
