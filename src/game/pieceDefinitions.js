export const pieceDefinitions = {
  rook: {
    directions: [
      [1, 0], [-1, 0], [0, 1], [0, -1]
    ],
    range: 8
  },

  bishop: {
    directions: [
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ],
    range: 8
  },

  queen: {
    directions: [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ],
    range: 8
  },

  king: {
    directions: [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ],
    range: 1
  },
  
  knight: {
  jumps: [
    [2, 1], [2, -1], [-2, 1], [-2, -1],
    [1, 2], [1, -2], [-1, 2], [-1, -2]
  ]
  },

  pawn: {
    steps: 1,
    doubleStepFromRank: {
      white: 1,
      black: 6
    }
  }
};