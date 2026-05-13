import { createInitialBoard, findKingPosition, opponentColor, serializePosition } from "./board";
import { applyLegalMove, generateLegalMoves, hasAnyLegalMove, isSquareAttacked } from "./moveGenerator";

const initialTimers = (secondsPerPlayer) => ({
  white: secondsPerPlayer,
  black: secondsPerPlayer
});

const toSafeSquareSet = (rules, rows, cols) => {
  const safeSquares = new Set();
  (rules.safeSquares ?? []).forEach(([row, col]) => {
    safeSquares.add(`${row},${col}`);
  });
  if (rules.safeOuterRing) {
    for (let col = 0; col < cols; col += 1) {
      safeSquares.add(`0,${col}`);
      safeSquares.add(`${rows - 1},${col}`);
    }
    for (let row = 0; row < rows; row += 1) {
      safeSquares.add(`${row},0`);
      safeSquares.add(`${row},${cols - 1}`);
    }
  }
  return safeSquares;
};

const isInsufficientMaterial = (board) => {
  const pieces = board.flat().filter(Boolean);
  const nonKings = pieces.filter((piece) => piece.type !== "king");
  if (nonKings.length === 0) return true;
  if (nonKings.length === 1 && ["bishop", "knight"].includes(nonKings[0].type)) return true;
  if (nonKings.length === 2 && nonKings.every((piece) => piece.type === "bishop")) {
    return true;
  }
  return false;
};

export const createInitialGameState = ({
  mode = "local",
  players = { white: "local", black: "local" },
  secondsPerPlayer = 600,
  customRules = {}
} = {}) => {
  const now = Date.now();
  const board = createInitialBoard(customRules.boardConfig ?? {});
  const rows = board.length;
  const cols = board[0]?.length ?? 8;
  const safeSquares = toSafeSquareSet(customRules, rows, cols);
  const castlingEnabled = rows === 8 && cols === 8 && !customRules.disableCastling;
  return {
    board,
    turn: "white",
    castlingRights: {
      white: { kingSide: castlingEnabled, queenSide: castlingEnabled },
      black: { kingSide: castlingEnabled, queenSide: castlingEnabled }
    },
    enPassantTarget: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
    status: "active",
    winner: null,
    drawReason: null,
    moveHistory: [],
    replayCursor: -1,
    snapshots: [],
    positionCounts: {},
    timers: initialTimers(secondsPerPlayer),
    secondsPerPlayer,
    lastTickAt: now,
    turnStartedAt: now,
    whiteDelayRemaining: 10,
    hasPlayedFirstMove: { white: false, black: false },
    firstMoveWindowSeconds: 30,
    lastMove: null,
    mode,
    players,
    resignation: null,
    drawOffer: null,
    customRules,
    safeSquares
  };
};

const evaluateStatus = (state) => {
  const side = state.turn;
  const king = findKingPosition(state.board, side);
  const inCheck = king ? isSquareAttacked(state, king[0], king[1], opponentColor(side)) : false;
  const hasMoves = hasAnyLegalMove(state, side);

  if (!hasMoves && inCheck) {
    return { ...state, status: "checkmate", winner: opponentColor(side), drawReason: null };
  }
  if (!hasMoves && !inCheck) {
    return { ...state, status: "stalemate", winner: null, drawReason: "stalemate" };
  }
  if (state.halfmoveClock >= 100) {
    return { ...state, status: "draw", winner: null, drawReason: "fifty-move rule" };
  }
  if (isInsufficientMaterial(state.board)) {
    return { ...state, status: "draw", winner: null, drawReason: "insufficient material" };
  }
  return { ...state, status: inCheck ? "check" : "active" };
};

const updateRepetition = (state) => {
  const key = serializePosition(state);
  const count = (state.positionCounts[key] ?? 0) + 1;
  const positionCounts = { ...state.positionCounts, [key]: count };
  if (count >= 3) {
    return {
      ...state,
      positionCounts,
      status: "draw",
      winner: null,
      drawReason: "threefold repetition"
    };
  }
  return { ...state, positionCounts };
};

