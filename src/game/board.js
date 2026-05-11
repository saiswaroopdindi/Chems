import { pieceDefinitions } from "./pieceDefinitions";

const BACK_RANK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

const resolveMovement = (type, movementOverrides = {}) => {
  const movementType = movementOverrides[type];
  if (movementType && typeof movementType === "object") {
    return movementType;
  }
  const normalizedType = movementType ?? type;
  if (normalizedType === "straight") {
    return {
      directions: [
        [1, 0], [-1, 0], [0, 1], [0, -1]
      ],
      range: 8
    };
  }
  if (normalizedType === "cross") {
    return {
      directions: [
        [1, 1], [1, -1], [-1, 1], [-1, -1]
      ],
      range: 8
    };
  }
  return pieceDefinitions[normalizedType] ?? pieceDefinitions[type];
};

const createPiece = (type, color, movementOverrides = {}) => ({
  type,
  color,
  hasMoved: false,
  movement: resolveMovement(type, movementOverrides)
});

export const cloneBoard = (board) => board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));

export const createInitialBoard = (config = {}) => {
  const rows = config.rows ?? 8;
  const cols = config.cols ?? 8;
  const movementOverrides = config.movementOverrides ?? {};
  const board = Array.from({ length: rows }, () => Array(cols).fill(null));

  if (config.startingPosition?.length) {
    config.startingPosition.forEach((entry) => {
      const { row, col, type, color } = entry;
      if (!inBounds(board, row, col)) return;
      if (!pieceDefinitions[type]) return;
      if (color !== "white" && color !== "black") return;
      const cell = createPiece(type, color, movementOverrides);
      if (entry.pawnAdvance && type === "pawn") {
        cell.pawnAdvance = entry.pawnAdvance;
        cell.pawnHome = entry.pawnHome ?? [row, col];
        cell.placementPawn = true;
      }
      board[row][col] = cell;
    });
    return board;
  }

  if (rows === 8 && cols === 8 && !config.pieceCounts) {
    for (let file = 0; file < cols; file += 1) {
      board[0][file] = createPiece(BACK_RANK[file], "white", movementOverrides);
      board[1][file] = createPiece("pawn", "white", movementOverrides);
      board[6][file] = createPiece("pawn", "black", movementOverrides);
      board[7][file] = createPiece(BACK_RANK[file], "black", movementOverrides);
    }
    return board;
  }

  const counts = config.pieceCounts ?? {};
  const nextSlotByRow = {};
  const placeRow = (row, color, type, total) => {
    const normalizedTotal = Math.max(0, Number(total) || 0);
    const start = nextSlotByRow[row] ?? 0;
    for (let index = 0; index < normalizedTotal && start + index < cols; index += 1) {
      const col = start + index;
      board[row][col] = createPiece(type, color, movementOverrides);
    }
    nextSlotByRow[row] = Math.min(cols, start + normalizedTotal);
  };

  Object.entries(counts.white ?? {}).forEach(([type, total]) => {
    placeRow(0, "white", type, Number(total) || 0);
  });
  Object.entries(counts.black ?? {}).forEach(([type, total]) => {
    placeRow(rows - 1, "black", type, Number(total) || 0);
  });

  const whitePawns = Number(counts.white?.pawn ?? 0);
  const blackPawns = Number(counts.black?.pawn ?? 0);
  if (rows > 2) {
    placeRow(1, "white", "pawn", whitePawns);
    placeRow(rows - 2, "black", "pawn", blackPawns);
  }
  return board;
};

export const inBounds = (board, row, col) => row >= 0 && row < board.length && col >= 0 && col < board[0].length;

export const opponentColor = (color) => (color === "white" ? "black" : "white");

export const findKingPosition = (board, color) => {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col]?.type === "king" && board[row][col]?.color === color) {
        return [row, col];
      }
    }
  }
  return null;
};

export const toSquare = (row, col) => `${String.fromCharCode(97 + col)}${row + 1}`;

export const fromSquare = (square) => [Number(square[1]) - 1, square.charCodeAt(0) - 97];

export const serializePosition = ({ board, turn, castlingRights, enPassantTarget }) => {
  const boardKey = board
    .map((row) =>
      row
        .map((piece) => {
          if (!piece) return ".";
          const letter = piece.type[0];
          return piece.color === "white" ? letter.toUpperCase() : letter;
        })
        .join("")
    )
    .join("/");

  const rights = ["white", "black"]
    .map((color) => `${color[0]}:${castlingRights[color].kingSide ? "K" : "-"}${castlingRights[color].queenSide ? "Q" : "-"}`)
    .join("|");

  return `${boardKey} ${turn} ${rights} ${enPassantTarget ?? "-"}`;
};
