import Board from "./components/Board.jsx";
import { useEffect, useMemo, useState } from "react";
import {
  ADVANCED_PLACEMENT_REGIONS,
  isBlackPartnerPlacementAllowed,
  isSetupPlacementAllowed
} from "./game/placementRegions";
import { getStartPositionBlockReason } from "./game/startPositionValidation";
import { pieceDefinitions } from "./game/pieceDefinitions";
import { getFairDefaultSoldierAdvance } from "./game/pawnPlacement";

const UNEQUAL_SOLDIER_DIRECTIONS = [
  { id: "down", label: "Toward bottom (↓)", advance: { dr: 1, dc: 0 } },
  { id: "up", label: "Toward top (↑)", advance: { dr: -1, dc: 0 } },
  { id: "right", label: "Toward right (→)", advance: { dr: 0, dc: 1 } },
  { id: "left", label: "Toward left (←)", advance: { dr: 0, dc: -1 } }
];

const MEDIUM_PIECES = ["pawn", "rook", "bishop", "knight", "queen"];
const PIECE_LABELS = {
  pawn: "Soldier",
  rook: "Rook",
  bishop: "Bishop",
  knight: "Knight",
  queen: "Queen",
  king: "King"
};

const WHITE_UNICODE = {
  king: "♔",
  queen: "♕",
  rook: "♖",
  bishop: "♗",
  knight: "♘",
  pawn: "♙"
};

const BLACK_UNICODE = {
  king: "♚",
  queen: "♛",
  rook: "♜",
  bishop: "♝",
  knight: "♞",
  pawn: "♟"
};

const MOVEMENT_PIECES = ["king", "queen", "rook", "bishop", "knight", "pawn"];

const JUMP_OPTIONS = ["2*1", "3*1", "1*3", "3*2", "2*3", "4*1", "1*4", "3*3"];

const createEmptyLayout = (rows, cols) =>
  Array.from({ length: rows }, () => Array(cols).fill(null));

const createEmptyCombinedLayout = (rows, cols) =>
  Array.from({ length: rows }, () => Array(cols).fill(null));

const INITIAL_FREQUENCIES = {
  pawn: 8,
  rook: 2,
  bishop: 2,
  knight: 2,
  queen: 1
};

const cloneLayout = (layout) => layout.map((row) => [...row]);

const cloneCombinedLayout = (layout) =>
  layout.map((row) => row.map((cell) => (cell ? { ...cell } : null)));

const SETUP_PIECE_MIME = "application/setup-piece";
const DEFAULT_SETUP = { label: "Default Mode", customRules: {} };

const layoutWithinLimits = (layout, frequencies) => {
  const counts = { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 };
  layout.forEach((row) => {
    row.forEach((piece) => {
      if (piece) counts[piece] += 1;
    });
  });
  if (counts.king > 1) return false;
  return MEDIUM_PIECES.every((piece) => counts[piece] <= frequencies[piece]);
};

const combinedWithinLimits = (combined, freqWhite, freqBlack) => {
  const w = countCombinedColor(combined, "white");
  const b = countCombinedColor(combined, "black");
  if (w.king > 1 || b.king > 1) return false;
  return (
    MEDIUM_PIECES.every((p) => w[p] <= freqWhite[p]) &&
    MEDIUM_PIECES.every((p) => b[p] <= freqBlack[p])
  );
};

const countLayoutPieces = (layout) => {
  const counts = { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 };
  layout.forEach((row) => {
    row.forEach((piece) => {
      if (piece) counts[piece] += 1;
    });
  });
  return counts;
};

const countCombinedColor = (combinedLayout, color) => {
  const counts = { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 };
  combinedLayout.forEach((row) => {
    row.forEach((cell) => {
      if (cell && cell.color === color) counts[cell.type] += 1;
    });
  });
  return counts;
};

const createEmptyMovementDraft = () => ({
  useDefault: true,
  moveAsPiece: null,
  straight: false,
  cross: false,
  jumpSelections: [],
  soldierKillStraight: false
});

/** Standard chess movement for `sourceType` as an explicit override (for “copy movement”). */
const movementOverrideFromStandardPiece = (sourceType, rows, cols) => {
  const def = pieceDefinitions[sourceType];
  if (!def) return {};
  if (def.directions) {
    return {
      directions: def.directions.map((d) => [...d]),
      range: Math.min(def.range ?? 8, Math.max(rows, cols))
    };
  }
  if (def.jumps) {
    return { jumps: def.jumps.map((j) => [...j]) };
  }
  return {};
};

const parseJumpToken = (token) => {
  const [a, b] = token.split("*").map((value) => Number(value.trim()));
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) return null;
  return [a, b];
};

const buildMovementDefinition = (draft, rows, cols, piece) => {
  if (draft.useDefault && !draft.moveAsPiece) return {};
  if (draft.moveAsPiece) {
    return movementOverrideFromStandardPiece(draft.moveAsPiece, rows, cols);
  }
  const directions = [];
  if (draft.straight) {
    directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
  }
  if (draft.cross) {
    directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
  }
  const jumps = (draft.jumpSelections ?? [])
    .map((token) => parseJumpToken(token))
    .filter(Boolean);

  const movement = {};
  if (directions.length > 0) {
    movement.directions = directions;
    movement.range = Math.max(rows, cols);
  }
  if (jumps.length > 0) {
    movement.jumps = jumps;
  }
  if (piece === "pawn" && draft.soldierKillStraight) {
    movement.captureStraight = true;
  }
  return movement;
};

