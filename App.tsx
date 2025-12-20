import React, { useState, useEffect, useCallback } from 'react';
import { GameState, GameConfig, Position, Player, Move, CellState } from './types';
import { initializeBoard, getValidMoves, executeMove, countScore, checkGameOver, getBestMove } from './services/gameLogic';
import { soundService } from './services/sound';
import Board from './components/Board';
import Character from './components/Character';
import SplashScreen from './components/SplashScreen';
import Tutorial from './components/Tutorial';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Users, Cpu, ArrowRight, Volume2, VolumeX, HelpCircle } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [loading, setLoading] = useState(true); // Splash screen state
  const [config, setConfig] = useState<GameConfig | null>(null); // Null means Main Menu
  const [showDifficultySelect, setShowDifficultySelect] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(5);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);

  const [gameState, setGameState] = useState<GameState>({
    board: [],
    currentPlayer: 1,
    winner: null,
    score: { 1: 0, 2: 0, empty: 0 },
    validMovesForCurrentPlayer: [],
    isGameOver: false,
    history: []
  });
  
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // --- Sound Toggle ---
  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    soundService.toggle(newState);
    if (newState) soundService.playClick();
  };

  // --- Initialization ---
  const prepareGame = (mode: 'AI' | 'PVP') => {
    soundService.playClick();
    if (mode === 'AI') {
      setShowDifficultySelect(true);
    } else {
      startGame('PVP', 5); // Difficulty doesn't matter for PVP
    }
  };

  const startGame = (mode: 'AI' | 'PVP', difficulty: number) => {
    const newBoard = initializeBoard();
    setGameState({
      board: newBoard,
      currentPlayer: 1, // Player 1 always starts
      winner: null,
      score: countScore(newBoard),
      validMovesForCurrentPlayer: getValidMoves(newBoard, 1),
      isGameOver: false,
      history: []
    });
    setConfig({ mode, difficulty });
    setShowDifficultySelect(false);
    setLastMove(null);
    setSelectedPos(null);
    setNotification("Game Start! Blue's Turn!");
    
    soundService.playPop();
    setTimeout(() => setNotification(null), 2000);
  };

  const returnToMenu = () => {
    soundService.playClick();
    setConfig(null);
    setShowDifficultySelect(false);
  };

  // --- Game Loop Helpers ---
  const advanceTurn = useCallback((currentBoard: CellState[][], currentPlayer: Player) => {
    const nextPlayer: Player = currentPlayer === 1 ? 2 : 1;
    let nextValidMoves = getValidMoves(currentBoard, nextPlayer);
    let nextPlayerActual: Player = nextPlayer;

    // Check pass condition
    if (nextValidMoves.length === 0) {
      // Check if game over completely
      const check = checkGameOver(currentBoard);
      if (check.isOver) {
        soundService.playWin(); 
        setGameState(prev => ({
          ...prev,
          board: currentBoard,
          isGameOver: true,
          winner: check.winner,
          score: countScore(currentBoard)
        }));
        return;
      }

      // If not game over but no moves, pass turn back to original player
      setNotification(`Player ${nextPlayer === 1 ? 'Blue' : 'Red'} has no moves! Skipped.`);
      setTimeout(() => setNotification(null), 2500);

      nextPlayerActual = currentPlayer; // Stay on current
      nextValidMoves = getValidMoves(currentBoard, currentPlayer);

      // Check if original player is ALSO stuck (Game Over)
      if (nextValidMoves.length === 0) {
        const finalScore = countScore(currentBoard);
        const winner = finalScore[1] > finalScore[2] ? 1 : finalScore[1] < finalScore[2] ? 2 : 'draw';
        soundService.playWin();
        setGameState(prev => ({
          ...prev,
          board: currentBoard,
          isGameOver: true,
          winner: winner,
          score: finalScore
        }));
        return;
      }
    }

    setGameState(prev => ({
      ...prev,
      board: currentBoard,
      currentPlayer: nextPlayerActual,
      validMovesForCurrentPlayer: nextValidMoves,
      score: countScore(currentBoard)
    }));

  }, []);

  const handleMove = useCallback((move: Move) => {
    const newBoard = executeMove(gameState.board, move, gameState.currentPlayer);
    setLastMove(move);
    setSelectedPos(null);
    
    // SFX based on move type
    if (move.type === 'jump') {
      soundService.playJump();
    } else {
      soundService.playPop();
    }
    
    // Play infect sound slightly delayed
    setTimeout(() => soundService.playInfect(), 150);
    
    // Update State
    advanceTurn(newBoard, gameState.currentPlayer);
  }, [gameState.board, gameState.currentPlayer, advanceTurn]);


  // --- AI Logic ---
  useEffect(() => {
    if (config?.mode === 'AI' && gameState.currentPlayer === 2 && !gameState.isGameOver) {
      const timer = setTimeout(() => {
        const difficulty = config.difficulty || 5;
        const bestMove = getBestMove(gameState.board, 2, difficulty);
        if (bestMove) {
          handleMove(bestMove);
        } else {
          advanceTurn(gameState.board, 2); 
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [config, gameState.currentPlayer, gameState.isGameOver, gameState.board, handleMove, advanceTurn]);


  // --- User Interaction ---
  const onCellClick = (pos: Position) => {
    if (gameState.isGameOver) return;
    if (config?.mode === 'AI' && gameState.currentPlayer === 2) return; // AI Turn

    const cellContent = gameState.board[pos.r][pos.c];

    // 1. Select own piece
    if (cellContent === gameState.currentPlayer) {
      soundService.playClick();
      if (selectedPos?.r === pos.r && selectedPos?.c === pos.c) {
        setSelectedPos(null);
      } else {
        setSelectedPos(pos);
      }
      return;
    }

    // 2. Move to empty square
    if (selectedPos && cellContent === 0) {
      const validMove = gameState.validMovesForCurrentPlayer.find(
        m => m.from.r === selectedPos.r && m.from.c === selectedPos.c && m.to.r === pos.r && m.to.c === pos.c
      );

      if (validMove) {
        handleMove(validMove);
      } else {
        soundService.playClick();
        setSelectedPos(null);
      }
    }
  };


  // --- Renders ---
  
  // Splash Screen
  if (loading) {
    return <SplashScreen onFinish={() => setLoading(false)} />;
  }

  // Main Menu
  if (!config) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 to-indigo-200 flex items-center justify-center p-4 overflow-hidden">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-white relative z-10"
        >
          {/* Sound Toggle Button (Menu) */}
          <button 
            onClick={toggleSound}
            className="absolute top-4 right-4 z-20 bg-slate-100 hover:bg-slate-200 p-2 rounded-full text-slate-500 transition-colors"
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          {/* Tutorial Button (Menu) */}
          <button 
            onClick={() => {
              soundService.playClick();
              setShowTutorial(true);
            }}
            className="absolute top-4 left-4 z-20 bg-indigo-100 hover:bg-indigo-200 p-2 rounded-full text-indigo-600 transition-colors"
            title="튜토리얼 보기"
          >
            <HelpCircle size={20} />
          </button>

          {/* Clean Header Section */}
          <div className="pt-16 pb-8 px-4 text-center">
            <h1 className="text-4xl font-black text-slate-800 tracking-wider leading-none mb-2">
              SUPER<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-rose-500 text-5xl inline-block mt-1">GERM</span><br/>
              BATTLE
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
              Strategy Board Game
            </p>
          </div>

          <div className="p-8 pt-0 bg-white">
            <AnimatePresence mode="wait">
              {!showDifficultySelect ? (
                <motion.div 
                  key="menu"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <button 
                    onClick={() => prepareGame('AI')}
                    className="w-full group relative overflow-hidden bg-slate-50 border-b-4 border-slate-200 hover:border-cyan-400 p-4 rounded-2xl flex items-center transition-all hover:bg-white hover:shadow-lg hover:-translate-y-1 active:translate-y-0 active:shadow-none active:border-b-0 active:mt-1 active:mb-[-1px]"
                  >
                    <div className="bg-cyan-100 p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform">
                      <Cpu className="w-8 h-8 text-cyan-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-black text-slate-800 text-lg">VS COMPUTER</h3>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Challenge the AI</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => prepareGame('PVP')}
                    className="w-full group relative overflow-hidden bg-slate-50 border-b-4 border-slate-200 hover:border-rose-400 p-4 rounded-2xl flex items-center transition-all hover:bg-white hover:shadow-lg hover:-translate-y-1 active:translate-y-0 active:shadow-none active:border-b-0 active:mt-1 active:mb-[-1px]"
                  >
                    <div className="bg-rose-100 p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform">
                      <Users className="w-8 h-8 text-rose-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-black text-slate-800 text-lg">VS FRIEND</h3>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">2 Player Mode</p>
                    </div>
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="difficulty"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <h3 className="text-xl font-black text-slate-800 mb-1">SELECT LEVEL</h3>
                    <div className="inline-block bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold">
                      DIFFICULTY: {selectedDifficulty}
                    </div>
                  </div>

                  <div className="px-2">
                    <div className="relative h-12 flex items-center">
                       <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        step="1"
                        value={selectedDifficulty}
                        onChange={(e) => {
                          setSelectedDifficulty(parseInt(e.target.value));
                          soundService.playClick();
                        }}
                        className="w-full h-4 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-600 z-10 relative"
                      />
                      {/* Ticks */}
                      <div className="absolute top-1/2 left-0 w-full flex justify-between px-1 -translate-y-1/2 pointer-events-none">
                        {[...Array(10)].map((_, i) => (
                          <div key={i} className={`w-1 h-1 rounded-full ${i + 1 <= selectedDifficulty ? 'bg-indigo-300' : 'bg-slate-300'}`}></div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">
                      <span>Toddler</span>
                      <span>Kid</span>
                      <span>Genius</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={() => startGame('AI', selectedDifficulty)}
                      className="w-full bg-indigo-500 text-white font-black py-4 rounded-xl shadow-[0_4px_0_0_#4338ca] hover:bg-indigo-600 hover:shadow-[0_2px_0_0_#4338ca] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all text-lg"
                    >
                      START BATTLE!
                    </button>
                    <button 
                      onClick={() => setShowDifficultySelect(false)}
                      className="w-full text-slate-400 font-bold py-2 hover:text-slate-600 text-sm"
                    >
                      GO BACK
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }

  // Game UI
  return (
    <div className="min-h-screen bg-slate-50 sm:py-4 flex flex-col items-center justify-center font-sans select-none overflow-hidden">
      
      {/* Header / Scoreboard */}
      <div className="w-full max-w-2xl px-4 mb-4">
        <div className="flex justify-between items-center bg-white p-3 sm:p-4 rounded-2xl shadow-lg border border-slate-100 relative">
          
          {/* Sound Toggle (In-Game) */}
          <button 
             onClick={toggleSound}
             className="absolute -top-10 right-0 sm:top-1/2 sm:-right-12 sm:-translate-y-1/2 bg-white/80 p-2 rounded-full text-slate-500 hover:bg-white hover:text-indigo-600 shadow-sm transition-all"
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          {/* Tutorial Button (In-Game) */}
          <button 
             onClick={() => {
               soundService.playClick();
               setShowTutorial(true);
             }}
             className="absolute -top-10 right-12 sm:top-1/2 sm:-right-24 sm:-translate-y-1/2 bg-indigo-100 p-2 rounded-full text-indigo-600 hover:bg-indigo-200 shadow-sm transition-all"
             title="튜토리얼 보기"
          >
            <HelpCircle size={20} />
          </button>

          {/* Player 1 Score */}
          <div className={`flex items-center gap-3 transition-opacity ${gameState.currentPlayer === 1 ? 'opacity-100' : 'opacity-60'}`}>
            <div className="relative w-12 h-12 sm:w-16 sm:h-16">
               <Character player={1} />
               {gameState.currentPlayer === 1 && (
                 <motion.div 
                   layoutId="active-turn"
                   className="absolute -inset-2 border-4 border-cyan-400 rounded-full"
                   transition={{ type: "spring" }}
                 />
               )}
            </div>
            <div>
              <p className="text-xs sm:text-sm text-slate-400 font-bold uppercase tracking-wider">Blue Team</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-800">{gameState.score[1]}</p>
            </div>
          </div>

          {/* VS Badge */}
          <div className="hidden sm:flex flex-col items-center">
            <div className="font-black text-slate-200 text-2xl">VS</div>
            <div className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full mt-1">
              {config.mode === 'AI' ? `Level ${config.difficulty}` : '2 Player'}
            </div>
          </div>

          {/* Player 2 Score */}
          <div className={`flex items-center gap-3 flex-row-reverse text-right transition-opacity ${gameState.currentPlayer === 2 ? 'opacity-100' : 'opacity-60'}`}>
            <div className="relative w-12 h-12 sm:w-16 sm:h-16">
               <Character player={2} />
               {gameState.currentPlayer === 2 && (
                 <motion.div 
                   layoutId="active-turn"
                   className="absolute -inset-2 border-4 border-rose-400 rounded-full"
                   transition={{ type: "spring" }}
                 />
               )}
            </div>
            <div>
              <p className="text-xs sm:text-sm text-slate-400 font-bold uppercase tracking-wider">
                {config.mode === 'AI' ? 'Robot Team' : 'Red Team'}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-slate-800">{gameState.score[2]}</p>
            </div>
          </div>

        </div>
      </div>

      {/* Main Game Board Area */}
      <div className="w-full max-w-lg px-2 sm:px-4 mb-4 relative z-0">
        <Board 
          board={gameState.board}
          selectedPos={selectedPos}
          validMoves={gameState.validMovesForCurrentPlayer}
          onCellClick={onCellClick}
          lastMove={lastMove}
        />
      </div>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-24 sm:bottom-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-50 font-bold text-center w-max max-w-[90%]"
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Controls */}
      <div className="w-full max-w-2xl px-4 flex justify-between items-center pb-safe">
        <button 
          onClick={returnToMenu}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold px-4 py-2 rounded-xl hover:bg-slate-200 transition-colors"
        >
          <ArrowRight className="w-5 h-5 rotate-180" />
          Exit
        </button>

        <button 
          onClick={() => startGame(config.mode, config.difficulty)}
          className="flex items-center gap-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold px-4 py-2 rounded-xl transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Restart
        </button>
      </div>

      {/* Tutorial Modal */}
      {showTutorial && (
        <Tutorial onClose={() => {
          soundService.playClick();
          setShowTutorial(false);
        }} />
      )}

      {/* Game Over Modal */}
      <AnimatePresence>
        {gameState.isGameOver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0, rotateY: -90 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border-4 border-indigo-300 relative overflow-hidden"
            >
              {/* Animated background effects */}
              <motion.div
                className="absolute inset-0 opacity-10"
                animate={{
                  background: gameState.winner === 1 
                    ? 'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.3) 0%, transparent 70%)'
                    : gameState.winner === 2
                    ? 'radial-gradient(circle at 50% 50%, rgba(244, 63, 94, 0.3) 0%, transparent 70%)'
                    : 'radial-gradient(circle at 50% 50%, rgba(148, 163, 184, 0.3) 0%, transparent 70%)'
                }}
              />
              
              {/* Confetti effect */}
              {gameState.winner !== 'draw' && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      className={`absolute w-2 h-2 rounded-full ${
                        gameState.winner === 1 ? 'bg-cyan-400' : 'bg-rose-400'
                      }`}
                      initial={{
                        x: '50%',
                        y: '50%',
                        opacity: 1,
                        scale: 1
                      }}
                      animate={{
                        x: `${Math.random() * 100}%`,
                        y: `${Math.random() * 100 + 50}%`,
                        opacity: 0,
                        scale: 0
                      }}
                      transition={{
                        duration: 2,
                        delay: Math.random() * 0.5,
                        ease: "easeOut"
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="relative z-10">
                {/* Winner Character with animation */}
                <motion.div 
                  className="mb-6 flex justify-center"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  {gameState.winner === 'draw' ? (
                    <motion.div 
                      className="w-32 h-32 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center shadow-lg"
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 3 }}
                    >
                      <Users className="w-16 h-16 text-slate-500" />
                    </motion.div>
                  ) : (
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ 
                        scale: { repeat: Infinity, duration: 2 },
                        rotate: { repeat: Infinity, duration: 3 }
                      }}
                      className="scale-150"
                    >
                      <Character player={gameState.winner as Player} />
                    </motion.div>
                  )}
                </motion.div>
                
                {/* Winner Title with animation */}
                <motion.h2 
                  className="text-4xl font-black mb-4"
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  style={{
                    background: gameState.winner === 1
                      ? 'linear-gradient(to right, #06b6d4, #0891b2)'
                      : gameState.winner === 2
                      ? 'linear-gradient(to right, #f43f5e, #e11d48)'
                      : 'linear-gradient(to right, #64748b, #475569)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  {gameState.winner === 'draw' ? '무승부!' : 
                   gameState.winner === 1 ? '블루 팀 승리!' : '레드 팀 승리!'}
                </motion.h2>
                
                {/* Score Display */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="mb-8"
                >
                  <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-2xl p-6 border-2 border-indigo-200">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
                      최종 점수
                    </p>
                    <div className="flex items-center justify-center gap-8">
                      {/* Player 1 Score */}
                      <div className={`text-center transition-all ${
                        gameState.winner === 1 ? 'scale-110' : ''
                      }`}>
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <div className="w-8 h-8">
                            <Character player={1} />
                          </div>
                          <span className="text-xs font-bold text-slate-500">블루</span>
                        </div>
                        <motion.div
                          className={`text-4xl font-black ${
                            gameState.winner === 1 ? 'text-cyan-600' : 'text-slate-700'
                          }`}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.9, type: "spring" }}
                        >
                          {gameState.score[1]}
                        </motion.div>
                      </div>

                      {/* VS */}
                      <div className="text-2xl font-black text-slate-300">VS</div>

                      {/* Player 2 Score */}
                      <div className={`text-center transition-all ${
                        gameState.winner === 2 ? 'scale-110' : ''
                      }`}>
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <div className="w-8 h-8">
                            <Character player={2} />
                          </div>
                          <span className="text-xs font-bold text-slate-500">
                            {config.mode === 'AI' ? 'AI' : '레드'}
                          </span>
                        </div>
                        <motion.div
                          className={`text-4xl font-black ${
                            gameState.winner === 2 ? 'text-rose-600' : 'text-slate-700'
                          }`}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.9, type: "spring" }}
                        >
                          {gameState.score[2]}
                        </motion.div>
                      </div>
                    </div>
                    
                    {/* Winner highlight */}
                    {gameState.winner !== 'draw' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.1 }}
                        className="mt-4 pt-4 border-t-2 border-slate-200"
                      >
                        <p className="text-sm font-bold text-slate-600">
                          <span className={`${
                            gameState.winner === 1 ? 'text-cyan-600' : 'text-rose-600'
                          }`}>
                            {gameState.winner === 1 ? '블루' : config.mode === 'AI' ? 'AI' : '레드'} 팀
                          </span>
                          이 {gameState.score[gameState.winner as Player]}개 칸을 점령했습니다!
                        </p>
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="space-y-3"
                >
                  <button 
                    onClick={() => startGame(config.mode, config.difficulty)}
                    className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 hover:scale-105 active:scale-100 transition-all text-lg"
                  >
                    다시 하기
                  </button>
                  <button 
                    onClick={returnToMenu}
                    className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    메뉴로 돌아가기
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default App;