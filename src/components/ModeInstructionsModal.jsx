import InstructionBody from "./InstructionBody.jsx";

const MODE_HEADINGS = {
  default: "Default mode",
  medium: "Medium mode",
  advanced: "Advanced mode"
};

/**
 * Full-screen instructions overlay (setup screen or shared pattern).
 */
export default function ModeInstructionsModal({ open, instructionMode = "default", guideByPiece = {}, onClose }) {
  if (!open) return null;

  const heading = MODE_HEADINGS[instructionMode] ?? instructionMode;

  return (
    <div
      className="mode-instructions-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`board-dialog board-dialog--instructions promotion-dialog--arena instruction-dialog instruction-dialog--full mode-instructions-dialog mode-instructions-dialog--${instructionMode}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-instruction-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="instruction-dialog-header">
          <h3 id="mode-instruction-dialog-title">Chems — {heading} instructions</h3>
          <button
            type="button"
            className="instruction-dialog-close-x"
            aria-label="Close instructions"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="instruction-body-scroll">
          <InstructionBody instructionMode={instructionMode} guideByPiece={guideByPiece} />
        </div>
      </div>
    </div>
  );
}
