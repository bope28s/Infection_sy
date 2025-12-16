export type Player = 1 | 2;
export type CellState = Player | 0 | -1; // 0: Empty, -1: Wall (optional, not used in basic), 1: P1, 2: P2

export interface Position {
  r: number;
  c: number;
}

export interface Move {
  from: Position;
  to: Position;
  type: 'clone' | 'jump';
}

export interface GameState {
  board: CellState[][];
  currentPlayer: Player;
  winner: Player | 'draw' | null;
  score: {
    1: number;
    2: number;
    empty: number;
  };
  validMovesForCurrentPlayer: Move[];
  isGameOver: boolean;
  history: CellState[][][]; // For undo functionality (optional simplification)
}

export interface GameConfig {
  mode: 'AI' | 'PVP';
  difficulty: number; // 1 to 10
}