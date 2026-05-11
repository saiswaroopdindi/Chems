import { findKingPosition } from "./board";
import { createInitialGameState } from "./gameController";
import { isSquareAttacked } from "./moveGenerator";

/** @returns {string|null} Error message or null if the position can start. */
export const getStartPositionBlockReason = (customRules = {}) => {
  const state = createInitialGameState({ customRules });
  const wk = findKingPosition(state.board, "white");
  const bk = findKingPosition(state.board, "black");
  if (!wk || !bk) {
    return "Each side must have a king on the board.";
  }
  if (isSquareAttacked(state, wk[0], wk[1], "black")) {
    return "King is exposed — the position is invalid.";
  }
  if (isSquareAttacked(state, bk[0], bk[1], "white")) {
    return "King is exposed — the position is invalid.";
  }
  for (let r = 0; r < state.board.length; r += 1) {
    for (let c = 0; c < state.board[r].length; c += 1) {
      const cell = state.board[r][c];
      if (cell?.type === "king" && state.safeSquares?.has(`${r},${c}`)) {
        return "unable to start the game as king is in the safe square";
      }
    }
  }
  return null;
};
