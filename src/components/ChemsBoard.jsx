import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  acceptDraw,
  createInitialGameState,
  declineDraw,
  getBoardAtPly,
  makeMove,
  offerDraw,
  resign,
  syncClockAfterPreGameCountdown,
  tickClock
} from "../game/gameController";
import { generateLegalMoves } from "../game/moveGenerator";
import { shouldOfferPawnPromotion } from "../game/pawnPlacement";
import { toSquare } from "../game/board.js";
import { PROMOTION_CHOICES } from "../game/pieces";
import Piece from "./Piece.jsx";
import Square from "./Square.jsx";
import GlobalTopNav from "./GlobalTopNav.jsx";
import InstructionBody from "./InstructionBody.jsx";
import "./Board.css";

const formatClock = (seconds) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const safeKey = (row, col) => `${row},${col}`;

const TERMINAL_GAME_STATUSES = new Set([
  "checkmate",
  "stalemate",
  "draw",
  "abandoned",
  "timeout",
  "resigned"
]);

export default function ChemsBoard({
  setup,
  onBackToCustomization,
  sessionStartNonce = 0,
  activeGameMode = "default",
  onGameModeChange
}) {
  const [showInstructions, setShowInstructions] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showOfferDrawConfirm, setShowOfferDrawConfirm] = useState(false);
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
  const [countdown, setCountdown] = useState(null);
  const [awaitingBoardStart, setAwaitingBoardStart] = useState(true);
  const pendingAfterCountdown = useRef(null);
  const processedSessionNonce = useRef(0);

  const beginCountdown = useCallback((afterComplete) => {
    setCountdown((current) => {
      if (current !== null) return current;
      pendingAfterCountdown.current = afterComplete;
      return 5;
    });
  }, []);

  const startGameFromBoard = useCallback(() => {
    beginCountdown(() => {
      setShowInstructions(false);
      setShowResignConfirm(false);
      setShowOfferDrawConfirm(false);
      setGame((current) => syncClockAfterPreGameCountdown(current));
      setAwaitingBoardStart(false);
    });
  }, [beginCountdown]);

  useEffect(() => {
    if (countdown === null) return undefined;
    if (countdown === 0) {
      const fn = pendingAfterCountdown.current;
      pendingAfterCountdown.current = null;
      fn?.();
      setCountdown(null);
      return undefined;
    }
    const id = setTimeout(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  useEffect(() => {
    if (!sessionStartNonce || sessionStartNonce <= processedSessionNonce.current) return;
    processedSessionNonce.current = sessionStartNonce;
    setAwaitingBoardStart(true);
    setShowInstructions(false);
    setShowResignConfirm(false);
    setShowOfferDrawConfirm(false);
  }, [sessionStartNonce]);

  const clockRunning = !awaitingBoardStart && countdown === null;

  useEffect(() => {
    if (!clockRunning) return undefined;
    const timer = setInterval(() => setGame((current) => tickClock(current)), 1000);
    return () => clearInterval(timer);
  }, [clockRunning]);

  useEffect(() => {
    setGame(createInitialGameState(initialOptions));
    setSelected(null);
    setLegalMoves([]);
    setError(null);
    setViewPly(null);
    setPendingPromotion(null);
    setShowInstructions(false);
    setShowResignConfirm(false);
    setShowOfferDrawConfirm(false);
    setAwaitingBoardStart(true);
  }, [initialOptions]);

  const isTerminalGame = TERMINAL_GAME_STATUSES.has(game.status);

  const promotionPieceColor = useMemo(() => {
    if (!pendingPromotion) return "white";
    const [r, c] = pendingPromotion.from;
    return game.board[r]?.[c]?.color ?? "white";
  }, [pendingPromotion, game.board]);

  const gameOverCopy = useMemo(() => {
    if (!isTerminalGame) return null;
    switch (game.status) {
      case "checkmate":
        return { title: "Checkmate", body: `${game.winner} wins.` };
      case "stalemate":
        return { title: "Draw — stalemate", body: "Neither side has a legal move." };
      case "draw":
        return { title: "Draw", body: game.drawReason ?? "Game drawn." };
      case "abandoned":
        return { title: "Game abandoned", body: game.drawReason ?? "" };
      case "timeout":
        return { title: "Time out", body: `${game.winner} wins on time.` };
      case "resigned":
        return {
          title: "Resignation",
          body: `${game.resignation} resigned — ${game.winner} wins.`
        };
      default:
        return { title: "Game over", body: "" };
    }
  }, [game, isTerminalGame]);

  const showGameOverOnBoard = isTerminalGame && viewPly === null;
  const showStartOnBoard = awaitingBoardStart && countdown === null && !isTerminalGame;

  const drawResponsePending = Boolean(
    game.drawOffer &&
      game.drawOffer.to === game.turn &&
      (game.status === "active" || game.status === "check")
  );

  const boardBlockingOverlay =
    showInstructions || showResignConfirm || showOfferDrawConfirm || drawResponsePending;

  const modalOrCountdownBlock = countdown !== null || boardBlockingOverlay;
  const movesBlocked = modalOrCountdownBlock || awaitingBoardStart || Boolean(pendingPromotion);

  const onPickSquare = (row, col) => {
    setError(null);
    if (movesBlocked) return;
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
    if (movesBlocked) return;
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

  const boardCoordRows = shownBoard.length;
  const boardCoordCols = shownBoard[0]?.length ?? 8;
  const fileLabel = (col) => String.fromCharCode(97 + col);
  const rankLabel = (row) => `${row + 1}`;

  return (
    <div className="chess-app chess-app--arena" data-active-turn={game.turn}>
      {onGameModeChange ? (
        <GlobalTopNav modeId={activeGameMode} onModeChange={onGameModeChange} titleTag="h2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setShowResignConfirm(false);
              setShowOfferDrawConfirm(false);
              setShowInstructions(true);
            }}
          >
            Instructions
          </button>
          {onBackToCustomization ? (
            <button type="button" className="btn-secondary" onClick={onBackToCustomization}>
              Back to customization
            </button>
          ) : null}
        </GlobalTopNav>
      ) : (
        <header className="topbar topbar--arena topbar--single-line">
          <div className="topbar-inner">
            <div className="topbar-brand topbar-brand--lead">
              <h2 className="topbar-logo">Chems</h2>
              <span className="mode-pill mode-pill--nav">Default</span>
            </div>
            <nav className="topbar-actions" aria-label="Game menu">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowResignConfirm(false);
                  setShowOfferDrawConfirm(false);
                  setShowInstructions(true);
                }}
              >
                Instructions
              </button>
            </nav>
          </div>
        </header>
      )}

      <div className="layout layout--arena">
        <aside className="panel panel--sidebar panel--glass">
          <section className="sidebar-section">
            <h3 className="sidebar-title">Clock</h3>
            <div className="clock-grid">
              <div
                className={`clock-card clock-card--white ${game.turn === "white" ? "is-active" : ""}`}
              >
                <span className="clock-card__label">White</span>
                <span className="clock-card__time" aria-live="polite">
                  {formatClock(game.timers.white)}
                </span>
              </div>
              <div
                className={`clock-card clock-card--black ${game.turn === "black" ? "is-active" : ""}`}
              >
                <span className="clock-card__label">Black</span>
                <span className="clock-card__time" aria-live="polite">
                  {formatClock(game.timers.black)}
                </span>
              </div>
            </div>
          </section>

          <section className="sidebar-section">
            <h3 className="sidebar-title">Actions</h3>
            <div className="action-buttons">
              <button
                type="button"
                className="btn-panel btn-panel--accent"
                disabled={modalOrCountdownBlock}
                onClick={() => {
                  setShowInstructions(false);
                  setShowResignConfirm(false);
                  setShowOfferDrawConfirm(false);
                  setGame(createInitialGameState(initialOptions));
                  setViewPly(null);
                  setPendingPromotion(null);
                  setSelected(null);
                  setLegalMoves([]);
                  setError(null);
                  setAwaitingBoardStart(true);
                }}
              >
                New game
              </button>
              <button
                type="button"
                className="btn-panel"
                disabled={modalOrCountdownBlock}
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
                type="button"
                className="btn-panel"
                disabled={modalOrCountdownBlock}
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
                type="button"
                className="btn-panel"
                disabled={modalOrCountdownBlock}
                onClick={() => {
                  setViewPly(null);
                  setSelected(null);
                  setLegalMoves([]);
                }}
              >
                Present game
              </button>
              <button
                type="button"
                className="btn-panel btn-panel--danger"
                disabled={modalOrCountdownBlock || awaitingBoardStart || isTerminalGame}
                onClick={() => {
                  setShowInstructions(false);
                  setShowOfferDrawConfirm(false);
                  setShowResignConfirm(true);
                }}
              >
                Resign
              </button>
              <button
                type="button"
                className="btn-panel"
                onClick={() => {
                  setShowInstructions(false);
                  setShowResignConfirm(false);
                  setShowOfferDrawConfirm(true);
                }}
                disabled={
                  Boolean(game.drawOffer) ||
                  viewPly !== null ||
                  modalOrCountdownBlock ||
                  awaitingBoardStart ||
                  isTerminalGame
                }
              >
                Offer draw
              </button>
            </div>
          </section>

          <p className="review-hint">
            {viewPly !== null ? (
              <>
                Reviewing move {shownPly} of {currentPly}
              </>
            ) : (
              <>Live position</>
            )}
          </p>
          {error ? <p className="error">{error}</p> : null}
        </aside>

        <div className="board-stage board-stage--arena">
          <div className="captured captured-top captured-bar">
            <span className="captured-bar__title">Captured from Black</span>
            <div className="captured-row">
              {captured.black.map((type, index) => (
                <span className="captured-chip" key={`${type}-${index}`}>
                  <Piece piece={{ color: "black", type }} from={[0, 0]} draggable={false} />
                </span>
              ))}
            </div>
          </div>
          <div className="board-arena-stack">
            <div className="board-frame board-frame--arena">
              <div className="board-play-area">
              {showStartOnBoard ? (
                <div className="board-start-overlay" aria-live="polite">
                  <div className="board-start-card promotion-dialog--arena">
                    <p className="board-start-kicker">Ready when you are</p>
                    <h3 className="board-start-title">Start</h3>
                    <p className="board-start-hint">Press Start, then a 5 second countdown runs before clocks begin.</p>
                    <button
                      type="button"
                      className="btn-panel btn-panel--accent board-start-btn"
                      onClick={startGameFromBoard}
                      disabled={countdown !== null}
                    >
                      Start
                    </button>
                  </div>
                </div>
              ) : null}

              {countdown !== null && countdown > 0 ? (
                <div className="board-countdown-overlay" aria-live="polite">
                  <p className="board-countdown-label">Game starts in</p>
                  <p key={countdown} className="board-countdown-digit">
                    {countdown}
                  </p>
                  <p className="board-countdown-sub">Get ready to move</p>
                </div>
              ) : null}

              {showGameOverOnBoard && gameOverCopy ? (
                <div
                  className="board-dialog-scrim board-gameover-scrim"
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="board-dialog board-dialog--gameover promotion-dialog--arena"
                    role="alertdialog"
                    aria-labelledby="gameover-title"
                  >
                    <h3 id="gameover-title" className="board-dialog__title board-dialog__title--gameover">
                      {gameOverCopy.title}
                    </h3>
                    <p className="board-dialog__text">{gameOverCopy.body}</p>
                    <div className="board-dialog__actions">
                      <button
                        type="button"
                        className="btn-panel btn-panel--accent"
                        onClick={() => {
                          setShowInstructions(false);
                          setShowResignConfirm(false);
                          setShowOfferDrawConfirm(false);
                          setGame(createInitialGameState(initialOptions));
                          setViewPly(null);
                          setPendingPromotion(null);
                          setSelected(null);
                          setLegalMoves([]);
                          setError(null);
                          setAwaitingBoardStart(true);
                        }}
                      >
                        Play again
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {drawResponsePending ? (
                <div
                  className="board-dialog-scrim board-dialog-scrim--draw"
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="board-dialog board-dialog--confirm promotion-dialog--arena" role="alertdialog" aria-labelledby="draw-offer-title">
                    <h3 id="draw-offer-title" className="board-dialog__title">
                      Draw offer
                    </h3>
                    <p className="board-dialog__text">{game.drawOffer.offeredBy} offers a draw. Accept or decline.</p>
                    <div className="board-dialog__actions">
                      <button
                        type="button"
                        className="btn-panel"
                        onClick={() => setGame((current) => acceptDraw(current, current.turn))}
                      >
                        Accept draw
                      </button>
                      <button
                        type="button"
                        className="btn-panel"
                        onClick={() => setGame((current) => declineDraw(current, current.turn))}
                      >
                        Decline draw
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showResignConfirm ? (
                <div
                  className="board-dialog-scrim"
                  role="presentation"
                  onClick={() => setShowResignConfirm(false)}
                >
                  <div
                    className="board-dialog board-dialog--confirm promotion-dialog--arena"
                    role="alertdialog"
                    aria-labelledby="resign-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 id="resign-title" className="board-dialog__title">
                      Resign game?
                    </h3>
                    <p className="board-dialog__text">
                      You will lose this game immediately. This cannot be undone.
                    </p>
                    <div className="board-dialog__actions board-dialog__actions--row">
                      <button type="button" className="btn-panel" onClick={() => setShowResignConfirm(false)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-panel btn-panel--danger"
                        onClick={() => {
                          setGame((current) => resign(current, current.turn));
                          setShowResignConfirm(false);
                        }}
                      >
                        Resign
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showOfferDrawConfirm ? (
                <div
                  className="board-dialog-scrim"
                  role="presentation"
                  onClick={() => setShowOfferDrawConfirm(false)}
                >
                  <div
                    className="board-dialog board-dialog--confirm promotion-dialog--arena"
                    role="alertdialog"
                    aria-labelledby="offer-draw-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 id="offer-draw-title" className="board-dialog__title">
                      Offer a draw?
                    </h3>
                    <p className="board-dialog__text">
                      Your opponent can accept or decline when it is their turn to respond.
                    </p>
                    <div className="board-dialog__actions board-dialog__actions--row">
                      <button type="button" className="btn-panel" onClick={() => setShowOfferDrawConfirm(false)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-panel btn-panel--accent"
                        onClick={() => {
                          setGame((current) => offerDraw(current, current.turn));
                          setShowOfferDrawConfirm(false);
                        }}
                      >
                        Send offer
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {pendingPromotion ? (
                <div
                  className="board-dialog-scrim board-promotion-scrim"
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="board-dialog board-dialog--promotion promotion-dialog--arena">
                    <h3 className="board-dialog__title">Choose promotion piece</h3>
                    <div className="promotion-options promotion-options--on-board">
                      {PROMOTION_CHOICES.map((type) => (
                        <button type="button" key={type} className="btn-promote btn-promote--with-coin" onClick={() => commitPromotion(type)}>
                          <span className="btn-promote__coin" aria-hidden>
                            <Piece piece={{ color: promotionPieceColor, type }} from={[0, 0]} draggable={false} />
                          </span>
                          <span className="btn-promote__name">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="board-coord-frame">
                <div
                  className="board-coords-files board-coords-files--top"
                  style={{
                    gridTemplateColumns: `repeat(${boardCoordCols}, var(--square-size))`
                  }}
                >
                  {Array.from({ length: boardCoordCols }, (_, c) => (
                    <span key={`file-top-${c}`} className="board-coord board-coord--file">
                      {fileLabel(c)}
                    </span>
                  ))}
                </div>
                <div
                  className="board-coords-ranks board-coords-ranks--left"
                  style={{
                    gridTemplateRows: `repeat(${boardCoordRows}, var(--square-size))`
                  }}
                >
                  {Array.from({ length: boardCoordRows }, (_, r) => (
                    <span key={`rank-left-${r}`} className="board-coord board-coord--rank">
                      {rankLabel(r)}
                    </span>
                  ))}
                </div>
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
                      const isHighlighted = legalMoves.some(
                        (move) => move.to[0] === rowIndex && move.to[1] === colIndex
                      );
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
                <div
                  className="board-coords-files board-coords-files--bottom"
                  style={{
                    gridTemplateColumns: `repeat(${boardCoordCols}, var(--square-size))`
                  }}
                >
                  {Array.from({ length: boardCoordCols }, (_, c) => (
                    <span key={`file-bottom-${c}`} className="board-coord board-coord--file">
                      {fileLabel(c)}
                    </span>
                  ))}
                </div>
                <div
                  className="board-coords-ranks board-coords-ranks--right"
                  style={{
                    gridTemplateRows: `repeat(${boardCoordRows}, var(--square-size))`
                  }}
                >
                  {Array.from({ length: boardCoordRows }, (_, r) => (
                    <span key={`rank-right-${r}`} className="board-coord board-coord--rank">
                      {rankLabel(r)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

            {showInstructions ? (
              <div
                className={`board-dialog-scrim board-dialog-scrim--instructions board-instructions-floating board-instructions-floating--${activeGameMode}`}
                role="presentation"
                onClick={() => setShowInstructions(false)}
              >
                <div
                  className="board-dialog board-dialog--instructions promotion-dialog--arena instruction-dialog instruction-dialog--full instruction-dialog--on-board instruction-dialog--oversized"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="instruction-dialog-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="instruction-dialog-header">
                    <h3 id="instruction-dialog-title">Chems — instructions</h3>
                    <button
                      type="button"
                      className="instruction-dialog-close-x"
                      aria-label="Close instructions"
                      onClick={() => setShowInstructions(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="instruction-body-scroll">
                    <InstructionBody instructionMode={activeGameMode} guideByPiece={guideByPiece} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="captured captured-bottom captured-bar">
            <span className="captured-bar__title">Captured from White</span>
            <div className="captured-row">
              {captured.white.map((type, index) => (
                <span className="captured-chip captured-chip--light" key={`${type}-${index}`}>
                  <Piece piece={{ color: "white", type }} from={[0, 0]} draggable={false} />
                </span>
              ))}
            </div>
          </div>
        </div>

        <aside className="panel panel--sidebar panel--glass panel--history">
          <section className="sidebar-section">
            <h3 className="sidebar-title">Move history</h3>
            <ol className="history history--scroll">
              {game.moveHistory.map((move, idx) => (
                <li key={`${move.notation}-${idx}`}>
                  <span className="history-index">{idx + 1}.</span>{" "}
                  <span className={`history-side history-side--${move.color}`}>{move.color}</span>{" "}
                  <span className="history-move">{move.notation}</span>
                  {move.from && move.to ? (
                    <span className="history-squares">
                      {toSquare(move.from[0], move.from[1])}→{toSquare(move.to[0], move.to[1])}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
