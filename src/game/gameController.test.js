import { createInitialGameState, makeMove } from "./gameController";

describe("game controller", () => {
  it("supports en passant legally", () => {
    let game = createInitialGameState();
    game = makeMove(game, [1, 4], [3, 4]); // e4
    game = makeMove(game, [6, 0], [5, 0]); // a6
    game = makeMove(game, [3, 4], [4, 4]); // e5
    game = makeMove(game, [6, 3], [4, 3]); // d5
    game = makeMove(game, [4, 4], [5, 3]); // exd6 e.p.
    expect(game.board[4][3]).toBeNull();
    expect(game.board[5][3]?.type).toBe("pawn");
  });

  it("supports castling", () => {
    let game = createInitialGameState();
    game = makeMove(game, [1, 4], [2, 4]); // e3
    game = makeMove(game, [6, 4], [5, 4]); // ...e6
    game = makeMove(game, [0, 6], [2, 5]); // Nf3
    game = makeMove(game, [7, 1], [5, 2]); // ...Nc6
    game = makeMove(game, [0, 5], [1, 4]); // Be2
    game = makeMove(game, [6, 0], [5, 0]); // ...a6
    game = makeMove(game, [0, 4], [0, 6]); // O-O

    expect(game.board[0][6]?.type).toBe("king");
    expect(game.board[0][5]?.type).toBe("rook");
  });
});
