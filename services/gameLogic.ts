import { CellState, Move, Player } from '../types';

export const BOARD_SIZE = 7;

// Initialize a standard Ataxx board (P1 Top-Left/Bottom-Right)
export const initializeBoard = (): CellState[][] => {
  const board: CellState[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
  
  // Standard Cross Setup
  board[0][0] = 1;
  board[BOARD_SIZE - 1][BOARD_SIZE - 1] = 1;
  
  board[0][BOARD_SIZE - 1] = 2;
  board[BOARD_SIZE - 1][0] = 2;

  return board;
};

// Check if a position is within board bounds
const isValidPos = (r: number, c: number) => {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
};

// Calculate all valid moves for a specific player
export const getValidMoves = (board: CellState[][], player: Player): Move[] => {
  const moves: Move[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === player) {
        // Check range -2 to +2
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (dr === 0 && dc === 0) continue;

            const nr = r + dr;
            const nc = c + dc;

            if (isValidPos(nr, nc) && board[nr][nc] === 0) {
              const dist = Math.max(Math.abs(dr), Math.abs(dc));
              moves.push({
                from: { r, c },
                to: { r: nr, c: nc },
                type: dist === 1 ? 'clone' : 'jump'
              });
            }
          }
        }
      }
    }
  }
  return moves;
};

// Execute a move and return the new board state
export const executeMove = (board: CellState[][], move: Move, player: Player): CellState[][] => {
  const newBoard = board.map(row => [...row]);
  
  // 1. Place the piece
  newBoard[move.to.r][move.to.c] = player;

  // 2. Handle Jump (remove original)
  if (move.type === 'jump') {
    newBoard[move.from.r][move.from.c] = 0;
  }

  // 3. Infect neighbors
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = move.to.r + dr;
      const nc = move.to.c + dc;

      if (isValidPos(nr, nc)) {
        const cell = newBoard[nr][nc];
        // If it's an opponent (not empty, not wall, not self)
        if (cell !== 0 && cell !== -1 && cell !== player) {
          newBoard[nr][nc] = player;
        }
      }
    }
  }

  return newBoard;
};

// Count scores
export const countScore = (board: CellState[][]) => {
  let p1 = 0;
  let p2 = 0;
  let empty = 0;
  board.forEach(row => row.forEach(cell => {
    if (cell === 1) p1++;
    if (cell === 2) p2++;
    if (cell === 0) empty++;
  }));
  return { 1: p1, 2: p2, empty };
};

// --- Advanced AI Implementation ---

// Heuristic Evaluation
const evaluateBoard = (board: CellState[][], player: Player): number => {
  const scores = countScore(board);
  const opponent = player === 1 ? 2 : 1;
  
  if (scores[opponent] === 0) return 10000; // Win
  if (scores[player] === 0) return -10000; // Lose

  // Basic Score Difference
  let score = scores[player] - scores[opponent];

  // Optional: Add mobility bonus (computationally expensive, maybe only for high levels)
  // For now, raw piece count is the strongest metric in Ataxx
  return score;
};

// Minimax with Alpha-Beta Pruning
const minimax = (
  board: CellState[][], 
  depth: number, 
  alpha: number, 
  beta: number, 
  maximizingPlayer: boolean,
  activePlayer: Player
): number => {
  const opponent = activePlayer === 1 ? 2 : 1;
  
  // Terminal conditions
  if (depth === 0) {
    return evaluateBoard(board, activePlayer);
  }

  const currentPlayerForTurn = maximizingPlayer ? activePlayer : opponent;
  const moves = getValidMoves(board, currentPlayerForTurn);

  if (moves.length === 0) {
    // If no moves, pass turn. If both no moves, game over.
    // Simplifying recursion: just evaluate here for performance in JS
    return evaluateBoard(board, activePlayer); 
  }

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    // Optimization: limit branching factor for speed if needed, or sort moves
    for (const move of moves) {
      const newBoard = executeMove(board, move, activePlayer);
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, false, activePlayer);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newBoard = executeMove(board, move, opponent);
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, true, activePlayer);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

export const getBestMove = (board: CellState[][], player: Player, difficulty: number = 5): Move | null => {
  const possibleMoves = getValidMoves(board, player);
  if (possibleMoves.length === 0) return null;

  // Level 1-2: Very High Randomness (Toddler mode)
  // Level 3-4: Greedy with Randomness (Easy)
  // Level 5-6: Pure Greedy (Medium)
  // Level 7-8: Minimax Depth 2 (Hard)
  // Level 9-10: Minimax Depth 2 + Full Evaluation (Expert)

  const randomnessChance = Math.max(0, (3 - difficulty) * 0.3); // Lv1: 60%, Lv2: 30%, Lv3+: 0%
  
  // 1. Random Move (Make mistakes intentionally)
  if (Math.random() < randomnessChance) {
    return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
  }

  // 2. Strategy Selection
  if (difficulty <= 6) {
    // Greedy Strategy (1-ply lookahead)
    // For levels 4-6, it's consistent. For 3, randomness handled above covers it.
    let bestMove: Move | null = null;
    let bestScoreDiff = -Infinity;

    // Shuffle to avoid predictable patterns on equal scores
    possibleMoves.sort(() => Math.random() - 0.5);

    for (const move of possibleMoves) {
      const nextBoard = executeMove(board, move, player);
      const score = countScore(nextBoard);
      const scoreDiff = score[player] - score[player === 1 ? 2 : 1];

      if (scoreDiff > bestScoreDiff) {
        bestScoreDiff = scoreDiff;
        bestMove = move;
      }
    }
    return bestMove;

  } else {
    // Minimax Strategy (Look ahead)
    // Depth 2 is solid for Ataxx (My move -> Opponent's best response)
    const depth = 2; 
    let bestMove: Move | null = null;
    let maxEval = -Infinity;

    // Optimization: Sort moves by simple heuristic first to improve pruning?
    // For now, random shuffle helps variety
    possibleMoves.sort(() => Math.random() - 0.5);

    for (const move of possibleMoves) {
      const nextBoard = executeMove(board, move, player);
      // We made a move, now minimize opponent's outcome
      const evalScore = minimax(nextBoard, depth - 1, -Infinity, Infinity, false, player);

      if (evalScore > maxEval) {
        maxEval = evalScore;
        bestMove = move;
      }
    }
    return bestMove;
  }
};

export const checkGameOver = (board: CellState[][]): { isOver: boolean, winner: Player | 'draw' | null } => {
  const scores = countScore(board);

  if (scores[1] === 0) return { isOver: true, winner: 2 };
  if (scores[2] === 0) return { isOver: true, winner: 1 };
  if (scores.empty === 0) {
    if (scores[1] > scores[2]) return { isOver: true, winner: 1 };
    if (scores[2] > scores[1]) return { isOver: true, winner: 2 };
    return { isOver: true, winner: 'draw' };
  }
  
  return { isOver: false, winner: null };
};