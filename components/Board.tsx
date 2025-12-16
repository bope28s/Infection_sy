import React from 'react';
import { CellState, Move, Player, Position } from '../types';
import Character from './Character';
import { motion, AnimatePresence } from 'framer-motion';

interface BoardProps {
  board: CellState[][];
  // currentPlayer: Player; // Removed as it was unused
  selectedPos: Position | null;
  validMoves: Move[];
  onCellClick: (pos: Position) => void;
  lastMove: Move | null;
}

const Board: React.FC<BoardProps> = ({ 
  board, 
  // currentPlayer, // Removed
  selectedPos, 
  validMoves, 
  onCellClick,
  lastMove
}) => {
  
  const getMoveTypeForCell = (r: number, c: number): 'clone' | 'jump' | null => {
    if (!selectedPos) return null;
    const move = validMoves.find(m => m.from.r === selectedPos.r && m.from.c === selectedPos.c && m.to.r === r && m.to.c === c);
    return move ? move.type : null;
  };

  return (
    <div className="relative p-2 bg-indigo-900/40 rounded-xl shadow-2xl backdrop-blur-sm border-4 border-indigo-300/30">
      <div 
        className="grid gap-1 sm:gap-2"
        style={{ 
          gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))` 
        }}
      >
        {board.map((row, r) => (
          row.map((cellState, c) => {
            const isSelected = selectedPos?.r === r && selectedPos?.c === c;
            const moveType = getMoveTypeForCell(r, c);
            const isLastMoveTarget = lastMove?.to.r === r && lastMove?.to.c === c;

            // Highlight possible moves
            const isCloneTarget = moveType === 'clone';
            const isJumpTarget = moveType === 'jump';

            return (
              <div 
                key={`${r}-${c}`}
                onClick={() => onCellClick({ r, c })}
                className={`
                  aspect-square rounded-lg sm:rounded-xl relative cursor-pointer
                  transition-all duration-200 border-b-4
                  ${(r + c) % 2 === 0 ? 'bg-indigo-100 border-indigo-200' : 'bg-white border-slate-200'}
                  ${isSelected ? 'ring-4 ring-yellow-400 z-10 scale-105' : ''}
                  ${isCloneTarget ? 'ring-4 ring-green-400 bg-green-50' : ''}
                  ${isJumpTarget ? 'ring-4 ring-yellow-400 bg-yellow-50' : ''}
                  hover:brightness-95
                `}
              >
                {/* Move Hint Indicators */}
                {isCloneTarget && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-40">
                     <div className="w-[80%] h-[80%] border-2 border-dashed border-green-500 rounded-full animate-pulse"></div>
                  </div>
                )}
                {isJumpTarget && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-40">
                    <div className="w-[80%] h-[80%] border-2 border-dashed border-yellow-500 rounded-full animate-pulse"></div>
                  </div>
                )}
                
                {/* Last Move Indicator (Target) */}
                {isLastMoveTarget && (
                  <div className="absolute inset-0 bg-yellow-200/30 rounded-lg animate-ping-slow pointer-events-none"></div>
                )}

                <div className="w-full h-full flex items-center justify-center">
                  <AnimatePresence mode="popLayout">
                    {cellState !== 0 && cellState !== -1 && (
                      <motion.div
                        key={`${r}-${c}-${cellState}`} 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="w-full h-full flex items-center justify-center"
                      >
                         <Character 
                            player={cellState as Player} 
                            isSelected={isSelected}
                            isNew={isLastMoveTarget}
                         />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
};

export default Board;
