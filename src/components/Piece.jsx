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

export default function Piece({ piece, from, draggable: draggableProp = true }) {
  const glyph = PIECE_UNICODE[piece.color][piece.type];
  return (
    <span
      draggable={draggableProp}
      onDragStart={
        draggableProp
          ? (event) => {
              event.dataTransfer.setData("application/chess-from", JSON.stringify(from));
            }
          : undefined
      }
      className={`piece piece--flat piece--${piece.color} piece--${piece.type}`}
      aria-label={`${piece.color} ${piece.type}`}
    >
      <span className="piece-face" aria-hidden />
      <span className="piece-glyph">{glyph}</span>
    </span>
  );
}
