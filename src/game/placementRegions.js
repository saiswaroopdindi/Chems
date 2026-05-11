/** Placement zones for advanced custom white setup (row 0 = top, col 0 = left).
 * Odd-sized boards: cells on split lines (where halves meet) are excluded so only
 * symmetrically distinguishable squares are valid. */

export const ADVANCED_PLACEMENT_REGIONS = [
  { id: "ne_sw_quadrants", label: "Top-right & bottom-left squares (checkerboard)" },
  { id: "nw_se_quadrants", label: "Top-left & bottom-right squares (checkerboard)" },
  { id: "diag_tl_br_upper_right", label: "Diagonal TL–BR: upper-right triangle" },
  { id: "diag_tl_br_lower_left", label: "Diagonal TL–BR: lower-left triangle" },
  { id: "diag_bl_tr_upper_left", label: "Diagonal BL–TR: upper-left triangle" },
  { id: "diag_bl_tr_lower_right", label: "Diagonal BL–TR: lower-right triangle" },
  { id: "upper_half", label: "Upper half" },
  { id: "right_half", label: "Right half" },
  { id: "lobes_top_bottom", label: "Top & bottom (vertical lobes)" },
  { id: "lobes_left_right", label: "Left & right (horizontal lobes)" },
  { id: "lower_half", label: "Lower half" },
  { id: "left_half", label: "Left half" }
];

export const upperHalfSymmetric = (r, rows) => r < Math.floor(rows / 2);
export const lowerHalfSymmetric = (r, rows) => r >= Math.ceil(rows / 2);
export const leftHalfSymmetric = (c, cols) => c < Math.floor(cols / 2);
export const rightHalfSymmetric = (c, cols) => c >= Math.ceil(cols / 2);

const nwSeQuadrants = (r, c, rows, cols) =>
  (upperHalfSymmetric(r, rows) && leftHalfSymmetric(c, cols)) ||
  (lowerHalfSymmetric(r, rows) && rightHalfSymmetric(c, cols));

const neSwQuadrants = (r, c, rows, cols) =>
  (upperHalfSymmetric(r, rows) && rightHalfSymmetric(c, cols)) ||
  (lowerHalfSymmetric(r, rows) && leftHalfSymmetric(c, cols));

/** Main diagonal TL→BR: c*(rows-1) vs r*(cols-1). On-line cells excluded when both dims > 1. */
const mainDiagCompare = (r, c, rows, cols) => {
  const rmax = rows - 1;
  const cmax = cols - 1;
  if (rmax <= 0 || cmax <= 0) return 0;
  return c * rmax - r * cmax;
};

/** Anti-diagonal BL→TR: c*(rows-1)+r*(cols-1) vs (rows-1)*(cols-1). */
const antiDiagCompare = (r, c, rows, cols) => {
  const rmax = rows - 1;
  const cmax = cols - 1;
  const L = rmax * cmax;
  if (L <= 0) return 0;
  return c * rmax + r * cmax - L;
};

const lobesVerticalDominant = (r, c, rows, cols) => {
  const dr = r - (rows - 1) / 2;
  const dc = c - (cols - 1) / 2;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  if (adr === adc) return null;
  return adr > adc;
};

const lobesHorizontalDominant = (r, c, rows, cols) => {
  const v = lobesVerticalDominant(r, c, rows, cols);
  if (v === null) return null;
  return !v;
};

export const isAdvancedPlacementAllowed = (r, c, rows, cols, regionId) => {
  switch (regionId) {
    case "upper_half":
      return upperHalfSymmetric(r, rows);
    case "lower_half":
      return lowerHalfSymmetric(r, rows);
    case "left_half":
      return leftHalfSymmetric(c, cols);
    case "right_half":
      return rightHalfSymmetric(c, cols);
    case "nw_se_quadrants":
      return nwSeQuadrants(r, c, rows, cols);
    case "ne_sw_quadrants":
      return neSwQuadrants(r, c, rows, cols);
    case "diag_tl_br_upper_right": {
      if (rows <= 1 || cols <= 1) return true;
      const cmp = mainDiagCompare(r, c, rows, cols);
      if (cmp === 0) return false;
      return cmp > 0;
    }
    case "diag_tl_br_lower_left": {
      if (rows <= 1 || cols <= 1) return true;
      const cmp = mainDiagCompare(r, c, rows, cols);
      if (cmp === 0) return false;
      return cmp < 0;
    }
    case "diag_bl_tr_upper_left": {
      if (rows <= 1 || cols <= 1) return true;
      const cmp = antiDiagCompare(r, c, rows, cols);
      if (cmp === 0) return false;
      return cmp < 0;
    }
    case "diag_bl_tr_lower_right": {
      if (rows <= 1 || cols <= 1) return true;
      const cmp = antiDiagCompare(r, c, rows, cols);
      if (cmp === 0) return false;
      return cmp > 0;
    }
    case "lobes_top_bottom": {
      const v = lobesVerticalDominant(r, c, rows, cols);
      return v === true;
    }
    case "lobes_left_right": {
      const h = lobesHorizontalDominant(r, c, rows, cols);
      return h === true;
    }
    default:
      return upperHalfSymmetric(r, rows);
  }
};

/**
 * Fair setup: black sits at the board-center partner of white: (rows-1-r, cols-1-c).
 * A cell (br, bc) can hold a mirrored black piece iff the partner white cell
 * (rows-1-br, cols-1-bc) lies in the allowed white placement region.
 * (E.g. TL–BR upper-right white zone ↔ TL–BR lower-left black zone.)
 */
export const isBlackPartnerPlacementAllowed = (mode, br, bc, rows, cols, advancedRegionId) => {
  const rw = rows - 1 - br;
  const cw = cols - 1 - bc;
  return isSetupPlacementAllowed(mode, rw, cw, rows, cols, advancedRegionId);
};

/** @deprecated use isBlackPartnerPlacementAllowed */
export const isBlackMirroredPlacementAllowed = (br, bc, rows, cols, regionId) =>
  isBlackPartnerPlacementAllowed("advanced", br, bc, rows, cols, regionId);

/** Medium mode: upper half only (symmetric split). */
export const isSetupPlacementAllowed = (mode, r, c, rows, cols, advancedRegionId) => {
  if (mode === "medium") {
    return upperHalfSymmetric(r, rows);
  }
  return isAdvancedPlacementAllowed(r, c, rows, cols, advancedRegionId);
};

export const isBlackMirroredSetupAllowed = (mode, br, bc, rows, cols, advancedRegionId) =>
  isBlackPartnerPlacementAllowed(mode, br, bc, rows, cols, advancedRegionId);
