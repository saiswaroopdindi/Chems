import GameModeStrip from "./GameModeStrip.jsx";

const MODE_LABEL = {
  default: "Default",
  medium: "Medium",
  advanced: "Advanced"
};

/**
 * Same top bar everywhere: Chems + current mode, then mode tabs, then trailing actions.
 */
export default function GlobalTopNav({ modeId, onModeChange, titleTag: TitleTag = "h2", children = null }) {
  const modeText = MODE_LABEL[modeId] ?? modeId;

  return (
    <header className="global-top-nav topbar topbar--arena topbar--single-line">
      <div className="topbar-inner">
        <div className="topbar-brand topbar-brand--lead">
          <TitleTag className="topbar-logo">Chems</TitleTag>
          {/* <span className="mode-pill mode-pill--nav" title={`Current mode: ${modeText}`}>
            {modeText}
          </span> */}
        </div>
        <GameModeStrip value={modeId} onChange={onModeChange} compact />
        {children ? (
          <nav className="topbar-actions" aria-label="App menu">
            {children}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