export const makeMove = (state, from, to, promotionChoice = "queen") => {
  if (state.status === "checkmate" || state.status === "draw" || state.status === "resigned" || state.status === "abandoned") return state;
  const [fr, fc] = from;
  const piece = state.board[fr][fc];
  if (!piece || piece.color !== state.turn) return state;

  const legalMoves = generateLegalMoves(state, fr, fc);
  const requested = legalMoves.find((move) => move.to[0] === to[0] && move.to[1] === to[1]);
  if (!requested) return state;

  const nextRaw = applyLegalMove(state, requested, promotionChoice);
  if (!nextRaw) return state;

  const snapshot = {
    board: state.board,
    turn: state.turn,
    castlingRights: state.castlingRights,
    enPassantTarget: state.enPassantTarget,
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
    lastMove: state.lastMove
  };

  const moveHistory = [...state.moveHistory, nextRaw.lastMove];
  let next = {
    ...nextRaw,
    moveHistory,
    snapshots: [...state.snapshots, snapshot],
    replayCursor: moveHistory.length - 1,
    lastTickAt: Date.now(),
    turnStartedAt: Date.now(),
    hasPlayedFirstMove: {
      ...state.hasPlayedFirstMove,
      [piece.color]: true
    },
    drawOffer: null
  };

  next = updateRepetition(next);
  next = evaluateStatus(next);
  return next;
};

export const tickClock = (state, now = Date.now()) => {
  if (state.status !== "active" && state.status !== "check") return state;
  if (!state.lastTickAt) return { ...state, lastTickAt: now, turnStartedAt: state.turnStartedAt ?? now };
  const elapsedMs = now - state.lastTickAt;
  const elapsed = Math.floor(elapsedMs / 1000);
  if (elapsed <= 0) return state;

  const turnElapsedSeconds = Math.floor((now - state.turnStartedAt) / 1000);
  if (!state.hasPlayedFirstMove[state.turn] && turnElapsedSeconds > state.firstMoveWindowSeconds) {
    return {
      ...state,
      lastTickAt: now,
      status: "abandoned",
      drawReason: `${state.turn} did not play first move within ${state.firstMoveWindowSeconds} seconds`,
      winner: null
    };
  }

  let countdownElapsed = elapsed;
  let whiteDelayRemaining = state.whiteDelayRemaining;
  if (!state.hasPlayedFirstMove.white && state.turn === "white" && whiteDelayRemaining > 0) {
    const consume = Math.min(whiteDelayRemaining, elapsed);
    whiteDelayRemaining -= consume;
    countdownElapsed -= consume;
  }

  if (countdownElapsed <= 0) {
    return { ...state, whiteDelayRemaining, lastTickAt: now };
  }

  const remaining = Math.max(0, state.timers[state.turn] - countdownElapsed);
  const timers = { ...state.timers, [state.turn]: remaining };
  if (remaining === 0) {
    return {
      ...state,
      timers,
      whiteDelayRemaining,
      lastTickAt: now,
      status: "timeout",
      winner: opponentColor(state.turn),
      drawReason: null
    };
  }
  return { ...state, timers, whiteDelayRemaining, lastTickAt: now };
};

/** Call after the UI pre-game countdown so White's clock runs immediately (skips engine white start delay). */
export const syncClockAfterPreGameCountdown = (state) => {
  const now = Date.now();
  return {
    ...state,
    lastTickAt: now,
    turnStartedAt: now,
    whiteDelayRemaining: 0
  };
};

export const resign = (state, color) => {
  if (state.status === "checkmate" || state.status === "draw" || state.status === "resigned") return state;
  return {
    ...state,
    status: "resigned",
    winner: opponentColor(color),
    resignation: color
  };
};

export const offerDraw = (state, byColor) => {
  if (state.status !== "active" && state.status !== "check") return state;
  if (state.drawOffer) return state;
  return {
    ...state,
    drawOffer: {
      offeredBy: byColor,
      to: opponentColor(byColor)
    }
  };
};

export const acceptDraw = (state, byColor) => {
  if (!state.drawOffer || state.drawOffer.to !== byColor) return state;
  return {
    ...state,
    status: "draw",
    drawReason: "agreed draw",
    winner: null,
    drawOffer: null
  };
};

export const declineDraw = (state, byColor) => {
  if (!state.drawOffer || state.drawOffer.to !== byColor) return state;
  return {
    ...state,
    drawOffer: null
  };
};

export const undoMove = (state) => {
  if (state.snapshots.length === 0) return state;
  const previous = state.snapshots[state.snapshots.length - 1];
  return {
    ...state,
    ...previous,
    status: "active",
    winner: null,
    drawReason: null,
    moveHistory: state.moveHistory.slice(0, -1),
    snapshots: state.snapshots.slice(0, -1),
    replayCursor: Math.max(-1, state.replayCursor - 1)
  };
};

export const getReplayBoard = (state, cursor) => {
  if (cursor < 0) return createInitialBoard(state.customRules?.boardConfig ?? {});
  if (cursor >= state.snapshots.length) return state.board;
  return state.snapshots[cursor + 1]?.board ?? state.board;
};

export const getBoardAtPly = (state, ply) => {
  if (ply <= 0) return createInitialBoard(state.customRules?.boardConfig ?? {});
  if (ply >= state.moveHistory.length) return state.board;
  return state.snapshots[ply]?.board ?? state.board;
};
