/**
 * {{GAME_TITLE}} — Match-3 Engine
 *
 * Core puzzle logic: board generation, swap validation,
 * match detection, cascade resolution, and scoring.
 */

import type {
  Match3GameState,
  GemType,
  Match3Move,
  MatchGroup,
} from "../types";

const GEM_TYPES: GemType[] = ["fire", "water", "earth", "air", "light", "dark"];
const BOARD_SIZE = 8;
const INITIAL_MOVES = 30;

export class Match3Engine {
  /** Create a new game board with no initial matches */
  createGame(level: number = 1): Match3GameState {
    const board = this.generateBoard();
    return {
      board,
      score: 0,
      movesLeft: INITIAL_MOVES + Math.floor(level / 3) * 5,
      level,
      combo: 0,
      maxCombo: 0,
      startedAt: Date.now(),
      isGameOver: false,
    };
  }

  /** Attempt a swap move */
  makeMove(
    game: Match3GameState,
    move: Match3Move,
  ): {
    game: Match3GameState;
    matches: MatchGroup[];
    valid: boolean;
  } {
    const { fromX, fromY, toX, toY } = move;

    // Validate adjacency
    const dx = Math.abs(fromX - toX);
    const dy = Math.abs(fromY - toY);
    if (dx + dy !== 1) {
      return { game, matches: [], valid: false };
    }

    // Validate bounds
    if (!this.inBounds(fromX, fromY) || !this.inBounds(toX, toY)) {
      return { game, matches: [], valid: false };
    }

    // Perform swap
    const board = game.board.map((row) => [...row]);
    const temp = board[fromY][fromX];
    board[fromY][fromX] = board[toY][toX];
    board[toY][toX] = temp;

    // Check for matches
    const matches = this.findMatches(board);
    if (matches.length === 0) {
      // Invalid move — no matches
      return { game, matches: [], valid: false };
    }

    // Apply matches and cascades
    let totalPoints = 0;
    let combo = 0;
    let currentBoard = board;
    let allMatches: MatchGroup[] = [];

    while (true) {
      const roundMatches = this.findMatches(currentBoard);
      if (roundMatches.length === 0) break;

      combo++;
      allMatches = allMatches.concat(roundMatches);

      // Remove matched gems
      for (const match of roundMatches) {
        const comboMultiplier = Math.min(combo, 5);
        totalPoints += match.points * comboMultiplier;
        for (const gem of match.gems) {
          currentBoard[gem.y][gem.x] = null;
        }
      }

      // Gravity: drop gems down
      currentBoard = this.applyGravity(currentBoard);

      // Fill empty spots
      currentBoard = this.fillBoard(currentBoard);
    }

    const newGame: Match3GameState = {
      ...game,
      board: currentBoard,
      score: game.score + totalPoints,
      movesLeft: game.movesLeft - 1,
      combo,
      maxCombo: Math.max(game.maxCombo, combo),
      isGameOver: game.movesLeft - 1 <= 0,
    };

    return { game: newGame, matches: allMatches, valid: true };
  }

  /** Find all matches of 3+ on the board */
  findMatches(board: (GemType | null)[][]): MatchGroup[] {
    const matches: MatchGroup[] = [];
    const matched = new Set<string>();

    // Horizontal matches
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE - 2; x++) {
        const gem = board[y][x];
        if (!gem) continue;
        if (gem === board[y][x + 1] && gem === board[y][x + 2]) {
          const group: { x: number; y: number }[] = [];
          let end = x;
          while (end < BOARD_SIZE && board[y][end] === gem) {
            const key = `${end},${y}`;
            if (!matched.has(key)) group.push({ x: end, y });
            matched.add(key);
            end++;
          }
          if (group.length >= 3) {
            matches.push({ gems: group, type: gem, points: group.length * 10 });
          }
          x = end - 1;
        }
      }
    }

    // Vertical matches
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE - 2; y++) {
        const gem = board[y][x];
        if (!gem) continue;
        if (gem === board[y + 1][x] && gem === board[y + 2][x]) {
          const group: { x: number; y: number }[] = [];
          let end = y;
          while (end < BOARD_SIZE && board[end][x] === gem) {
            const key = `${x},${end}`;
            if (!matched.has(key)) group.push({ x, y: end });
            matched.add(key);
            end++;
          }
          if (group.length >= 3) {
            matches.push({ gems: group, type: gem, points: group.length * 10 });
          }
          y = end - 1;
        }
      }
    }

    return matches;
  }

  /** Generate a board with no initial matches */
  private generateBoard(): GemType[][] {
    const board: GemType[][] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      board[y] = [];
      for (let x = 0; x < BOARD_SIZE; x++) {
        let gem: GemType;
        do {
          gem = GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
        } while (this.wouldMatch(board, x, y, gem));
        board[y][x] = gem;
      }
    }
    return board;
  }

  /** Check if placing a gem would create a match */
  private wouldMatch(
    board: (GemType | null)[][],
    x: number,
    y: number,
    gem: GemType,
  ): boolean {
    // Check horizontal
    if (x >= 2 && board[y][x - 1] === gem && board[y][x - 2] === gem)
      return true;
    // Check vertical
    if (y >= 2 && board[y - 1]?.[x] === gem && board[y - 2]?.[x] === gem)
      return true;
    return false;
  }

  /** Apply gravity to make gems fall down */
  private applyGravity(board: (GemType | null)[][]): (GemType | null)[][] {
    const newBoard = board.map((row) => [...row]);
    for (let x = 0; x < BOARD_SIZE; x++) {
      let writeY = BOARD_SIZE - 1;
      for (let y = BOARD_SIZE - 1; y >= 0; y--) {
        if (newBoard[y][x] !== null) {
          newBoard[writeY][x] = newBoard[y][x];
          if (writeY !== y) newBoard[y][x] = null;
          writeY--;
        }
      }
      for (let y = writeY; y >= 0; y--) {
        newBoard[y][x] = null;
      }
    }
    return newBoard;
  }

  /** Fill null spots with new random gems */
  private fillBoard(board: (GemType | null)[][]): GemType[][] {
    return board.map((row) =>
      row.map(
        (gem) => gem ?? GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)],
      ),
    ) as GemType[][];
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
  }
}
