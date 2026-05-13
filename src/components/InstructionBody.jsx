const PIECE_UNICODE = {
  white: {
    king: "♔",
    queen: "♕",
    rook: "♖",
    bishop: "♗",
    knight: "♘",
    pawn: "♙"
  },
  black: {
    king: "♚",
    queen: "♛",
    rook: "♜",
    bishop: "♝",
    knight: "♞",
    pawn: "♟"
  }
};

const INSTRUCTION_PIECES = ["king", "queen", "rook", "bishop", "knight", "pawn"];

const DEFAULT_MOVEMENT_RULES = {
  king: "Moves one square in any direction. On a standard 8×8 board, castling may apply when the game allows it.",
  queen: "Moves any number of squares along a rank, file, or diagonal.",
  rook: "Moves any number of squares along a rank or file.",
  bishop: "Moves any number of squares diagonally.",
  knight:
    "Moves in an L-shape (for example two squares in one direction and one square perpendicular), jumping over pieces.",
  pawn:
    "Moves forward one square (or two from its starting rank). Captures one square diagonally forward. Promotes when it reaches the far rank."
};

/**
 * @param {{ instructionMode?: 'default' | 'medium' | 'advanced'; guideByPiece?: Record<string, string> }} props
 */
export default function InstructionBody({ instructionMode = "default", guideByPiece = {} }) {
  return (
    <>
      <section className="instruction-section">
        <h4 className="instruction-section-title">Overview</h4>
        <p>
          Chems is a chess-style game: two players move pieces on a board according to each piece&apos;s rules. White moves
          first. Win by checkmate, or claim a draw when the rules allow. Timed games use the clocks shown in the side
          panel.
        </p>
      </section>

      {instructionMode === "medium" ? (
        <section className="instruction-section instruction-section--mode">
          <h4 className="instruction-section-title">Medium mode</h4>
          <ul className="instruction-list">
            <li>Set board rows and columns (within allowed limits) and piece frequencies before you play.</li>
            <li>
              You place <strong>white</strong> on the upper half of the board; <strong>black</strong> starts from the
              mirrored lower half (180° symmetry). Purple highlights show where black will appear.
            </li>
            <li>Castling is disabled in custom games unless your rules say otherwise.</li>
            <li>After configuring and placing pieces, use <strong>Start game</strong> on the setup screen to begin.</li>
          </ul>
        </section>
      ) : null}

      {instructionMode === "advanced" ? (
        <section className="instruction-section instruction-section--mode">
          <h4 className="instruction-section-title">Advanced mode</h4>
          <ul className="instruction-list">
            <li>
              Configure frequencies, optional <strong>fair unsymmetry</strong> or <strong>unequal armies</strong>, and
              placement regions as shown on the setup screen.
            </li>
            <li>
              Customize movement per piece type (slides, diagonals, jump patterns, or &quot;copy&quot; another standard
              piece), or skip movement customization to use standard chess moves.
            </li>
            <li>
              Optional <strong>safe squares</strong> and an outer safe ring change where pieces may behave differently —
              follow the hints on the setup form.
            </li>
            <li>Soldier (pawn) promotion and direction rules follow your placement and movement choices.</li>
          </ul>
        </section>
      ) : null}

      <section className="instruction-section">
        <h4 className="instruction-section-title">Clock &amp; timing</h4>
        <ul className="instruction-list">
          <li>
            Press <strong>Start</strong> on the board, then after the <strong>5 second</strong> countdown White&apos;s
            clock counts down immediately — no extra delay.
          </li>
          <li>Each side has a window for the first move — plan accordingly.</li>
          <li>The active side is highlighted on the clock cards.</li>
          <li>Running out of time forfeits the game (timeout loss).</li>
        </ul>
      </section>

      <section className="instruction-section">
        <h4 className="instruction-section-title">How to play</h4>
        <ul className="instruction-list">
          <li>
            <strong>Select</strong> your piece by clicking a square with your color on your turn (when the game is
            active).
          </li>
          <li>
            <strong>Move</strong> by clicking a highlighted destination square, or <strong>drag</strong> the piece to a
            legal square.
          </li>
          <li>
            When a pawn reaches the promotion rank, a board popup lets you choose queen, rook, bishop, or knight.
          </li>
          <li>Illegal moves are rejected; the position stays unchanged.</li>
        </ul>
      </section>

      <section className="instruction-section">
        <h4 className="instruction-section-title">Starting &amp; restarting</h4>
        <p>
          Use the centered <strong>Start</strong> button on the board to begin (or after <strong>New game</strong> /{" "}
          <strong>Play again</strong>). A <strong>5 second</strong> countdown then runs; clocks stay paused until it
          finishes. Game results (checkmate, draw, resignation, time, etc.) appear as popups on the board with{" "}
          <strong>Play again</strong>.
        </p>
      </section>

      <section className="instruction-section">
        <h4 className="instruction-section-title">Review mode</h4>
        <p>
          Use <strong>Previous move</strong> and <strong>Next move</strong> to step through history.{" "}
          <strong>Present game</strong> returns to the live position. While reviewing, you cannot play moves — return to
          the present first.
        </p>
      </section>

      <section className="instruction-section">
        <h4 className="instruction-section-title">Draw &amp; resign</h4>
        <ul className="instruction-list">
          <li>
            <strong>Offer draw</strong> opens a confirmation on the board; your opponent responds in a board dialog when
            it is their turn.
          </li>
          <li>
            <strong>Resign</strong> opens a confirmation on the board and ends the game in your opponent&apos;s favor if
            you confirm.
          </li>
        </ul>
      </section>

      <section className="instruction-section">
        <h4 className="instruction-section-title">Custom games</h4>
        <p>
          If you built a custom position or movement rules, piece descriptions below reflect your setup when they differ
          from standard chess.
        </p>
      </section>

      <section className="instruction-section">
        <h4 className="instruction-section-title">Piece movement (standard)</h4>
        <p className="instruction-intro instruction-intro--tight">
          Each piece type moves as follows. Custom rules override these descriptions when applicable.
        </p>
        {INSTRUCTION_PIECES.map((piece) => (
          <div key={piece} className="instruction-piece-block">
            <h5 className="instruction-piece-heading">
              <span className="instruction-piece-glyph">{PIECE_UNICODE.white[piece]}</span>
              <span className="instruction-piece-name">{piece}</span>
            </h5>
            <p className="instruction-piece-text">{guideByPiece[piece] ?? DEFAULT_MOVEMENT_RULES[piece]}</p>
          </div>
        ))}
      </section>
    </>
  );
}
