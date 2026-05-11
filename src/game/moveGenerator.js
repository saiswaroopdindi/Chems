import { cloneBoard, findKingPosition, inBounds, opponentColor, toSquare } from "./board";
import { pieceDefinitions } from "./pieceDefinitions";
import { generatePlacementPawnPseudoMoves, isPromotionSquareForAdvance } from "./pawnPlacement";

const ROOK_STARTS = {
  white: {
    queenSide: [0, 0],
    kingSide: [0, 7]
  },
  black: {
    queenSide: [7, 0],
    kingSide: [7, 7]
  }
};

const isSameSquare = (a, b) => a[0] === b[0] && a[1] === b[1];
const keyFor = (row, col) => `${row},${col}`;
const isSafeSquare = (state, row, col) => state.safeSquares?.has(keyFor(row, col));
const jumpOffsets = (jumpPattern = []) =>
  jumpPattern.flatMap(([a, b]) => {
    const offsets = [
      [a, b], [a, -b], [-a, b], [-a, -b]
    ];
    if (a !== b) {
      offsets.push([b, a], [b, -a], [-b, a], [-b, -a]);
    }
    return offsets;
  });

const pushSlidingMoves = (moves, board, row, col, piece, directions, range = 8) => {
  directions.forEach(([dr, dc]) => {
    for (let step = 1; step <= range; step += 1) {
      const r = row + dr * step;
      const c = col + dc * step;
      if (!inBounds(board, r, c)) break;
      if (board[r][c]) {
        if (board[r][c].color !== piece.color) {
          moves.push({ from: [row, col], to: [r, c], type: "capture" });
        }
        break;
      }
      moves.push({ from: [row, col], to: [r, c], type: "quiet" });
    }
  });
};