const buildMovementGuide = (mode, skipMovement, movementDrafts, frequencies) => {
  if (mode !== "advanced") return null;
  if (skipMovement) {
    return MOVEMENT_PIECES.filter((p) => p === "king" || (frequencies[p] ?? 0) > 0).map((piece) => ({
      piece,
      label: PIECE_LABELS[piece],
      description: "Standard chess movement."
    }));
  }
  return MOVEMENT_PIECES.filter((p) => p === "king" || (frequencies[p] ?? 0) > 0).map((piece) => {
    const draft = movementDrafts[piece];
    if (piece === "pawn" && pawnUsesPlacementSoldierRules(draft)) {
      return {
        piece,
        label: PIECE_LABELS[piece],
        description:
          "Default soldier: forward follows your placement zone (fair symmetry) or your chosen direction (unequal armies). Promotion applies only in this default soldier mode, not when the soldier uses custom slides or jumps."
      };
    }
    if (draft.moveAsPiece) {
      return {
        piece,
        label: PIECE_LABELS[piece],
        description: `Moves like a standard ${PIECE_LABELS[draft.moveAsPiece]} (${draft.moveAsPiece}).`
      };
    }
    if (draft.useDefault) {
      return { piece, label: PIECE_LABELS[piece], description: "Standard chess movement." };
    }
    const parts = [];
    if (draft.straight) parts.push("Straight lines (orthogonal slides, like a rook).");
    if (draft.cross) parts.push("Diagonal slides (like a bishop).");
    if ((draft.jumpSelections ?? []).length > 0) {
      parts.push(`Jump offsets: ${draft.jumpSelections.join(", ")} (horse-style).`);
    }
    if (piece === "pawn" && draft.soldierKillStraight) {
      parts.push("Soldier may capture one step straight forward (in addition to diagonals).");
    }
    if (parts.length === 0) {
      return { piece, label: PIECE_LABELS[piece], description: "Custom: no slide or jump patterns selected." };
    }
    return { piece, label: PIECE_LABELS[piece], description: parts.join(" ") };
  });
};

const collectFairMirrored = (whiteLayout, rows, cols) => {
  const white = [];
  whiteLayout.forEach((row, rowIndex) => {
    row.forEach((piece, colIndex) => {
      if (piece) {
        white.push({ row: rowIndex, col: colIndex, type: piece, color: "white" });
      }
    });
  });

  const black = [];
  const seenBlack = new Set();
  white.forEach(({ row, col, type }) => {
    const br = rows - 1 - row;
    const bc = cols - 1 - col;
    const key = `${br},${bc}`;
    if (seenBlack.has(key)) return;
    seenBlack.add(key);
    black.push({ row: br, col: bc, type, color: "black" });
  });

  return [...white, ...black];
};

const collectUnfair = (combinedLayout) => {
  const out = [];
  combinedLayout.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      if (cell) out.push({ row: ri, col: ci, type: cell.type, color: cell.color });
    });
  });
  return out;
};

const pawnUsesPlacementSoldierRules = (pawnDraft) =>
  pawnDraft.useDefault &&
  !pawnDraft.moveAsPiece &&
  !pawnDraft.straight &&
  !pawnDraft.cross &&
  !(pawnDraft.jumpSelections?.length > 0);

const enrichStartingEntries = (entries, opts) => {
  const { movementDrafts, advancedUnfair, regionId, rows, cols, unequalAdvance } = opts;
  if (!pawnUsesPlacementSoldierRules(movementDrafts.pawn)) return entries;
  return entries.map((e) => {
    if (e.type !== "pawn") return e;
    if (advancedUnfair) {
      return { ...e, pawnAdvance: unequalAdvance, pawnHome: [e.row, e.col] };
    }
    const adv = getFairDefaultSoldierAdvance(regionId, e.row, e.col, rows, cols);
    return { ...e, pawnAdvance: adv, pawnHome: [e.row, e.col] };
  });
};

