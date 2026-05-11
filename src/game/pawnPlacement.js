import { inBounds } from "./board";
import {
  upperHalfSymmetric,
  lowerHalfSymmetric,
  leftHalfSymmetric,
  rightHalfSymmetric
} from "./placementRegions";

const lobesVerticalDominant = (r, c, rows, cols) => {
  const dr = r - (rows - 1) / 2;
  const dc = c - (cols - 1) / 2;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  if (adr === adc) return null;
  return adr > adc;
};

const HORIZONTAL_REGIONS = new Set(["left_half", "right_half", "lobes_left_right"]);

/** Lower triangle / half regions: soldiers move toward top (row decreases). */
const VERTICAL_UP_REGIONS = new Set([
  "lower_half",
  "diag_tl_br_lower_left",
  "diag_bl_tr_lower_right"
]);

/**
 * Default soldier forward step for fair symmetry placement (white coordinates;
 * black uses the same rule on black squares).
 */
export const getFairDefaultSoldierAdvance = (regionId, r, c, rows, cols) => {
  if (HORIZONTAL_REGIONS.has(regionId)) {
    const mid = (cols - 1) / 2;
    if (c < mid) return { dr: 0, dc: 1 };
    if (c > mid) return { dr: 0, dc: -1 };
    return { dr: 0, dc: 1 };
  }

  if (regionId === "lobes_top_bottom") {
    const v = lobesVerticalDominant(r, c, rows, cols);
    if (v === true) {
      const rowMid = (rows - 1) / 2;
      if (r < rowMid) return { dr: 1, dc: 0 };
      if (r > rowMid) return { dr: -1, dc: 0 };
      return { dr: 1, dc: 0 };
    }
    return { dr: 1, dc: 0 };
  }

  if (regionId === "ne_sw_quadrants") {
    if (upperHalfSymmetric(r, rows) && rightHalfSymmetric(c, cols)) return { dr: 1, dc: 0 };
    if (lowerHalfSymmetric(r, rows) && leftHalfSymmetric(c, cols)) return { dr: -1, dc: 0 };
    return { dr: 1, dc: 0 };
  }
  if (regionId === "nw_se_quadrants") {
    if (upperHalfSymmetric(r, rows) && leftHalfSymmetric(c, cols)) return { dr: 1, dc: 0 };
    if (lowerHalfSymmetric(r, rows) && rightHalfSymmetric(c, cols)) return { dr: -1, dc: 0 };
    return { dr: 1, dc: 0 };
  }

  if (VERTICAL_UP_REGIONS.has(regionId)) {
    return { dr: -1, dc: 0 };
  }

  return { dr: 1, dc: 0 };
};

export const shouldOfferPawnPromotion = (piece, toRow, toCol, rows, cols) => {
  if (piece.type !== "pawn") return false;
  if (piece.placementPawn && piece.pawnAdvance) {
    return isPromotionSquareForAdvance(toRow, toCol, rows, cols, piece.pawnAdvance);
  }
  return (
    (piece.color === "white" && toRow === rows - 1) || (piece.color === "black" && toRow === 0)
  );
};

export const isPromotionSquareForAdvance = (toRow, toCol, rows, cols, adv) => {
  if (!adv) return false;
  const { dr, dc } = adv;
  if (dr === 1 && dc === 0) return toRow === rows - 1;
  if (dr === -1 && dc === 0) return toRow === 0;
  if (dr === 0 && dc === 1) return toCol === cols - 1;
  if (dr === 0 && dc === -1) return toCol === 0;
  return false;
};

const perpOffsets = (dr, dc) => {
  if (dr !== 0 && dc === 0) return [
    [0, 1],
    [0, -1]
  ];
  if (dc !== 0 && dr === 0) return [
    [1, 0],
    [-1, 0]
  ];
  return [
    [0, 1],
    [0, -1]
  ];
};

export const generatePlacementPawnPseudoMoves = (state, row, col, piece, forAttack, board) => {
  const adv = piece.pawnAdvance;
  if (!adv) return [];
  const { dr, dc } = adv;
  const moves = [];
  const captureStraight = Boolean(piece.movement?.captureStraight);

  const oneR = row + dr;
  const oneC = col + dc;
  const twoR = row + dr * 2;
  const twoC = col + dc * 2;

  const home = piece.pawnHome ?? [row, col];
  const onHome = home[0] === row && home[1] === col;

  if (!forAttack) {
    if (inBounds(board, oneR, oneC) && !board[oneR][oneC]) {
      moves.push({ from: [row, col], to: [oneR, oneC], type: "quiet" });
      if (onHome && inBounds(board, twoR, twoC) && !board[twoR][twoC]) {
        moves.push({ from: [row, col], to: [twoR, twoC], type: "doublePawnPush" });
      }
    }
  }

  perpOffsets(dr, dc).forEach(([pr, pc]) => {
    const cr = row + dr + pr;
    const cc = col + dc + pc;
    if (!inBounds(board, cr, cc)) return;
    if (board[cr][cc] && board[cr][cc].color !== piece.color) {
      moves.push({ from: [row, col], to: [cr, cc], type: "capture" });
    }
    if (forAttack && !board[cr][cc]) {
      moves.push({ from: [row, col], to: [cr, cc], type: "attack" });
    }
    if (state.enPassantTarget && state.enPassantTarget[0] === cr && state.enPassantTarget[1] === cc) {
      moves.push({ from: [row, col], to: [cr, cc], type: "enPassant" });
    }
  });

  if (captureStraight && !forAttack) {
    const sr = row + dr;
    const sc = col + dc;
    if (inBounds(board, sr, sc) && board[sr][sc] && board[sr][sc].color !== piece.color) {
      moves.push({ from: [row, col], to: [sr, sc], type: "capture" });
    }
  }

  return moves;
};
