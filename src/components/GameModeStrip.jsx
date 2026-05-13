const MODES = [
  { id: "default", label: "Default" },
  { id: "medium", label: "Medium" },
  { id: "advanced", label: "Advanced" }
];

export default function GameModeStrip({ value, onChange, className = "", compact = false }) {
  return (
    <nav
      className={`mode-switcher ${compact ? "mode-switcher--compact" : ""} ${className}`.trim()}
      aria-label="Game mode"
    >
      {MODES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`mode-switch-btn ${compact ? "mode-switch-btn--compact" : ""} ${value === id ? "is-active" : ""}`}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
