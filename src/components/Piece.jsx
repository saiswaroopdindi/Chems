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

export default function Piece({ piece, from }) {
  return (
    <span
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/chess-from", JSON.stringify(from));
      }}
      className="piece"
      aria-label={`${piece.color} ${piece.type}`}
    >
      {PIECE_UNICODE[piece.color][piece.type]}
    </span>
  );
}