export default function App() {
  const [mode, setMode] = useState(null);
  const [rows, setRows] = useState(8);
  const [cols, setCols] = useState(8);
  const [frequencies, setFrequencies] = useState(INITIAL_FREQUENCIES);
  const [blackFrequencies, setBlackFrequencies] = useState(() => ({ ...INITIAL_FREQUENCIES }));
  const [whiteLayout, setWhiteLayout] = useState(() => createEmptyLayout(8, 8));
  const [combinedLayout, setCombinedLayout] = useState(() => createEmptyCombinedLayout(8, 8));
  const [advancedUnfair, setAdvancedUnfair] = useState(false);
  const [advancedFairUnsym, setAdvancedFairUnsym] = useState(false);
  const [unequalSoldierDirectionId, setUnequalSoldierDirectionId] = useState("down");
  const [safeInnerPairs, setSafeInnerPairs] = useState([]);
  const [safeOuterRing, setSafeOuterRing] = useState(false);
  const [outsideSafeZone, setOutsideSafeZone] = useState(false);
  const [placementPiece, setPlacementPiece] = useState("pawn");
  const [asymPlacementColor, setAsymPlacementColor] = useState("white");
  const [advancedPlacementRegion, setAdvancedPlacementRegion] = useState("upper_half");
  const [startError, setStartError] = useState(null);
  const [activeSetup, setActiveSetup] = useState(null);
  const [skipMovementCustomization, setSkipMovementCustomization] = useState(false);
  const [movementDrafts, setMovementDrafts] = useState(() =>
    MOVEMENT_PIECES.reduce((acc, piece) => ({ ...acc, [piece]: createEmptyMovementDraft() }), {})
  );

  const useCombinedPlacementBoard = mode === "advanced" && (advancedUnfair || advancedFairUnsym);
  const blackFreqForPlacement = advancedFairUnsym ? frequencies : blackFrequencies;

  const whitePlacedCounts = useMemo(
    () =>
      useCombinedPlacementBoard
        ? countCombinedColor(combinedLayout, "white")
        : countLayoutPieces(whiteLayout),
    [combinedLayout, mode, useCombinedPlacementBoard, whiteLayout]
  );
  const blackPlacedCounts = useMemo(
    () =>
      useCombinedPlacementBoard
        ? countCombinedColor(combinedLayout, "black")
        : { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 },
    [combinedLayout, mode, useCombinedPlacementBoard]
  );

  const mergedDisplayFrequencies = useMemo(() => {
    if (!advancedUnfair || advancedFairUnsym) return frequencies;
    return MEDIUM_PIECES.reduce(
      (acc, p) => ({
        ...acc,
        [p]: Math.max(frequencies[p] ?? 0, blackFrequencies[p] ?? 0)
      }),
      {}
    );
  }, [advancedFairUnsym, advancedUnfair, blackFrequencies, frequencies]);

  const unequalSoldierAdvance = useMemo(
    () =>
      UNEQUAL_SOLDIER_DIRECTIONS.find((d) => d.id === unequalSoldierDirectionId)?.advance ?? {
        dr: 1,
        dc: 0
      },
    [unequalSoldierDirectionId]
  );

  const resizeLayout = (nextRows, nextCols) => {
    const copyResized = (current, allowFn) => {
      const curRows = current.length;
      const curCols = current[0]?.length ?? 0;
      const next = createEmptyLayout(nextRows, nextCols);
      for (let r = 0; r < Math.min(curRows, nextRows); r += 1) {
        for (let c = 0; c < Math.min(current[r].length, nextCols); c += 1) {
          const piece = current[r][c];
          if (!piece) continue;
          const oldOk = allowFn(r, c, curRows, curCols);
          const newOk = allowFn(r, c, nextRows, nextCols);
          if (oldOk && newOk) next[r][c] = piece;
        }
      }
      return next;
    };

    setWhiteLayout((current) =>
      copyResized(current, (r, c, R, C) =>
        mode === "advanced" && (advancedUnfair || advancedFairUnsym)
          ? true
          : isSetupPlacementAllowed(mode, r, c, R, C, advancedPlacementRegion)
      )
    );
    if (mode === "advanced" && (advancedUnfair || advancedFairUnsym)) {
      setCombinedLayout((current) => {
        const curRows = current.length;
        const curCols = current[0]?.length ?? 0;
        const next = createEmptyCombinedLayout(nextRows, nextCols);
        for (let r = 0; r < Math.min(curRows, nextRows); r += 1) {
          for (let c = 0; c < Math.min(current[r].length, nextCols); c += 1) {
            next[r][c] = current[r][c];
          }
        }
        return next;
      });
    }
  };

  const whitePlacementAllowed = (r, c, R, C) => {
    if (useCombinedPlacementBoard) return true;
    return isSetupPlacementAllowed(mode, r, c, R, C, advancedPlacementRegion);
  };

  const updateMovementDraft = (piece, updater) => {
    setMovementDrafts((current) => ({
      ...current,
      [piece]: updater(current[piece])
    }));
  };

  const pieceMovementComplete = (piece) => {
    const d = movementDrafts[piece];
    if (d.useDefault && !d.moveAsPiece) return true;
    if (d.moveAsPiece) return true;
    return (
      d.straight ||
      d.cross ||
      (d.jumpSelections?.length ?? 0) > 0 ||
      (piece === "pawn" && d.soldierKillStraight)
    );
  };

  const piecesInPlayForMovement = useMemo(
    () =>
      MOVEMENT_PIECES.filter((piece) => {
        if (piece === "king") return true;
        if (advancedUnfair && mode === "advanced" && !advancedFairUnsym) {
          return (frequencies[piece] ?? 0) > 0 || (blackFrequencies[piece] ?? 0) > 0;
        }
        return (frequencies[piece] ?? 0) > 0;
      }),
    [advancedFairUnsym, advancedUnfair, blackFrequencies, frequencies, mode]
  );

  const advancedMovementOverrides = useMemo(
    () =>
      piecesInPlayForMovement.reduce((acc, piece) => {
        const built = buildMovementDefinition(movementDrafts[piece], rows, cols, piece);
        if (Object.keys(built).length > 0) {
          acc[piece] = built;
        }
        return acc;
      }, {}),
    [cols, movementDrafts, piecesInPlayForMovement, rows]
  );

  useEffect(() => {
    setSafeInnerPairs((prev) =>
      prev.filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < cols)
    );
  }, [rows, cols]);

  const engineSafeInnerSquares = useMemo(() => {
    if (mode !== "advanced") return [];
    const offset = outsideSafeZone ? 1 : 0;
    return safeInnerPairs.map(([r, c]) => [r + offset, c + offset]);
  }, [mode, outsideSafeZone, safeInnerPairs]);

  const outerPaddingSafeSquares = useMemo(() => {
    if (!outsideSafeZone || mode !== "advanced") return [];
    const R = Number(rows) + 2;
    const C = Number(cols) + 2;
    const cells = [];
    for (let col = 0; col < C; col += 1) {
      cells.push([0, col], [R - 1, col]);
    }
    for (let row = 0; row < R; row += 1) {
      cells.push([row, 0], [row, C - 1]);
    }
    return cells;
  }, [cols, mode, outsideSafeZone, rows]);

  const movementGuide = useMemo(
    () =>
      mode === "advanced"
        ? buildMovementGuide(mode, skipMovementCustomization, movementDrafts, mergedDisplayFrequencies)
        : null,
    [mergedDisplayFrequencies, mode, movementDrafts, skipMovementCustomization]
  );

  const draftSetup = useMemo(
    () =>
      mode === "default"
        ? DEFAULT_SETUP
        : {
            label:
              mode === "medium"
                ? "Medium Custom Mode"
                : advancedUnfair
                  ? "Advanced Custom Mode (unequal)"
                  : advancedFairUnsym
                    ? "Advanced Custom Mode (fair unsymmetry)"
                    : "Advanced Custom Mode",
            movementGuide,

            customRules: {
              disableCastling: true,
              boardConfig: {
                rows: Number(rows) + (mode === "advanced" && outsideSafeZone ? 2 : 0),
                cols: Number(cols) + (mode === "advanced" && outsideSafeZone ? 2 : 0),
                pieceCounts: {
                  white: { ...frequencies, king: 1 },
                  black:
                    mode === "advanced" && advancedUnfair && !advancedFairUnsym
                      ? { ...blackFrequencies, king: 1 }
                      : { ...frequencies, king: 1 }
                },
                movementOverrides: mode === "advanced" ? advancedMovementOverrides : {},
                startingPosition: enrichStartingEntries(
                  mode === "advanced" && (advancedUnfair || advancedFairUnsym)
                    ? collectUnfair(combinedLayout)
                    : collectFairMirrored(whiteLayout, Number(rows), Number(cols)),
                  {
                    movementDrafts,
                    advancedUnfair,
                    regionId: advancedPlacementRegion,
                    rows: Number(rows),
                    cols: Number(cols),
                    unequalAdvance: unequalSoldierAdvance
                  }
                ).map((entry) => {
                  if (mode === "advanced" && outsideSafeZone) {
                    const shifted = { ...entry, row: entry.row + 1, col: entry.col + 1 };
                    if (entry.pawnHome) {
                      shifted.pawnHome = [entry.pawnHome[0] + 1, entry.pawnHome[1] + 1];
                    }
                    return shifted;
                  }
                  return entry;
                })
              },
              safeSquares:
                mode === "advanced" ? [...engineSafeInnerSquares, ...outerPaddingSafeSquares] : [],
              safeOuterRing:
                mode === "advanced"
                  ? safeOuterRing
                  : false
            }
          },
    [
      advancedMovementOverrides,
      cols,
      engineSafeInnerSquares,
      frequencies,
      mode,
      movementGuide,
      outerPaddingSafeSquares,
      outsideSafeZone,
      rows,
      safeOuterRing,
      whiteLayout,
      combinedLayout,
      advancedUnfair,
      advancedFairUnsym,
      blackFrequencies,
      movementDrafts,
      advancedPlacementRegion,
      unequalSoldierAdvance
    ]
  );

  const isSetupPhase = mode !== "default" && !activeSetup;
  const canStartGame =
    mode !== "advanced" ||
    skipMovementCustomization ||
    piecesInPlayForMovement.every((piece) => pieceMovementComplete(piece));

  const handleModeSelect = (nextMode) => {
    setMode(nextMode);
    setSkipMovementCustomization(false);
    setMovementDrafts(MOVEMENT_PIECES.reduce((acc, piece) => ({ ...acc, [piece]: createEmptyMovementDraft() }), {}));
    setSafeInnerPairs([]);
    setAdvancedPlacementRegion("upper_half");
    setAdvancedUnfair(false);
    setAdvancedFairUnsym(false);
    setUnequalSoldierDirectionId("down");
    setCombinedLayout(createEmptyCombinedLayout(rows, cols));
    setBlackFrequencies({ ...INITIAL_FREQUENCIES });
    setStartError(null);
    if (nextMode === "default") {
      setActiveSetup(DEFAULT_SETUP);
      return;
    }
    setActiveSetup(null);
  };

  if (!mode) {
    return (
      <main className="mode-screen">
        <h1>Chems</h1>
        <p>Choose game mode</p>

        <div className="mode-grid">
          <button onClick={() => handleModeSelect("default")}>
            Default game
          </button>

          <button onClick={() => handleModeSelect("medium")}>
            Medium custom
          </button>

          <button onClick={() => handleModeSelect("advanced")}>
            Advanced custom
          </button>
        </div>
      </main>
    );
  }

  return (
    <div>
      {isSetupPhase ? (
        <section className="custom-controls">
          <h3>
            {mode === "medium"
              ? "Medium custom setup"
              : advancedUnfair
                ? "Advanced custom setup (unequal armies)"
                : advancedFairUnsym
                  ? "Advanced custom setup (fair unsymmetry)"
                  : "Advanced custom setup"}
          </h3>
          {mode === "advanced" ? (
            <div className="control-row">
              <label>
                <input
                  type="checkbox"
                  checked={advancedFairUnsym}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setAdvancedFairUnsym(next);
                    if (next) {
                      setAdvancedUnfair(false);
                      setCombinedLayout(createEmptyCombinedLayout(rows, cols));
                    }
                  }}
                />
                Fair unsymmetry — equal piece counts, white and black placed independently (not mirrored)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={advancedUnfair}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setAdvancedUnfair(next);
                    if (next) {
                      setAdvancedFairUnsym(false);
                      setCombinedLayout(createEmptyCombinedLayout(rows, cols));
                    }
                  }}
                />
                Asymmetric setup — unequal armies; place white and black separately (no auto symmetry)
              </label>
            </div>
          ) : null}
          {mode === "advanced" && advancedUnfair && pawnUsesPlacementSoldierRules(movementDrafts.pawn) ? (
            <div className="control-row">
              <label>
                Default soldier forward direction (unequal armies only)
                <select
                  value={unequalSoldierDirectionId}
                  onChange={(event) => setUnequalSoldierDirectionId(event.target.value)}
                >
                  {UNEQUAL_SOLDIER_DIRECTIONS.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="field-hint">
                Used only when soldier movement is default. Ignored if you customize the soldier.
              </p>
            </div>
          ) : null}
          <div className="control-row">
            <label>
              Rows
              <input
                type="number"
                min="4"
                max="9"
                value={rows}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setRows(next);
                  resizeLayout(next, cols);
                }}
              />
            </label>
            <label>
              Columns
              <input
                type="number"
                min="4"
                max="9"
                value={cols}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setCols(next);
                  resizeLayout(rows, next);
                }}
              />
            </label>
          </div>

          <div className="control-row">
            {MEDIUM_PIECES.map((piece) => (
              <label key={piece}>
                {PIECE_LABELS[piece]} frequency
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={frequencies[piece]}
                  onChange={(event) =>
                    setFrequencies((current) => ({
                      ...current,
                      [piece]: Number(event.target.value)
                    }))
                  }
                />
              </label>
            ))}
          </div>

          {mode === "advanced" && advancedUnfair && !advancedFairUnsym ? (
            <div className="control-row black-frequencies-row">
              {MEDIUM_PIECES.map((piece) => (
                <label key={`b-${piece}`}>
                  Black {PIECE_LABELS[piece]} frequency
                  <input
                    type="number"
                    min="0"
                    max="12"
                    value={blackFrequencies[piece]}
                    onChange={(event) =>
                      setBlackFrequencies((current) => ({
                        ...current,
                        [piece]: Number(event.target.value)
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          ) : null}

          <div className="placement-tools">
            <div className="placement-boards-row">
              <div className="placement-column">
                {useCombinedPlacementBoard ? (
                  <>
                    <strong>
                      {advancedFairUnsym ? "Fair unsymmetry piece placement" : "Asymmetric piece placement"}
                    </strong>
                    <p className="field-hint">
                      One board for both sides. Use the White and Black piece rows below (active row is highlighted).
                      Drag pieces onto the board or to the remove strip — same for both colors.
                      {advancedFairUnsym
                        ? " Armies must match the same frequencies above for white and black."
                        : null}
                    </p>
                    <div className="palette-dual">
                      <div className="palette-side">
                        <span className="palette-side-label">White</span>
                        <div className="palette-row palette-row--nested">
                          {["king", ...MEDIUM_PIECES].map((piece) => {
                            const limit = piece === "king" ? 1 : frequencies[piece];
                            const placed = whitePlacedCounts[piece];
                            const remaining = Math.max(0, limit - placed);
                            const active = asymPlacementColor === "white" && placementPiece === piece;
                            return (
                              <button
                                key={`aw-${piece}`}
                                type="button"
                                className={`palette-piece ${active ? "active" : ""}`}
                                onClick={() => {
                                  setAsymPlacementColor("white");
                                  setPlacementPiece(piece);
                                }}
                                draggable={remaining > 0}
                                onDragStart={(event) =>
                                  event.dataTransfer.setData(
                                    SETUP_PIECE_MIME,
                                    JSON.stringify({ color: "white", type: piece })
                                  )
                                }
                              >
                                {WHITE_UNICODE[piece]} {PIECE_LABELS[piece]} ({remaining})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="palette-side">
                        <span className="palette-side-label">Black</span>
                        <div className="palette-row palette-row--nested">
                          {["king", ...MEDIUM_PIECES].map((piece) => {
                            const limit =
                              piece === "king"
                                ? 1
                                : advancedFairUnsym
                                  ? frequencies[piece]
                                  : blackFrequencies[piece];
                            const placed = blackPlacedCounts[piece];
                            const remaining = Math.max(0, limit - placed);
                            const active = asymPlacementColor === "black" && placementPiece === piece;
                            return (
                              <button
                                key={`ab-${piece}`}
                                type="button"
                                className={`palette-piece ${active ? "active" : ""}`}
                                onClick={() => {
                                  setAsymPlacementColor("black");
                                  setPlacementPiece(piece);
                                }}
                                draggable={remaining > 0}
                                onDragStart={(event) =>
                                  event.dataTransfer.setData(
                                    SETUP_PIECE_MIME,
                                    JSON.stringify({ color: "black", type: piece })
                                  )
                                }
                              >
                                {BLACK_UNICODE[piece]} {PIECE_LABELS[piece]} ({remaining})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => setCombinedLayout(createEmptyCombinedLayout(rows, cols))}>
                      Clear entire board
                    </button>
                    <div
                      className="placement-board"
                      style={{
                        gridTemplateColumns: `repeat(${cols}, 42px)`,
                        width: `calc(${cols} * 42px)`
                      }}
                    >
                      {combinedLayout.map((row, rowIndex) =>
                        row.map((cell, colIndex) => {
                          const isLight = (rowIndex + colIndex) % 2 === 0;
                          const sym = cell
                            ? cell.color === "white"
                              ? WHITE_UNICODE[cell.type]
                              : BLACK_UNICODE[cell.type]
                            : "";
                          return (
                            <button
                              key={`c-${rowIndex}-${colIndex}`}
                              type="button"
                              className={`placement-square ${isLight ? "light" : "dark"} allowed-zone`}
                              onClick={() => {
                                let nextColor = null;
                                let nextPiece = null;
                                setCombinedLayout((cur) => {
                                  const next = cloneCombinedLayout(cur);
                                  const existing = next[rowIndex][colIndex];
                                  const sc = asymPlacementColor;
                                  const st = placementPiece;
                                  const freq = sc === "white" ? frequencies : blackFreqForPlacement;
                                  const placedMap =
                                    sc === "white"
                                      ? countCombinedColor(cur, "white")
                                      : countCombinedColor(cur, "black");
                                  if (existing) {
                                    if (existing.color === sc && existing.type === st) {
                                      next[rowIndex][colIndex] = null;
                                      return next;
                                    }
                                    const trial = cloneCombinedLayout(cur);
                                    trial[rowIndex][colIndex] = { color: sc, type: st };
                                    if (!combinedWithinLimits(trial, frequencies, blackFreqForPlacement))
                                      return cur;
                                    next[rowIndex][colIndex] = { color: sc, type: st };
                                    nextColor = existing.color;
                                    nextPiece = existing.type;
                                    return next;
                                  }
                                  const limit = st === "king" ? 1 : freq[st];
                                  if (placedMap[st] >= limit) return cur;
                                  next[rowIndex][colIndex] = { color: sc, type: st };
                                  return next;
                                });
                                if (nextColor != null) {
                                  setAsymPlacementColor(nextColor);
                                  setPlacementPiece(nextPiece);
                                }
                              }}
                              draggable={Boolean(cell)}
                              onDragStart={(event) => {
                                if (!cell) return;
                                event.dataTransfer.setData(
                                  SETUP_PIECE_MIME,
                                  JSON.stringify({
                                    color: cell.color,
                                    type: cell.type,
                                    from: [rowIndex, colIndex]
                                  })
                                );
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                const raw = event.dataTransfer.getData(SETUP_PIECE_MIME);
                                if (!raw) return;
                                const payload = JSON.parse(raw);
                                let nextColor = null;
                                let nextPiece = null;
                                setCombinedLayout((cur) => {
                                  const next = cloneCombinedLayout(cur);
                                  const at = next[rowIndex][colIndex];
                                  if (payload.from) {
                                    const [fr, fc] = payload.from;
                                    const moving = cur[fr]?.[fc];
                                    if (!moving) return cur;
                                    if (at) {
                                      const trial = cloneCombinedLayout(cur);
                                      trial[fr][fc] = at;
                                      trial[rowIndex][colIndex] = moving;
                                      if (!combinedWithinLimits(trial, frequencies, blackFreqForPlacement))
                                        return cur;
                                      next[fr][fc] = at;
                                      next[rowIndex][colIndex] = moving;
                                      return next;
                                    }
                                    next[fr][fc] = null;
                                    next[rowIndex][colIndex] = moving;
                                    return next;
                                  }
                                  const pc = payload.color;
                                  const pt = payload.type;
                                  const freq = pc === "white" ? frequencies : blackFreqForPlacement;
                                  const placedMap =
                                    pc === "white"
                                      ? countCombinedColor(cur, "white")
                                      : countCombinedColor(cur, "black");
                                  if (at) {
                                    if (at.color === pc && at.type === pt) return cur;
                                    const trial = cloneCombinedLayout(cur);
                                    trial[rowIndex][colIndex] = { color: pc, type: pt };
                                    if (!combinedWithinLimits(trial, frequencies, blackFreqForPlacement))
                                      return cur;
                                    next[rowIndex][colIndex] = { color: pc, type: pt };
                                    nextColor = at.color;
                                    nextPiece = at.type;
                                    return next;
                                  }
                                  const lim = pt === "king" ? 1 : freq[pt];
                                  if (placedMap[pt] >= lim) return cur;
                                  next[rowIndex][colIndex] = { color: pc, type: pt };
                                  return next;
                                });
                                if (nextColor != null) {
                                  setAsymPlacementColor(nextColor);
                                  setPlacementPiece(nextPiece);
                                }
                              }}
                            >
                              {sym}
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div
                      className="remove-zone"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        const raw = event.dataTransfer.getData(SETUP_PIECE_MIME);
                        if (!raw) return;
                        const payload = JSON.parse(raw);
                        if (!payload.from) return;
                        const [fr, fc] = payload.from;
                        setCombinedLayout((cur) => {
                          const next = cloneCombinedLayout(cur);
                          if (!next[fr]?.[fc]) return cur;
                          next[fr][fc] = null;
                          return next;
                        });
                      }}
                    >
                      Drag a piece here to remove (white or black)
                    </div>
                  </>
                ) : (
                  <>
                    <strong>
                      {mode === "medium" || (mode === "advanced" && !useCombinedPlacementBoard)
                        ? "Piece placement (fair symmetry)"
                        : "White piece placement (drag and drop)"}
                    </strong>
                    {mode === "advanced" && !useCombinedPlacementBoard ? (
                      <div className="control-row placement-region-row">
                        <label className="placement-region-label">
                          Allowed placement area
                          <select
                            value={advancedPlacementRegion}
                            onChange={(event) => setAdvancedPlacementRegion(event.target.value)}
                          >
                            {ADVANCED_PLACEMENT_REGIONS.map(({ id, label }) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="field-hint placement-region-hint">
                          Blue outline: where you may place white. Purple (dim): board-center partner cells where black
                          will start (180° symmetry). Example: TL–BR upper-right white zone pairs with the lower-left
                          triangle. Faded black glyphs preview mirrored pieces.
                        </p>
                      </div>
                    ) : null}
                    {mode === "medium" ? (
                      <p className="field-hint">
                        Medium: white on the upper half; purple shows the symmetric lower half where black will start.
                      </p>
                    ) : null}
                    <div className="palette-row">
                      {["king", ...MEDIUM_PIECES].map((piece) => {
                        const limit = piece === "king" ? 1 : frequencies[piece];
                        const placed = whitePlacedCounts[piece];
                        const remaining = Math.max(0, limit - placed);
                        return (
                          <button
                            key={piece}
                            type="button"
                            className={`palette-piece ${placementPiece === piece ? "active" : ""}`}
                            onClick={() => setPlacementPiece(piece)}
                            draggable={remaining > 0}
                            onDragStart={(event) =>
                              event.dataTransfer.setData("application/white-piece", JSON.stringify({ type: piece }))
                            }
                          >
                            {WHITE_UNICODE[piece]} {PIECE_LABELS[piece]} ({remaining})
                          </button>
                        );
                      })}
                      <button type="button" onClick={() => setWhiteLayout(createEmptyLayout(rows, cols))}>
                        Clear white setup
                      </button>
                    </div>

                    <div
                      className="placement-board"
                      style={{
                        gridTemplateColumns: `repeat(${cols}, 42px)`,
                        width: `calc(${cols} * 42px)`
                      }}
                    >
                      {whiteLayout.map((row, rowIndex) =>
                        row.map((piece, colIndex) => {
                          const isLight = (rowIndex + colIndex) % 2 === 0;
                          const canPlaceHere = whitePlacementAllowed(rowIndex, colIndex, rows, cols);
                          const showFairSymmetry =
                            !useCombinedPlacementBoard && (mode === "advanced" || mode === "medium");
                          const blackPartner =
                            showFairSymmetry &&
                            isBlackPartnerPlacementAllowed(
                              mode,
                              rowIndex,
                              colIndex,
                              rows,
                              cols,
                              advancedPlacementRegion
                            );
                          const partnerR = rows - 1 - rowIndex;
                          const partnerC = cols - 1 - colIndex;
                          const ghostBlackPiece = showFairSymmetry ? whiteLayout[partnerR]?.[partnerC] ?? null : null;
                          const squareBlocked = !canPlaceHere && !blackPartner;
                          return (
                            <button
                              key={`${rowIndex}-${colIndex}`}
                              type="button"
                              className={`placement-square ${isLight ? "light" : "dark"} ${
                                canPlaceHere ? "allowed-zone" : ""
                              } ${blackPartner ? "black-partner-zone" : ""} ${squareBlocked ? "blocked" : ""}`}
                              onClick={() => {
                                if (!canPlaceHere) return;
                                let nextPalette = null;
                                setWhiteLayout((current) => {
                                  const next = cloneLayout(current);
                                  const existing = next[rowIndex][colIndex];
                                  if (existing) {
                                    if (existing === placementPiece) {
                                      next[rowIndex][colIndex] = null;
                                      return next;
                                    }
                                    const trial = cloneLayout(current);
                                    trial[rowIndex][colIndex] = placementPiece;
                                    if (!layoutWithinLimits(trial, frequencies)) return current;
                                    next[rowIndex][colIndex] = placementPiece;
                                    nextPalette = existing;
                                    return next;
                                  }
                                  const limit = placementPiece === "king" ? 1 : frequencies[placementPiece];
                                  const placed = whitePlacedCounts[placementPiece];
                                  if (placed >= limit) return current;
                                  next[rowIndex][colIndex] = placementPiece;
                                  return next;
                                });
                                if (nextPalette !== null) setPlacementPiece(nextPalette);
                              }}
                              draggable={Boolean(piece)}
                              onDragStart={(event) => {
                                if (!piece) return;
                                event.dataTransfer.setData(
                                  "application/white-piece",
                                  JSON.stringify({ type: piece, from: [rowIndex, colIndex] })
                                );
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                const raw = event.dataTransfer.getData("application/white-piece");
                                if (!raw) return;
                                if (!canPlaceHere) return;
                                const payload = JSON.parse(raw);
                                let nextPalette = null;
                                setWhiteLayout((current) => {
                                  const next = cloneLayout(current);
                                  if (payload.from) {
                                    const [fr, fc] = payload.from;
                                    const moving = next[fr]?.[fc];
                                    if (!moving) return current;
                                    const atTarget = next[rowIndex][colIndex];
                                    if (atTarget) {
                                      const fromAllowed = whitePlacementAllowed(fr, fc, rows, cols);
                                      if (!fromAllowed || !canPlaceHere) return current;
                                      const trial = cloneLayout(current);
                                      trial[fr][fc] = atTarget;
                                      trial[rowIndex][colIndex] = moving;
                                      if (!layoutWithinLimits(trial, frequencies)) return current;
                                      next[fr][fc] = atTarget;
                                      next[rowIndex][colIndex] = moving;
                                      return next;
                                    }
                                    if (!canPlaceHere) return current;
                                    next[fr][fc] = null;
                                    next[rowIndex][colIndex] = moving;
                                    return next;
                                  }
                                  const type = payload.type;
                                  const atTarget = next[rowIndex][colIndex];
                                  if (atTarget) {
                                    if (atTarget === type) return current;
                                    const trial = cloneLayout(current);
                                    trial[rowIndex][colIndex] = type;
                                    if (!layoutWithinLimits(trial, frequencies)) return current;
                                    next[rowIndex][colIndex] = type;
                                    nextPalette = atTarget;
                                    return next;
                                  }
                                  const limit = type === "king" ? 1 : frequencies[type];
                                  const placed = whitePlacedCounts[type];
                                  if (placed >= limit) return current;
                                  next[rowIndex][colIndex] = type;
                                  return next;
                                });
                                if (nextPalette !== null) setPlacementPiece(nextPalette);
                              }}
                            >
                              <span className="placement-cell-stack">
                                {piece ? <span className="placement-white-glyph">{WHITE_UNICODE[piece]}</span> : null}
                                {ghostBlackPiece ? (
                                  <span className="placement-ghost-black" aria-hidden>
                                    {BLACK_UNICODE[ghostBlackPiece]}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div
                      className="remove-zone"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        const raw = event.dataTransfer.getData("application/white-piece");
                        if (!raw) return;
                        const payload = JSON.parse(raw);
                        if (!payload.from) return;
                        const [fr, fc] = payload.from;
                        setWhiteLayout((current) => {
                          const next = cloneLayout(current);
                          if (!next[fr]?.[fc]) return current;
                          next[fr][fc] = null;
                          return next;
                        });
                      }}
                    >
                      Drag a placed white piece here to remove
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {mode === "advanced" ? (
            <>
              <div className="control-row">
                <label>
                  <input
                    type="checkbox"
                    checked={skipMovementCustomization}
                    onChange={(event) => setSkipMovementCustomization(event.target.checked)}
                  />
                  I dont want to customize movement
                </label>
              </div>

              {!skipMovementCustomization ? (
                <div className="control-row movement-row">
                  {piecesInPlayForMovement.map((piece) => {
                    const d = movementDrafts[piece];
                    const customLocked = d.useDefault || Boolean(d.moveAsPiece);
                    return (
                      <div
                        className={`movement-card ${piece === "king" ? "movement-card-king" : ""}`}
                        key={`movement-${piece}`}
                      >
                        <strong>{PIECE_LABELS[piece]} movement</strong>
                        {piece === "king" ? (
                          <p className="field-hint king-movement-hint">
                            Customizing the king is not recommended due to complications in ending the game (check,
                            checkmate, and king safety).
                          </p>
                        ) : null}
                        <label>
                          <input
                            type="checkbox"
                            checked={d.useDefault && !d.moveAsPiece}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              updateMovementDraft(piece, (current) =>
                                checked
                                  ? {
                                      useDefault: true,
                                      moveAsPiece: null,
                                      straight: false,
                                      cross: false,
                                      jumpSelections: [],
                                      soldierKillStraight: false
                                    }
                                  : { ...current, useDefault: false }
                              );
                            }}
                          />
                          Move as default (standard chess)
                        </label>
                        <label className="full-width copy-movement-label">
                          Copy movement from
                          <select
                            className="copy-movement-select"
                            value=""
                            onChange={(event) => {
                              const src = event.target.value;
                              event.target.value = "";
                              if (!src || src === piece) return;
                              setMovementDrafts((all) => ({
                                ...all,
                                [piece]: {
                                  useDefault: false,
                                  moveAsPiece: src,
                                  straight: false,
                                  cross: false,
                                  jumpSelections: [],
                                  soldierKillStraight: false
                                }
                              }));
                            }}
                          >
                            <option value="">Choose piece…</option>
                            {piecesInPlayForMovement
                              .filter((p) => p !== piece && p !== "pawn")
                              .map((p) => (
                                <option key={p} value={p}>
                                  {PIECE_LABELS[p]}
                                </option>
                              ))}
                          </select>
                        </label>
                        {d.moveAsPiece ? (
                          <p className="field-hint">
                            This piece uses the same movement vectors as a standard {PIECE_LABELS[d.moveAsPiece]} in
                            chess (not this piece&apos;s default).
                          </p>
                        ) : null}
                        <label>
                          <input
                            type="checkbox"
                            checked={d.straight}
                            disabled={customLocked}
                            onChange={(event) =>
                              updateMovementDraft(piece, (current) => ({
                                ...current,
                                useDefault: false,
                                moveAsPiece: null,
                                straight: event.target.checked
                              }))
                            }
                          />
                          Straight (orthogonal slide)
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={d.cross}
                            disabled={customLocked}
                            onChange={(event) =>
                              updateMovementDraft(piece, (current) => ({
                                ...current,
                                useDefault: false,
                                moveAsPiece: null,
                                cross: event.target.checked
                              }))
                            }
                          />
                          Cross (diagonal slide)
                        </label>
                        <div className="full-width jump-patterns-block">
                          <span className="jump-patterns-label">Jump patterns (m×n) — click to toggle</span>
                          <div className="jump-chip-row">
                            {JUMP_OPTIONS.map((opt) => {
                              const on = (d.jumpSelections ?? []).includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  className={`jump-pattern-chip ${on ? "jump-pattern-chip--on" : ""}`}
                                  disabled={customLocked}
                                  onClick={() =>
                                    updateMovementDraft(piece, (current) => {
                                      const cur = current.jumpSelections ?? [];
                                      const nextSel = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
                                      return {
                                        ...current,
                                        useDefault: false,
                                        moveAsPiece: null,
                                        jumpSelections: nextSel
                                      };
                                    })
                                  }
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {piece === "pawn" ? (
                          <label>
                            <input
                              type="checkbox"
                              checked={d.soldierKillStraight}
                              disabled={customLocked}
                              onChange={(event) =>
                                updateMovementDraft(piece, (current) => ({
                                  ...current,
                                  useDefault: false,
                                  moveAsPiece: null,
                                  soldierKillStraight: event.target.checked
                                }))
                              }
                            />
                            Soldier can capture straight forward
                          </label>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="safe-squares-block">
                <h4>Safe squares on the main board</h4>
                <div className="safe-picker-layout">
                  <div
                    className="safe-mini-board"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, 22px)`,
                      width: `calc(${cols} * 22px)`
                    }}
                  >
                    {Array.from({ length: rows * cols }, (_, i) => {
                      const r = Math.floor(i / cols);
                      const c = i % cols;
                      const on = safeInnerPairs.some(([a, b]) => a === r && b === c);
                      const isLight = (r + c) % 2 === 0;
                      return (
                        <button
                          key={`safe-${r}-${c}`}
                          type="button"
                          className={`safe-mini-cell ${isLight ? "light" : "dark"} ${on ? "safe-mini-cell--on" : ""}`}
                          title={`m=${r}, n=${c}${on ? " — safe" : ""}`}
                          onClick={() =>
                            setSafeInnerPairs((prev) => {
                              const has = prev.some(([a, b]) => a === r && b === c);
                              if (has) return prev.filter(([a, b]) => !(a === r && b === c));
                              return [...prev, [r, c]];
                            })
                          }
                        />
                      );
                    })}
                  </div>
                  <p className="field-hint safe-picker-hint">
                    Mini board: row <strong>m</strong> (0–{rows - 1}), column <strong>n</strong> (0–{cols - 1}). Click a
                    square to mark it safe; click again to clear. Highlights match the main inner grid; with an outside
                    border, these (m, n) still refer to inner coordinates.
                  </p>
                </div>
                <div className="control-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={outsideSafeZone}
                      onChange={(event) => setOutsideSafeZone(event.target.checked)}
                    />
                    Add one safezone layer outside board
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={safeOuterRing}
                      onChange={(event) => setSafeOuterRing(event.target.checked)}
                    />
                    Outer ring of main grid as safe area
                  </label>
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {isSetupPhase ? (
        <div className="mode-actions">
          {mode === "advanced" && !canStartGame ? (
            <p className="setup-hint">
              For each piece in use, choose &quot;Move as default&quot; or at least one custom option — or check
              &quot;I dont want to customize movement&quot;.
            </p>
          ) : null}
          {canStartGame ? (
            <button
              type="button"
              onClick={() => {
                if (whitePlacedCounts.king !== 1) {
                  setStartError("Place exactly one white king on the board before starting.");
                  return;
                }
                if (mode === "advanced" && useCombinedPlacementBoard && blackPlacedCounts.king !== 1) {
                  setStartError("Place exactly one black king on the board before starting.");
                  return;
                }
                const reason = getStartPositionBlockReason(draftSetup.customRules);
                if (reason) {
                  setStartError(reason);
                  return;
                }
                setStartError(null);
                setActiveSetup(draftSetup);
              }}
            >
              Start game
            </button>
          ) : null}
          {startError ? <p className="setup-hint setup-error">{startError}</p> : null}
          <button type="button" onClick={() => setMode(null)}>
            Back to mode selection
          </button>
        </div>
      ) : null}

      {mode === "default" || activeSetup ? (
        <Board
          setup={mode === "default" ? DEFAULT_SETUP : activeSetup}
          onBackToCustomization={
            mode !== "default" && activeSetup ? () => setActiveSetup(null) : undefined
          }
          onBackToModeSelect={
            mode !== "default" && activeSetup
              ? () => {
                  setActiveSetup(null);
                  setMode(null);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

