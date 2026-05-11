export default function Square({
  row,
  col,
  selected,
  highlighted,
  lastMove,
  safe,
  onClick,
  onDropMove,
  children
}) {
  const isLight = (row + col) % 2 === 0;
  return (
    <button
      type="button"
      className={[
        "square",
        isLight ? "light" : "dark",
        selected ? "selected" : "",
        highlighted ? "highlighted" : "",
        lastMove ? "last-move" : "",
        safe ? "safe" : ""
      ].join(" ")}
      onClick={onClick}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const payload = event.dataTransfer.getData("application/chess-from");
        if (!payload) return;
        const from = JSON.parse(payload);
        onDropMove(from, [row, col]);
      }}
    >
      {children}
    </button>
  );
}