export const generatePseudoLegalMoves = (state, row, col, forAttack = false) => {
  const piece = state.board[row][col];
  if (!piece) return [];

  const board = state.board;
  const moves = [];

  if (piece.type === "pawn") {
    const usesPlacementGeometry =
      piece.placementPawn &&
      piece.pawnAdvance &&
      !(piece.movement?.directions?.length || piece.movement?.jumps?.length);
    if (usesPlacementGeometry) {
      return generatePlacementPawnPseudoMoves(state, row, col, piece, forAttack, board);
    }

    const direction = piece.color === "white" ? 1 : -1;
    const startRow = piece.color === "white" ? 1 : state.board.length - 2;
    const captureStraight = Boolean(piece.movement?.captureStraight);
    const oneStep = row + direction;
    const twoStep = row + direction * 2;

    if (!forAttack && inBounds(board, oneStep, col) && !board[oneStep][col]) {
      moves.push({ from: [row, col], to: [oneStep, col], type: "quiet" });
      if (row === startRow && inBounds(board, twoStep, col) && !board[twoStep][col]) {
        moves.push({ from: [row, col], to: [twoStep, col], type: "doublePawnPush" });
      }
    }

    [-1, 1].forEach((dc) => {
      const r = row + direction;
      const c = col + dc;
      if (!inBounds(board, r, c)) return;
      if (board[r][c] && board[r][c].color !== piece.color) {
        moves.push({ from: [row, col], to: [r, c], type: "capture" });
      }
      if (state.enPassantTarget && state.enPassantTarget[0] === r && state.enPassantTarget[1] === c) {
        moves.push({ from: [row, col], to: [r, c], type: "enPassant" });
      }
      if (forAttack && !board[r][c]) {
        moves.push({ from: [row, col], to: [r, c], type: "attack" });
      }
    });

    if (captureStraight) {
      const captureRow = row + direction;
      if (inBounds(board, captureRow, col) && board[captureRow][col] && board[captureRow][col].color !== piece.color) {
        moves.push({ from: [row, col], to: [captureRow, col], type: "capture" });
      }
      if (forAttack && inBounds(board, captureRow, col)) {
        moves.push({ from: [row, col], to: [captureRow, col], type: "attack" });
      }
    }
    return moves;
  }

  (piece.movement?.jumps ? jumpOffsets(piece.movement.jumps) : []).forEach(([dr, dc]) => {
    const r = row + dr;
    const c = col + dc;
    if (!inBounds(board, r, c)) return;
    if (!board[r][c] || board[r][c].color !== piece.color) {
      moves.push({ from: [row, col], to: [r, c], type: board[r][c] ? "capture" : "quiet" });
    }
  });

  const directions = piece.movement?.directions ?? [];
  if (directions.length > 0) {
    const range = piece.movement?.range ?? Math.max(board.length, board[0].length);
    pushSlidingMoves(moves, board, row, col, piece, directions, range);
  }

  if (!piece.movement?.jumps && !piece.movement?.directions && piece.type === "knight") {
    pieceDefinitions.knight.jumps.forEach(([dr, dc]) => {
      const r = row + dr;
      const c = col + dc;
      if (!inBounds(board, r, c)) return;
      if (!board[r][c] || board[r][c].color !== piece.color) {
        moves.push({ from: [row, col], to: [r, c], type: board[r][c] ? "capture" : "quiet" });
      }
    });
  }

  if (piece.type === "king" && !forAttack) {
    const rights = state.castlingRights[piece.color];
    const enemy = opponentColor(piece.color);
    const rank = piece.color === "white" ? 0 : 7;
    if (board.length === 8 && board[0].length === 8 && !isSquareAttacked(state, rank, 4, enemy)) {
      if (
        rights.kingSide &&
        !board[rank][5] &&
        !board[rank][6] &&
        board[rank][7]?.type === "rook" &&
        board[rank][7]?.color === piece.color &&
        !isSquareAttacked(state, rank, 5, enemy) &&
        !isSquareAttacked(state, rank, 6, enemy)
      ) {
        moves.push({ from: [row, col], to: [rank, 6], type: "castleKingSide" });
      }
      if (
        rights.queenSide &&
        !board[rank][1] &&
        !board[rank][2] &&
        !board[rank][3] &&
        board[rank][0]?.type === "rook" &&
        board[rank][0]?.color === piece.color &&
        !isSquareAttacked(state, rank, 3, enemy) &&
        !isSquareAttacked(state, rank, 2, enemy)
      ) {
        moves.push({ from: [row, col], to: [rank, 2], type: "castleQueenSide" });
      }
    }
  }

  if (piece.type === "king" && !forAttack) {
    return moves.filter((m) => !isSafeSquare(state, m.to[0], m.to[1]));
  }

  return moves;
};

export const isSquareAttacked = (state, targetRow, targetCol, byColor) => {
  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.color !== byColor) continue;
      const attacks = generatePseudoLegalMoves(state, row, col, true);
      if (attacks.some((move) => move.to[0] === targetRow && move.to[1] === targetCol)) {
        return true;
      }
    }
  }
  return false;
};

const applyMoveOnBoard = (state, move) => {
  const board = cloneBoard(state.board);
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = board[fr][fc];
  const captured = board[tr][tc];
  board[fr][fc] = null;

  if (move.type === "enPassant") {
    board[fr][tc] = null;
  }

  board[tr][tc] = { ...piece, hasMoved: true };

  if (move.type === "castleKingSide") {
    board[tr][5] = { ...board[tr][7], hasMoved: true };
    board[tr][7] = null;
  }
  if (move.type === "castleQueenSide") {
    board[tr][3] = { ...board[tr][0], hasMoved: true };
    board[tr][0] = null;
  }

  const nextCastlingRights = {
    white: { ...state.castlingRights.white },
    black: { ...state.castlingRights.black }
  };

  if (piece.type === "king") {
    nextCastlingRights[piece.color].kingSide = false;
    nextCastlingRights[piece.color].queenSide = false;
  }
  if (piece.type === "rook") {
    Object.entries(ROOK_STARTS[piece.color]).forEach(([side, pos]) => {
      if (isSameSquare([fr, fc], pos)) nextCastlingRights[piece.color][side] = false;
    });
  }
  if (captured?.type === "rook") {
    Object.entries(ROOK_STARTS[captured.color]).forEach(([side, pos]) => {
      if (isSameSquare([tr, tc], pos)) nextCastlingRights[captured.color][side] = false;
    });
  }

  const enPassantTarget =
    move.type === "doublePawnPush"
      ? [Math.round((fr + tr) / 2), Math.round((fc + tc) / 2)]
      : null;

  const nextState = {
    ...state,
    board,
    castlingRights: nextCastlingRights,
    enPassantTarget
  };

  return nextState;
};

