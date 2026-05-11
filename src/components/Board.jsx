import { useEffect, useMemo, useState } from "react";
import {
  acceptDraw,
  createInitialGameState,
  declineDraw,
  getBoardAtPly,
  makeMove,
  offerDraw,
  resign,
  tickClock
} from "../game/gameController";
import { generateLegalMoves } from "../game/moveGenerator";
import { shouldOfferPawnPromotion } from "../game/pawnPlacement";
import { PROMOTION_CHOICES } from "../game/pieces";
import Piece from "./Piece.jsx";
import Square from "./Square.jsx";
import "./Board.css";

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

const formatClock = (seconds) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const safeKey = (row, col) => `${row},${col}`;

export default function Board({ setup, onBackToCustomization, onBackToModeSelect }) {
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructionPiece, setInstructionPiece] = useState("king");
  const initialOptions = useMemo(
    () => ({
      secondsPerPlayer: 600,
      customRules: setup?.customRules ?? {}
    }),
    [setup]
  );
  const [game, setGame] = useState(() => createInitialGameState(initialOptions));
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [error, setError] = useState(null);
  const [viewPly, setViewPly] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setGame((current) => tickClock(current)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setGame(createInitialGameState(initialOptions));
    setSelected(null);
    setLegalMoves([]);
    setError(null);
    setViewPly(null);
    setPendingPromotion(null);
  }, [initialOptions]);

  const statusMessage = useMemo(() => {
    if (game.status === "checkmate") return `Checkmate - ${game.winner} wins`;
    if (game.status === "stalemate") return "Draw - Stalemate";
    if (game.status === "draw") return `Draw - ${game.drawReason}`;
    if (game.status === "abandoned") return `Game abandoned - ${game.drawReason}`;
    if (game.status === "timeout") return `Time out - ${game.winner} wins`;
    if (game.status === "resigned") return `${game.resignation} resigned - ${game.winner} wins`;
    if (game.status === "check") return `${game.turn} is in check`;
    if (game.drawOffer) return `${game.drawOffer.offeredBy} offered a draw`;
    return `${game.turn} to move`;
  }, [game]);

  const onPickSquare = (row, col) => {
    setError(null);
    if (viewPly !== null) {
      setError("You are in move review mode. Click 'Present Game' to play.");
      return;
    }
    const piece = game.board[row][col];
    if (selected && legalMoves.some((move) => move.to[0] === row && move.to[1] === col)) {
      const selectedPiece = game.board[selected[0]][selected[1]];
      const R = game.board.length;
      const C = game.board[0]?.length ?? 8;
      const isPromotion =
        selectedPiece?.type === "pawn" &&
        shouldOfferPawnPromotion(selectedPiece, row, col, R, C);
      if (isPromotion) {
        setPendingPromotion({
          from: [selected[0], selected[1]],
          to: [row, col]
        });
        return;
      }
      const next = makeMove(game, [selected[0], selected[1]], [row, col]);
      if (next === game) {
        setError("Illegal move");
        return;
      }
      setGame(next);
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    if (piece?.color !== game.turn || (game.status !== "active" && game.status !== "check")) {
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    setSelected([row, col]);
    setLegalMoves(generateLegalMoves(game, row, col));
  };

  const onDrop = (from, to) => {
    if (viewPly !== null) {
      setError("You are in move review mode. Click 'Present Game' to play.");
      return;
    }
    const piece = game.board[from[0]]?.[from[1]];
    const R = game.board.length;
    const C = game.board[0]?.length ?? 8;
    const isPromotion =
      piece?.type === "pawn" && shouldOfferPawnPromotion(piece, to[0], to[1], R, C);
    if (isPromotion) {
      setPendingPromotion({ from, to });
      return;
    }

    const next = makeMove(game, from, to);
    if (next !== game) {
      setGame(next);
      setSelected(null);
      setLegalMoves([]);
    } else {
      setError("Move rejected by server-grade validator");
    }
  };

  const commitPromotion = (choice) => {
    if (!pendingPromotion) return;
    const next = makeMove(game, pendingPromotion.from, pendingPromotion.to, choice);
    if (next === game) {
      setError("Promotion move rejected");
      setPendingPromotion(null);
      return;
    }
    setGame(next);
    setPendingPromotion(null);
    setSelected(null);
    setLegalMoves([]);
    setError(null);
  };

  const captured = useMemo(() => {
    const white = [];
    const black = [];
    game.moveHistory.forEach((move) => {
      if (!move.capture) return;
      if (move.color === "white") {
        black.push(move.capture);
      } else {
        white.push(move.capture);
      }
    });
    return { white, black };
  }, [game.moveHistory]);

  const currentPly = game.moveHistory.length;
  const shownPly = viewPly ?? currentPly;
  const shownBoard = getBoardAtPly(game, shownPly);
  const shownLastMove = shownPly > 0 ? game.moveHistory[shownPly - 1] : null;

  const guideByPiece = useMemo(() => {
    const map = {};
    (setup?.movementGuide ?? []).forEach((entry) => {
      map[entry.piece] = entry.description;
    });
    return map;
  }, [setup?.movementGuide]);

  return (
    <div className="chess-app">
      <div className="topbar">
        <h2>Chems</h2>
        {setup?.label ? <div className="mode-pill">{setup.label}</div> : null}
        <div className="status">{statusMessage}</div>
        <div className="topbar-actions">
          <button type="button" className="btn-secondary" onClick={() => setShowInstructions(true)}>
            Instructions
          </button>
          {onBackToCustomization ? (
            <button type="button" className="btn-secondary" onClick={onBackToCustomization}>
              Back to customization
            </button>
          ) : null}
          {onBackToModeSelect ? (
            <button type="button" className="btn-secondary" onClick={onBackToModeSelect}>
              Back to mode selection
            </button>
          ) : null}
        </div>
        <div className="rule-note">White clock starts after 10s delay; first move window is 30s each side.</div>
      </div>

      <div className="layout">
        <div className="panel">
          <h3>Clock</h3>
          <p>White: {formatClock(game.timers.white)}</p>
          <p>Black: {formatClock(game.timers.black)}</p>
          <h3>Actions</h3>
          <button
            onClick={() => {
              setGame(createInitialGameState(initialOptions));
              setViewPly(null);
              setPendingPromotion(null);
              setSelected(null);
              setLegalMoves([]);
            }}
          >
            New game
          </button>
          <button
            onClick={() => {
              setViewPly((prev) => {
                const from = prev === null ? currentPly : prev;
                return Math.max(0, from - 1);
              });
              setSelected(null);
              setLegalMoves([]);
            }}
          >
            Previous move
          </button>
          <button
            onClick={() => {
              setViewPly((prev) => {
                if (prev === null) return null;
                const next = Math.min(currentPly, prev + 1);
                return next === currentPly ? null : next;
              });
              setSelected(null);
              setLegalMoves([]);
            }}
          >
            Next move
          </button>
          <button
            onClick={() => {
              setViewPly(null);
              setSelected(null);
              setLegalMoves([]);
            }}
          >
            Present game
          </button>
          <button onClick={() => setGame((current) => resign(current, current.turn))}>Resign</button>
          <button
            onClick={() => {
              setGame((current) => offerDraw(current, current.turn));
            }}
            disabled={Boolean(game.drawOffer) || viewPly !== null}
          >
            Offer draw
          </button>
          {game.drawOffer && game.drawOffer.to === game.turn ? (
            <div>
              <p>{game.drawOffer.offeredBy} offers a draw.</p>
              <button onClick={() => setGame((current) => acceptDraw(current, current.turn))}>Accept draw</button>
              <button onClick={() => setGame((current) => declineDraw(current, current.turn))}>Decline draw</button>
            </div>
          ) : null}
          {viewPly !== null ? <p>Reviewing move {shownPly} of {currentPly}</p> : <p>Live position</p>}
          {error ? <p className="error">{error}</p> : null}
        </div>

        <div className="board-stage">
          <div className="captured captured-top">
            <strong>Captured from Black:</strong>
            <div className="captured-row">
              {captured.black.map((type, index) => (
                <span key={`${type}-${index}`}>{PIECE_UNICODE.black[type]}</span>
              ))}
            </div>
          </div>
          <div className="board-frame">
            <div
              className="board"
              style={{
                gridTemplateColumns: `repeat(${shownBoard[0]?.length ?? 8}, var(--square-size))`,
                gridTemplateRows: `repeat(${shownBoard.length ?? 8}, var(--square-size))`,
                width: `calc(var(--square-size) * ${shownBoard[0]?.length ?? 8})`,
                height: `calc(var(--square-size) * ${shownBoard.length ?? 8})`
              }}
            >
              {shownBoard.map((row, rowIndex) =>
                row.map((piece, colIndex) => {
                  const key = `${rowIndex}-${colIndex}`;
                  const isSelected = selected?.[0] === rowIndex && selected?.[1] === colIndex;
                  const isHighlighted = legalMoves.some((move) => move.to[0] === rowIndex && move.to[1] === colIndex);
                  const isLast =
                    shownLastMove &&
                    ((shownLastMove.from[0] === rowIndex && shownLastMove.from[1] === colIndex) ||
                      (shownLastMove.to[0] === rowIndex && shownLastMove.to[1] === colIndex));
                  const isSafe = game.safeSquares?.has(safeKey(rowIndex, colIndex));
                  return (
                    <Square
                      key={key}
                      row={rowIndex}
                      col={colIndex}
                      selected={isSelected}
                      highlighted={isHighlighted}
                      lastMove={isLast}
                      safe={isSafe}
                      onClick={() => onPickSquare(rowIndex, colIndex)}
                      onDropMove={onDrop}
                    >
                      {piece ? <Piece piece={piece} from={[rowIndex, colIndex]} /> : null}
                    </Square>
                  );
                })
              )}
            </div>
          </div>
          <div className="captured captured-bottom">
            <strong>Captured from White:</strong>
            <div className="captured-row">
              {captured.white.map((type, index) => (
                <span key={`${type}-${index}`}>{PIECE_UNICODE.white[type]}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>Move history</h3>
          <ol className="history">
            {game.moveHistory.map((move, idx) => (
              <li key={`${move.notation}-${idx}`}>
                {idx + 1}. {move.color} {move.notation}
              </li>
            ))}
          </ol>
          <h3>Online integration</h3>
          <p>
            Engine API is deterministic and reusable for secure server-side validation, real-time relay, matchmaking,
            and spectator streaming.
          </p>
        </div>
      </div>
      {pendingPromotion ? (
        <div className="promotion-overlay">
          <div className="promotion-dialog">
            <h3>Choose promotion piece</h3>
            <div className="promotion-options">
              {PROMOTION_CHOICES.map((type) => (
                <button key={type} onClick={() => commitPromotion(type)}>
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {showInstructions ? (
        <div className="promotion-overlay" role="dialog" aria-modal="true" aria-labelledby="instruction-dialog-title">
          <div className="promotion-dialog instruction-dialog">
            <h3 id="instruction-dialog-title">How pieces move</h3>
            <p className="instruction-intro">
              Standard rules are shown below. In custom games, the text updates when a piece uses non-standard movement.
            </p>
            <div className="instruction-piece-tabs" role="tablist" aria-label="Piece type">
              {INSTRUCTION_PIECES.map((piece) => (
                <button
                  key={piece}
                  type="button"
                  role="tab"
                  aria-selected={instructionPiece === piece}
                  className={`instruction-tab ${instructionPiece === piece ? "instruction-tab--active" : ""}`}
                  onClick={() => setInstructionPiece(piece)}
                >
                  <span className="instruction-tab-glyph">{PIECE_UNICODE.white[piece]}</span>
                  <span className="instruction-tab-name">{piece}</span>
                </button>
              ))}
            </div>
            <div className="instruction-detail" role="tabpanel">
              <h4>
                {PIECE_UNICODE.white[instructionPiece]} {instructionPiece}
              </h4>
              <p>{guideByPiece[instructionPiece] ?? DEFAULT_MOVEMENT_RULES[instructionPiece]}</p>
            </div>
            <button type="button" className="btn-close-guide" onClick={() => setShowInstructions(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