export const generateLegalMoves = (state, row, col) => {
  const piece = state.board[row][col];
  if (!piece || piece.color !== state.turn) return [];
  const pseudo = generatePseudoLegalMoves(state, row, col, false);
  return pseudo.filter((move) => {
    if (move.type === "capture" && isSafeSquare(state, move.to[0], move.to[1])) return false;
    if (move.type === "enPassant" && isSafeSquare(state, move.to[0], move.to[1])) return false;
    const next = applyMoveOnBoard(state, move);
    const kingPos = findKingPosition(next.board, piece.color);
    if (!kingPos) return false;
    return !isSquareAttacked(next, kingPos[0], kingPos[1], opponentColor(piece.color));
  });
};

export const hasAnyLegalMove = (state, color = state.turn) => {
  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.color !== color) continue;
      if (generateLegalMoves({ ...state, turn: color }, row, col).length > 0) {
        return true;
      }
    }
  }
  return false;
};

export const materialSignature = (board) =>
  board
    .flat()
    .filter(Boolean)
    .map((piece) => `${piece.color[0]}-${piece.type}`)
    .sort()
    .join(",");

export const toMoveNotation = (move, piece, capture, promotion) => {
  if (move.type === "castleKingSide") return "O-O";
  if (move.type === "castleQueenSide") return "O-O-O";
  const pieceCode = piece.type === "pawn" ? "" : piece.type[0].toUpperCase();
  const captureMark = capture || move.type === "enPassant" ? "x" : "";
  const square = toSquare(move.to[0], move.to[1]);
  const pawnPrefix = piece.type === "pawn" && captureMark ? toSquare(move.from[0], move.from[1])[0] : "";
  const promo = promotion ? `=${promotion[0].toUpperCase()}` : "";
  return `${pieceCode || pawnPrefix}${captureMark}${square}${promo}`;
};

export const applyLegalMove = (state, move, promotionChoice = "queen") => {
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = state.board[fr][fc];
  if (!piece) return null;

  const legalMoves = generateLegalMoves(state, fr, fc);
  const selected = legalMoves.find((candidate) => candidate.to[0] === tr && candidate.to[1] === tc && candidate.type === move.type);
  if (!selected) return null;

  const capturedPiece =
    selected.type === "enPassant" ? state.board[fr][tc] : state.board[tr][tc];
  let next = applyMoveOnBoard(state, selected);
  const R = state.board.length;
  const C = state.board[0]?.length ?? 8;
  let promoted = false;
  if (piece.type === "pawn") {
    if (piece.placementPawn && piece.pawnAdvance) {
      promoted = isPromotionSquareForAdvance(tr, tc, R, C, piece.pawnAdvance);
    } else {
      promoted =
        (piece.color === "white" && tr === R - 1) || (piece.color === "black" && tr === 0);
    }
  }
  if (promoted) {
    next.board[tr][tc] = {
      type: promotionChoice,
      color: piece.color,
      hasMoved: true,
      movement: pieceDefinitions[promotionChoice]
    };
  }

  const halfmoveClock =
    piece.type === "pawn" || Boolean(capturedPiece) || selected.type === "enPassant"
      ? 0
      : state.halfmoveClock + 1;
  const nextTurn = opponentColor(state.turn);

  return {
    ...next,
    turn: nextTurn,
    halfmoveClock,
    fullmoveNumber: state.turn === "black" ? state.fullmoveNumber + 1 : state.fullmoveNumber,
    lastMove: {
      ...selected,
      notation: toMoveNotation(selected, piece, Boolean(capturedPiece), promoted ? promotionChoice : null),
      piece: piece.type,
      color: piece.color,
      capture: capturedPiece ? capturedPiece.type : null,
      promotion: promoted ? promotionChoice : null
    }
  };
};
