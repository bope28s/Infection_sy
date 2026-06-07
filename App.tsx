import React, { useState, useEffect, useCallback } from 'react';
import { GameState, GameConfig, Position, Player, Move, CellState } from './types';
import { initializeBoard, getValidMoves, executeMove, countScore, checkGameOver, getBestMove } from './services/gameLogic';
import { soundService } from './services/sound';
import { getOrCreatePlayer, savePVPMatch, saveAIMatch, PlayerRecord, MatchRoom, getOrCreateOnlineGame, updateOnlineGame, subscribeToOnlineGame, getPlayerNickname, subscribeToMatchRoom, leaveMatchRoom, getPlayerRank, logoutPlayer, getPlayerLevel, setPlayerReady } from './services/backend';
import { supabase } from './lib/supabase';
import Board from './components/Board';
import Character from './components/Character';
import SplashScreen from './components/SplashScreen';
import Tutorial from './components/Tutorial';
import Ranking from './components/Ranking';
import MatchRoomComponent from './components/MatchRoom';
import GameReadyScreen from './components/GameReadyScreen';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Users, Cpu, ArrowRight, Volume2, VolumeX, HelpCircle, Trophy } from 'lucide-react';

// 개발 모드에서만 로깅 활성화
const isDev = process.env.NODE_ENV === 'development';
const debugLog = (...args: any[]) => {
  if (isDev) {
    console.log(...args);
  }
};

// 빠른 보드 비교 함수 (JSON.stringify 대신 사용)
const boardsEqual = (board1: CellState[][], board2: CellState[][]): boolean => {
  if (!board1 || !board2) return board1 === board2;
  if (board1.length !== board2.length) return false;
  for (let i = 0; i < board1.length; i++) {
    if (board1[i].length !== board2[i].length) return false;
    for (let j = 0; j < board1[i].length; j++) {
      if (board1[i][j] !== board2[i][j]) return false;
    }
  }
  return true;
};

const App: React.FC = () => {
  // --- State ---
  const [loading, setLoading] = useState(true); // Splash screen state
  const [currentPlayer, setCurrentPlayer] = useState<PlayerRecord | null>(null); // 현재 플레이어
  const [showNicknameInput, setShowNicknameInput] = useState(true); // 닉네임 입력 모달
  const [config, setConfig] = useState<GameConfig | null>(null); // Null means Main Menu
  const [showDifficultySelect, setShowDifficultySelect] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(5);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [showMatchRoom, setShowMatchRoom] = useState(false);
  const [showReadyScreen, setShowReadyScreen] = useState(false);
  const [currentMatchRoom, setCurrentMatchRoom] = useState<MatchRoom | null>(null);

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
  const [player1Nickname, setPlayer1Nickname] = useState<string | null>(null);
  const [player2Nickname, setPlayer2Nickname] = useState<string | null>(null);
  const [player1Rank, setPlayer1Rank] = useState<number | null>(null);
  const [player2Rank, setPlayer2Rank] = useState<number | null>(null);
  const [player1Level, setPlayer1Level] = useState<number | null>(null);
  const [player2Level, setPlayer2Level] = useState<number | null>(null);
  const [, setTurnTimer] = useState<number>(20); // 온라인 대전 턴 타이머 (현재 턴인 플레이어)
  const [player1Timer, setPlayer1Timer] = useState<number>(20); // 플레이어1 타이머
  const [player2Timer, setPlayer2Timer] = useState<number>(20); // 플레이어2 타이머
  const [gameInitialized, setGameInitialized] = useState<boolean>(false); // 게임이 초기화되었는지 확인
  const [, setOpponentLeft] = useState<boolean>(false); // 상대방이 나갔는지 확인
  
  // 최신 currentMatchRoom 상태를 참조하기 위한 ref
  const currentMatchRoomRef = React.useRef<MatchRoom | null>(null);
  
  // 최신 gameInitialized 상태를 참조하기 위한 ref
  const gameInitializedRef = React.useRef<boolean>(false);
  
  // 최신 player2Nickname 상태를 참조하기 위한 ref
  const player2NicknameRef = React.useRef<string | null>(null);
  
  // 타이머 ref (중복 실행 방지)
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // 최신 gameState를 참조하기 위한 ref
  const gameStateRef = React.useRef<GameState>(gameState);
  
  // currentMatchRoom이 변경될 때마다 ref 업데이트
  React.useEffect(() => {
    currentMatchRoomRef.current = currentMatchRoom;
  }, [currentMatchRoom]);

  // gameInitialized가 변경될 때마다 ref 업데이트
  React.useEffect(() => {
    gameInitializedRef.current = gameInitialized;
  }, [gameInitialized]);

  // player2Nickname이 변경될 때마다 ref 업데이트
  React.useEffect(() => {
    player2NicknameRef.current = player2Nickname;
  }, [player2Nickname]);
  
  // gameState가 변경될 때마다 ref 업데이트
  React.useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // 두 플레이어가 모두 입장했는지 확인하는 헬퍼 함수
  const areBothPlayersReady = useCallback((boardLength: number): boolean => {
    if (config?.mode !== 'ONLINE') {
      return false;
    }
    // ref를 통해 최신 방 상태 확인
    const latestRoom = currentMatchRoomRef.current;
    if (!latestRoom) {
      debugLog('areBothPlayersReady: No room found');
      return false;
    }
    
    // 방 상태가 'playing'이 아니면 준비되지 않음
    if (latestRoom.status !== 'playing') {
      debugLog('areBothPlayersReady: Room status is not playing');
      return false;
    }
    
    // 두 플레이어가 모두 입장했는지 확인
    const bothJoined = !!(latestRoom.player1_id && latestRoom.player2_id);
    
    // 게임이 실제로 시작되었는지 확인
    // 게임이 시작되지 않았으면 플레이어2가 아직 입장하지 않은 것으로 간주
    const gameStarted = boardLength > 0;
    
    // 플레이어2 닉네임이 로드되었는지 확인 (플레이어2가 실제로 입장했는지)
    const hasPlayer2Nickname = !!player2NicknameRef.current;
    
    // 모든 조건을 만족해야 준비됨:
    // 1. 두 플레이어 ID가 모두 있음
    // 2. 게임이 시작됨 (boardLength > 0)
    // 3. 플레이어2 닉네임이 로드됨 (플레이어2가 실제로 입장함)
    const result = bothJoined && gameStarted && hasPlayer2Nickname;
    
    debugLog('areBothPlayersReady check:', {
      bothJoined,
      gameStarted,
      hasPlayer2Nickname,
      result
    });
    
    return result;
  }, [config?.mode]);

  // 닉네임 입력 처리
  const handleNicknameSubmit = async (nickname: string) => {
    if (!nickname.trim()) {
      setNotification('닉네임을 입력해주세요.');
      setTimeout(() => setNotification(null), 2000);
      return;
    }
    try {
      const player = await getOrCreatePlayer(nickname.trim());
      setCurrentPlayer(player);
      setShowNicknameInput(false);
      soundService.playClick();
    } catch (error: any) {
      console.error('Nickname submit error:', error);
      const errorMessage = error.message || '닉네임 설정 실패';
      setNotification(errorMessage);
      // 중복 접속 오류는 더 오래 표시
      const displayTime = errorMessage.includes('접속 중') ? 4000 : 2000;
      setTimeout(() => setNotification(null), displayTime);
    }
  };

  // --- Sound Toggle ---
  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    soundService.toggle(newState);
    if (newState) soundService.playClick();
  };

  // --- Initialization ---
  const prepareGame = (mode: 'AI' | 'PVP' | 'ONLINE') => {
    if (!currentPlayer) {
      setNotification('닉네임을 먼저 입력해주세요.');
      setTimeout(() => setNotification(null), 2000);
      return;
    }
    soundService.playClick();
    if (mode === 'AI') {
      setShowDifficultySelect(true);
    } else if (mode === 'ONLINE') {
      setShowMatchRoom(true);
    } else {
      startGame('PVP', 5); // Difficulty doesn't matter for PVP
    }
  };

  const startGame = async (mode: 'AI' | 'PVP' | 'ONLINE', difficulty: number, roomOverride?: MatchRoom | null) => {
    console.log('startGame called:', { mode, difficulty, hasCurrentMatchRoom: !!currentMatchRoom, hasRoomOverride: !!roomOverride });
    // 게임 시작 시 상대방 나감 상태 리셋
    setOpponentLeft(false);
    const newBoard = initializeBoard();
    
    // 게임 시작 시 저장 상태 초기화
    gameEndSavedRef.current = {};
    
    // 온라인 모드인 경우 게임 상태를 Supabase에 저장
    // roomOverride가 제공되면 그것을 사용하고, 없으면 currentMatchRoom 사용
    const roomToUse = roomOverride || currentMatchRoom;
    if (mode === 'ONLINE' && roomToUse) {
      console.log('startGame: ONLINE mode, checking conditions');
      // 최신 방 상태 확인 (ref를 통해 최신 상태 가져오기)
      const latestRoom = currentMatchRoomRef.current || roomToUse;
      
      // roomOverride가 제공된 경우 ref도 업데이트
      if (roomOverride) {
        currentMatchRoomRef.current = roomOverride;
      }
      
      console.log('startGame: Latest room state:', {
        roomId: latestRoom.id,
        player1_id: latestRoom.player1_id,
        player2_id: latestRoom.player2_id,
        status: latestRoom.status,
        player2Nickname: player2NicknameRef.current
      });
      
      // 두 플레이어가 모두 입장했는지 확인
      if (!latestRoom.player1_id || !latestRoom.player2_id) {
        console.log('startGame: Players not joined', {
          player1_id: latestRoom.player1_id,
          player2_id: latestRoom.player2_id,
          status: latestRoom.status
        });
        setNotification('상대방이 입장할 때까지 기다려주세요.');
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      
      // 방 상태가 'playing'이 아니면 게임 시작 불가
      if (latestRoom.status !== 'playing') {
        console.log('startGame: Room status is not playing', {
          status: latestRoom.status,
          player1_id: latestRoom.player1_id,
          player2_id: latestRoom.player2_id
        });
        setNotification('상대방이 입장할 때까지 기다려주세요.');
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      
      // 플레이어2 닉네임이 로드되었는지 확인 (플레이어2가 실제로 입장했는지)
      if (!player2NicknameRef.current) {
        console.log('startGame: Player2 nickname not loaded yet', {
          player1_id: latestRoom.player1_id,
          player2_id: latestRoom.player2_id,
          player2Nickname: player2NicknameRef.current
        });
        setNotification('상대방 정보를 불러오는 중입니다. 잠시만 기다려주세요.');
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      
      console.log('startGame: All conditions met, proceeding to create game');
      
      try {
        // 게임을 생성하기 전에 플레이어2가 실제로 입장했는지 확인
        // 게임이 이미 존재하는 경우, 게임이 시작되지 않았으면 플레이어2가 아직 입장하지 않은 것으로 간주
        console.log('startGame: Checking if game exists before creating', {
          roomId: latestRoom.id,
          player1_id: latestRoom.player1_id,
          player2_id: latestRoom.player2_id,
          status: latestRoom.status
        });
        
        // 먼저 기존 게임이 있는지 확인 (생성하지 않고)
        const { data: existingGame } = await supabase
          .from('online_games')
          .select('board_state, current_player, winner, is_game_over, id')
          .eq('room_id', latestRoom.id)
          .maybeSingle();
        
        // 기존 게임이 있고 보드가 비어있지 않으면, 게임이 이미 시작된 것
        // 온라인 모드에서는 "Play again"이 작동하지 않으므로 기존 게임 상태만 동기화
        if (existingGame && existingGame.board_state && existingGame.board_state.length > 0) {
          // 기존 게임이 있고 아직 진행 중이면 상태 동기화
          debugLog('startGame: Game already exists with board, syncing game state immediately');
          
          // 기존 게임 상태를 즉시 동기화 (실시간 구독이 업데이트하기 전까지 기존 화면이 보이는 것을 방지)
          const existingGameState = {
            board: existingGame.board_state as CellState[][],
            currentPlayer: existingGame.current_player as 1 | 2,
            winner: existingGame.winner as 1 | 2 | null,
            score: countScore(existingGame.board_state as CellState[][]),
            validMovesForCurrentPlayer: getValidMoves(existingGame.board_state as CellState[][], existingGame.current_player as 1 | 2),
            isGameOver: existingGame.is_game_over || false,
            history: []
          };
          
          // 상태 업데이트를 배치로 처리 (React 18의 자동 배칭 활용)
          setGameState(existingGameState);
          setConfig({ mode, difficulty });
          setShowDifficultySelect(false);
          // MatchRoom은 onRoomReady에서 이미 닫혔을 수 있지만, 확실히 닫기
          setShowMatchRoom(false);
          // 게임이 초기화되었음을 표시
          setGameInitialized(true);
          // 실시간 구독이 추가 업데이트를 처리할 것임
          return;
        }
        
        // 게임이 없거나 보드가 비어있으면 새로 생성
        debugLog('startGame: Creating/Getting online game', {
          roomId: latestRoom.id
        });
        
        const onlineGame = await getOrCreateOnlineGame(latestRoom.id, newBoard);
        
        console.log('startGame: Online game received', {
          gameId: onlineGame.id,
          roomId: latestRoom.id,
          gameRoomId: onlineGame.room_id || 'N/A',
          boardLength: onlineGame.board_state?.length || 0,
          currentPlayer: onlineGame.current_player,
          player1_id: latestRoom.player1_id,
          player2_id: latestRoom.player2_id,
          note: 'This game should be found by player2 subscription'
        });
        
        // 게임 상태를 직접 설정 (두 플레이어가 모두 준비되었으므로)
        const initialGameState = {
          board: onlineGame.board_state,
          currentPlayer: onlineGame.current_player,
          winner: onlineGame.winner,
          score: countScore(onlineGame.board_state),
          validMovesForCurrentPlayer: getValidMoves(onlineGame.board_state, onlineGame.current_player),
          isGameOver: onlineGame.is_game_over || false,
          history: []
        };
        
        debugLog('startGame: Setting initial game state', initialGameState);
        // 상태 업데이트를 배치로 처리 (React 18의 자동 배칭 활용)
        setGameState(initialGameState);
        setConfig({ mode, difficulty });
        setShowDifficultySelect(false);
        // MatchRoom은 onRoomReady에서 이미 닫혔을 수 있지만, 확실히 닫기
        setShowMatchRoom(false);
        
        // 게임이 초기화되었음을 표시
        setGameInitialized(true);
      } catch (error) {
        console.error('Online game start failed:', error);
        setNotification('온라인 게임 시작 실패');
        setTimeout(() => setNotification(null), 2000);
        return;
      }
    }
    
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

  const returnToMenu = async () => {
    soundService.playClick();
    
    // 온라인 게임 중이면 방 나가기 처리
    if (config?.mode === 'ONLINE' && currentMatchRoom && currentPlayer) {
      try {
        await leaveMatchRoom(currentMatchRoom.id, currentPlayer.id);
      } catch (error) {
        console.error('Leave room failed:', error);
      }
    }
    
    // 상태 리셋
    setOpponentLeft(false);
    setConfig(null);
    setShowDifficultySelect(false);
    setCurrentMatchRoom(null);
  };

  // 게임 종료 시 기록 저장 (중복 저장 방지를 위한 ref)
  const gameEndSavedRef = React.useRef<{ roomId?: string; winner?: Player | 'draw' | null }>({});

  // 게임 종료 시 기록 저장 (advanceTurn보다 먼저 정의)
  const handleGameEnd = useCallback(async (
    winner: Player | 'draw' | null, 
    _finalScore: { 1: number; 2: number; empty: number },
    gameConfig?: GameConfig | null,
    gamePlayer?: PlayerRecord | null,
    gameMatchRoom?: MatchRoom | null
  ) => {
    // 파라미터로 전달된 값이 있으면 사용하고, 없으면 현재 상태 사용
    const configToUse = gameConfig ?? config;
    const playerToUse = gamePlayer ?? currentPlayer;
    const matchRoomToUse = gameMatchRoom ?? currentMatchRoom;
    
    if (!playerToUse || !configToUse) {
      console.log('handleGameEnd: currentPlayer or config is null', { 
        currentPlayer: playerToUse, 
        config: configToUse,
        passedPlayer: gamePlayer,
        passedConfig: gameConfig
      });
      return;
    }

    // 중복 저장 방지: 온라인 모드의 경우 roomId와 winner로 중복 확인
    const roomId = configToUse.mode === 'ONLINE' ? matchRoomToUse?.id : undefined;
    
    if (gameEndSavedRef.current.roomId === roomId && gameEndSavedRef.current.winner === winner) {
      console.log('handleGameEnd: Game result already saved, preventing duplicate save', { roomId, winner });
      return;
    }

    // 게임 상태를 종료 상태로 설정
    setGameState(prev => {
      // 이미 종료 상태이고 winner가 같으면 업데이트하지 않음
      if (prev.isGameOver && prev.winner === winner) {
        return prev;
      }
      // winner가 다르거나 아직 종료 상태가 아니면 업데이트
      return {
        ...prev,
        isGameOver: true,
        winner: winner
      };
    });

    // 무승부는 기록하지 않음
    if (winner === 'draw' || winner === null) {
      console.log('handleGameEnd: Draw or null winner, skipping save');
      return;
    }

    try {
      console.log('handleGameEnd: saving record', { mode: configToUse.mode, winner, winnerType: typeof winner, difficulty: configToUse.difficulty });
      if (configToUse.mode === 'AI') {
        // AI 게임: 플레이어가 이긴 경우만 기록 (플레이어는 항상 Player 1)
        // winner가 정확히 숫자 1인지 확인 (타입 체크)
        if (winner === 1 && typeof winner === 'number') {
          console.log('AI match: Player won, attempting to save record', { playerId: playerToUse.id, difficulty: configToUse.difficulty });
          try {
            await saveAIMatch(playerToUse.id, configToUse.difficulty, true);
            console.log('AI match saved successfully');
            // 저장 완료 표시 (로컬 모드이므로 roomId 없음)
            gameEndSavedRef.current = { winner };
          } catch (error) {
            console.error('AI match save failed:', error);
            setNotification('AI 게임 기록 저장 실패');
            setTimeout(() => setNotification(null), 3000);
          }
        } else {
          console.log('AI match: Player lost or draw, not saving', { winner, winnerType: typeof winner });
        }
      } else if (configToUse.mode === 'ONLINE' && matchRoomToUse) {
        // 온라인 대전: 승자/패자 기록
        if (matchRoomToUse.player1_id && matchRoomToUse.player2_id) {
          const winnerId = winner === 1 ? matchRoomToUse.player1_id : matchRoomToUse.player2_id;
          const loserId = winner === 1 ? matchRoomToUse.player2_id : matchRoomToUse.player1_id;
          await savePVPMatch(matchRoomToUse.id, winnerId, loserId);
          console.log('PVP match saved successfully');
          // 저장 완료 표시
          gameEndSavedRef.current = { roomId: matchRoomToUse.id, winner };
        }
      } else if (configToUse.mode === 'PVP') {
        // 로컬 PVP 모드는 기록하지 않음
        console.log('PVP mode: local game, not saving');
      }
    } catch (error) {
      console.error('Game record save failed:', error);
    }
  }, [currentPlayer, config, currentMatchRoom]);

  // --- Game Loop Helpers ---
  const advanceTurn = useCallback((currentBoard: CellState[][], currentPlayerNum: Player) => {
    const nextPlayer: Player = currentPlayerNum === 1 ? 2 : 1;
    let nextValidMoves = getValidMoves(currentBoard, nextPlayer);
    let nextPlayerActual: Player = nextPlayer;

    // Check pass condition
    if (nextValidMoves.length === 0) {
      // Check if game over completely
      const check = checkGameOver(currentBoard);
      if (check.isOver) {
        soundService.playWin(); 
        const finalScore = countScore(currentBoard);
        setGameState(prev => ({
          ...prev,
          board: currentBoard,
          isGameOver: true,
          winner: check.winner,
          score: finalScore
        }));
        // 게임 결과 저장 (클로저의 currentPlayer와 config 사용)
        handleGameEnd(check.winner, finalScore, config, currentPlayer, currentMatchRoom);
        return;
      }

      // If not game over but no moves, pass turn back to original player
      setNotification(`Player ${nextPlayer === 1 ? 'Blue' : 'Red'} has no moves! Skipped.`);
      setTimeout(() => setNotification(null), 2500);

      nextPlayerActual = currentPlayerNum; // Stay on current
      nextValidMoves = getValidMoves(currentBoard, currentPlayerNum);

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
        // 게임 결과 저장 (클로저의 currentPlayer와 config 사용)
        handleGameEnd(winner, finalScore, config, currentPlayer, currentMatchRoom);
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

  }, [config, currentPlayer, currentMatchRoom]);

  const handleMove = useCallback(async (move: Move) => {
    // 온라인 모드에서 자신의 턴인지 확인
    if (config?.mode === 'ONLINE' && currentPlayer) {
      // 최신 방 상태 확인 (ref를 통해 최신 상태 가져오기)
      const latestRoom = currentMatchRoomRef.current;
      if (!latestRoom) {
        setNotification('방 정보를 찾을 수 없습니다.');
        setTimeout(() => setNotification(null), 2000);
        return;
      }
      
      // 두 플레이어가 모두 입장했는지 확인
      if (!latestRoom.player1_id || !latestRoom.player2_id) {
        console.log('Move blocked: players not joined', {
          player1_id: latestRoom.player1_id,
          player2_id: latestRoom.player2_id
        });
        setNotification('상대방이 입장할 때까지 기다려주세요.');
        setTimeout(() => setNotification(null), 2000);
        return;
      }
      
      // 게임이 실제로 시작되었는지 확인 (보드가 초기화되었는지)
      if (gameState.board.length === 0) {
        setNotification('게임이 아직 시작되지 않았습니다.');
        setTimeout(() => setNotification(null), 2000);
        return;
      }
      
      // 두 플레이어가 모두 준비되었는지 추가 확인 (가장 중요!)
      if (!areBothPlayersReady(gameState.board.length) || !gameInitialized) {
        console.log('Move blocked: both players not ready or game not initialized', {
          boardLength: gameState.board.length,
          player1_id: latestRoom.player1_id,
          player2_id: latestRoom.player2_id,
          gameInitialized,
          areBothReady: areBothPlayersReady(gameState.board.length)
        });
        setNotification('게임 준비 중입니다. 잠시만 기다려주세요.');
        setTimeout(() => setNotification(null), 2000);
        return;
      }
      
      const myPlayerNumber = latestRoom.player1_id === currentPlayer.id ? 1 : 2;
      if (gameState.currentPlayer !== myPlayerNumber) {
        setNotification('상대방의 턴입니다.');
        setTimeout(() => setNotification(null), 2000);
        return;
      }
    }
    
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
    
    // 온라인 모드인 경우 Supabase에 상태 업데이트
    const latestRoom = currentMatchRoomRef.current;
    if (config?.mode === 'ONLINE' && latestRoom) {
      // 게임이 초기화되지 않았으면 업데이트하지 않음
      if (!gameInitializedRef.current) {
        console.log('handleMove: Game not initialized yet, skipping updateOnlineGame');
        return;
      }
      
      try {
        const nextPlayer: Player = gameState.currentPlayer === 1 ? 2 : 1;
        const check = checkGameOver(newBoard);
        
        // 즉시 로컬 상태 업데이트 (낙관적 업데이트)
        const nextValidMoves = getValidMoves(newBoard, nextPlayer);
        let actualNextPlayer = nextPlayer;
        
        if (nextValidMoves.length === 0) {
          const currentValidMoves = getValidMoves(newBoard, gameState.currentPlayer);
          if (currentValidMoves.length === 0) {
            // 둘 다 움직일 수 없으면 게임 종료
            const finalScore = countScore(newBoard);
            const winner = finalScore[1] > finalScore[2] ? 1 : finalScore[1] < finalScore[2] ? 2 : 'draw';
            
            setGameState({
              board: newBoard,
              currentPlayer: actualNextPlayer,
              winner: winner as Player | null,
              score: finalScore,
              validMovesForCurrentPlayer: [],
              isGameOver: true,
              history: []
            });
            
            await updateOnlineGame(
              latestRoom.id,
              newBoard,
              nextPlayer,
              winner as Player | null,
              true
            );
            return;
          }
          actualNextPlayer = gameState.currentPlayer;
        }
        
        // 낙관적 업데이트: 즉시 로컬 상태 업데이트
        setGameState({
          board: newBoard,
          currentPlayer: actualNextPlayer,
          winner: check.isOver ? (check.winner as Player | null) : null,
          score: countScore(newBoard),
          validMovesForCurrentPlayer: getValidMoves(newBoard, actualNextPlayer),
          isGameOver: check.isOver,
          history: []
        });
        
        // Supabase에 업데이트 (Realtime이 다른 플레이어에게 전달)
        console.log('handleMove: Calling updateOnlineGame', {
          roomId: latestRoom.id,
          boardLength: newBoard.length,
          currentPlayer: actualNextPlayer,
          isGameOver: check.isOver,
          winner: check.isOver ? (check.winner as Player | null) : null
        });
        
        try {
          await updateOnlineGame(
            latestRoom.id,
            newBoard,
            actualNextPlayer,
            check.isOver ? (check.winner as Player | null) : null,
            check.isOver
          );
          console.log('handleMove: updateOnlineGame completed successfully');
        } catch (error) {
          console.error('handleMove: updateOnlineGame failed:', error);
          throw error; // 에러를 다시 throw하여 상위에서 처리
        }
      } catch (error) {
        console.error('Online game update failed:', error);
        setNotification('게임 업데이트 실패');
        setTimeout(() => setNotification(null), 2000);
      }
    } else {
      // Update State (로컬 모드)
      advanceTurn(newBoard, gameState.currentPlayer);
    }
  }, [gameState.board, gameState.currentPlayer, config, currentPlayer, advanceTurn, areBothPlayersReady, gameInitialized]);


  // 플레이어 닉네임 및 랭킹 로드
  useEffect(() => {
    if (config?.mode === 'ONLINE' && currentMatchRoom) {
      const loadNicknamesAndRanks = async () => {
        if (currentMatchRoom.player1_id) {
          const nickname = await getPlayerNickname(currentMatchRoom.player1_id);
          setPlayer1Nickname(nickname);
          try {
            const [rank, level] = await Promise.all([
              getPlayerRank(currentMatchRoom.player1_id, 'pvp'),
              getPlayerLevel(currentMatchRoom.player1_id, 'pvp')
            ]);
            setPlayer1Rank(rank);
            setPlayer1Level(level);
          } catch (error) {
            console.error('Failed to load player1 rank:', error);
            setPlayer1Rank(null);
            setPlayer1Level(null);
          }
        }
        if (currentMatchRoom.player2_id) {
          const nickname = await getPlayerNickname(currentMatchRoom.player2_id);
          setPlayer2Nickname(nickname);
          try {
            const [rank, level] = await Promise.all([
              getPlayerRank(currentMatchRoom.player2_id, 'pvp'),
              getPlayerLevel(currentMatchRoom.player2_id, 'pvp')
            ]);
            setPlayer2Rank(rank);
            setPlayer2Level(level);
          } catch (error) {
            console.error('Failed to load player2 rank:', error);
            setPlayer2Rank(null);
            setPlayer2Level(null);
          }
        }
      };
      loadNicknamesAndRanks();
    }
  }, [config?.mode, currentMatchRoom?.player1_id, currentMatchRoom?.player2_id]);

  // 플레이어 나가기 감지 및 자동 승리 처리
  useEffect(() => {
    if (config?.mode === 'ONLINE' && currentMatchRoom && currentPlayer && !gameState.isGameOver) {
      const roomId = currentMatchRoom.id;
      const myPlayerId = currentPlayer.id;
      const myPlayerNumber = currentMatchRoom.player1_id === myPlayerId ? 1 : 2;
      const opponentId = myPlayerNumber === 1 ? currentMatchRoom.player2_id : currentMatchRoom.player1_id;
      
      const unsubscribe = subscribeToMatchRoom(roomId, async (updatedRoom) => {
        console.log('MatchRoom status change detected:', updatedRoom);
        console.log('Current player ID:', myPlayerId);
        console.log('Opponent ID:', opponentId);
        console.log('Updated room status:', updatedRoom);
        
        // 방이 삭제된 경우 (updatedRoom이 null) - 플레이어1(방 개설자)이 나간 경우
        if (!updatedRoom) {
          console.log('Room was deleted, handling cleanup');
          
          // 상대방(방 개설자)이 나갔음을 표시
          setOpponentLeft(true);
          
          // 게임 상태를 종료 상태로 설정
          setGameState(prev => {
            if (prev.isGameOver) {
              return prev;
            }
            return {
              ...prev,
              isGameOver: true,
              winner: myPlayerNumber // 자신이 승리
            };
          });
          setCurrentMatchRoom(null);
          currentMatchRoomRef.current = null;
          setNotification('방이 삭제되었습니다.');
          setTimeout(() => setNotification(null), 3000);
          return;
        }
        
        // 방 상태를 즉시 업데이트 (ref도 함께 업데이트)
        setCurrentMatchRoom(updatedRoom);
        currentMatchRoomRef.current = updatedRoom;
        console.log('MatchRoom state updated:', {
          player1_id: updatedRoom.player1_id,
          player2_id: updatedRoom.player2_id,
          status: updatedRoom.status
        });
        
        // 상대방이 나간 경우 감지
        // 1. 방 상태가 cancelled이고, 상대방 ID가 null이 된 경우
        // 2. 또는 상대방 ID가 이전에 있었는데 지금 null이 된 경우
        const opponentLeft = opponentId && (
          (updatedRoom.status === 'cancelled' && (
            (myPlayerNumber === 1 && !updatedRoom.player2_id) ||
            (myPlayerNumber === 2 && !updatedRoom.player1_id)
          )) ||
          (myPlayerNumber === 1 && currentMatchRoom.player2_id && !updatedRoom.player2_id) ||
          (myPlayerNumber === 2 && currentMatchRoom.player1_id && !updatedRoom.player1_id)
        );
        
        // 자신이 나간 경우는 처리하지 않음 (이미 나갔으므로)
        const iLeft = 
          (myPlayerNumber === 1 && !updatedRoom.player1_id) ||
          (myPlayerNumber === 2 && !updatedRoom.player2_id);
        
        if (opponentLeft && !iLeft) {
          console.log('Opponent left detected, processing automatic win');
          
          // 상대방이 나갔음을 표시
          setOpponentLeft(true);
          
          // 게임 상태를 먼저 종료 상태로 설정 (승리 화면 표시를 위해)
          setGameState(prev => {
            if (prev.isGameOver) {
              return prev; // 이미 종료 상태면 업데이트하지 않음
            }
            console.log('Game state update: Win processing', { myPlayerNumber });
            return {
              ...prev,
              isGameOver: true,
              winner: myPlayerNumber
            };
          });
          
          // 게임 종료 처리
          try {
            // 게임이 초기화되지 않았으면 업데이트하지 않음
            if (!gameInitializedRef.current) {
              console.log('Game end: Game not initialized yet, skipping updateOnlineGame');
              return;
            }
            
            const currentBoard = gameState.board;
            await updateOnlineGame(
              roomId,
              currentBoard,
              myPlayerNumber,
              myPlayerNumber,
              true
            );
            
            // 기록 저장
            const finalScore = countScore(currentBoard);
            await handleGameEnd(myPlayerNumber, finalScore, config, currentPlayer, currentMatchRoom);
            setNotification('상대방이 나갔습니다. 승리했습니다!');
            setTimeout(() => setNotification(null), 5000);
          } catch (error) {
            console.error('Game end processing failed:', error);
          }
        }
      });

      return () => unsubscribe();
    }
  }, [config?.mode, currentMatchRoom?.id, currentMatchRoom?.player1_id, currentMatchRoom?.player2_id, currentPlayer?.id, gameState.isGameOver, gameState.board, handleGameEnd]);

  // 게임 상태가 설정되었을 때 gameInitialized 설정
  useEffect(() => {
    if (config?.mode === 'ONLINE' && currentMatchRoom && gameState.board.length > 0) {
      // 두 플레이어가 모두 준비되었는지 확인 (함수와 직접 확인 둘 다)
      const bothReadyFromFunction = areBothPlayersReady(gameState.board.length);
      
      // 직접 확인 (ref 대신 state 사용)
      const bothJoined = !!(currentMatchRoom.player1_id && currentMatchRoom.player2_id);
      const gameStarted = gameState.board.length > 0;
      const hasPlayer2Nickname = !!player2Nickname;
      const roomStatusPlaying = currentMatchRoom.status === 'playing';
      const bothReadyDirect = bothJoined && gameStarted && hasPlayer2Nickname && roomStatusPlaying;
      
      // 둘 중 하나라도 true면 준비됨
      const bothReady = bothReadyFromFunction || bothReadyDirect;
      
      // ref를 통해 현재 gameInitialized 상태 확인 (무한 루프 방지)
      const currentInitialized = gameInitializedRef.current;
      
      if (bothReady && !currentInitialized) {
        debugLog('Game state exists and both players ready, setting gameInitialized to true');
        setGameInitialized(true);
      } else if (!bothReady && currentInitialized) {
        // 플레이어가 준비되지 않았으면 초기화 상태 리셋
        debugLog('Players not ready, resetting gameInitialized');
        setGameInitialized(false);
      }
    } else if (config?.mode === 'ONLINE' && gameState.board.length === 0) {
      // 게임 보드가 없으면 초기화 상태 리셋
      const currentInitialized = gameInitializedRef.current;
      if (currentInitialized) {
        debugLog('Game board is empty, resetting gameInitialized');
        setGameInitialized(false);
      }
    }
  }, [config?.mode, currentMatchRoom, gameState.board.length, areBothPlayersReady, player2Nickname]);

  // 준비 화면에서 room 상태 실시간 업데이트 및 닉네임 로드
  useEffect(() => {
    if (!showReadyScreen || !currentMatchRoom?.id) return;

    // 준비 화면이 표시될 때 닉네임 로드
    const loadNicknames = async () => {
      if (currentMatchRoom.player1_id) {
        try {
          const nickname = await getPlayerNickname(currentMatchRoom.player1_id);
          setPlayer1Nickname(nickname);
        } catch (error) {
          console.error('Failed to load player1 nickname:', error);
        }
      }
      if (currentMatchRoom.player2_id) {
        try {
          const nickname = await getPlayerNickname(currentMatchRoom.player2_id);
          setPlayer2Nickname(nickname);
        } catch (error) {
          console.error('Failed to load player2 nickname:', error);
        }
      }
    };
    loadNicknames();

    const unsubscribe = subscribeToMatchRoom(currentMatchRoom.id, (updatedRoom) => {
      // 방이 삭제되었거나 상대방이 나갔을 때
      if (!updatedRoom) {
        // 상대방이 나갔음을 알리고 준비 화면 닫기
        setShowReadyScreen(false);
        setCurrentMatchRoom(null);
        currentMatchRoomRef.current = null;
        // 알림을 먼저 설정한 후 모달 열기
        setNotification('상대방이 나갔습니다.');
        setTimeout(() => setNotification(null), 3000);
        // 약간의 지연 후 모달 열기 (알림이 먼저 표시되도록)
        setTimeout(() => {
          setShowMatchRoom(true);
        }, 100);
        return;
      }

      // 상대방이 나갔는지 확인
      const myPlayerId = currentPlayer?.id;
      if (myPlayerId) {
        const prevPlayer1Id = currentMatchRoom.player1_id;
        const prevPlayer2Id = currentMatchRoom.player2_id;
        const currentPlayer1Id = updatedRoom.player1_id;
        const currentPlayer2Id = updatedRoom.player2_id;

        // 자신이 나간 경우는 처리하지 않음
        const iLeft = 
          (prevPlayer1Id === myPlayerId && !currentPlayer1Id) ||
          (prevPlayer2Id === myPlayerId && !currentPlayer2Id);

        // 상대방이 나갔는지 확인
        const opponentLeft = 
          ((prevPlayer1Id && !currentPlayer1Id) && prevPlayer1Id !== myPlayerId) ||
          ((prevPlayer2Id && !currentPlayer2Id) && prevPlayer2Id !== myPlayerId);

        // 상대방이 나갔을 때만 처리
        if (opponentLeft && !iLeft) {
          setShowReadyScreen(false);
          setCurrentMatchRoom(null);
          currentMatchRoomRef.current = null;
          // 알림을 먼저 설정한 후 모달 열기
          setNotification('상대방이 나갔습니다.');
          setTimeout(() => setNotification(null), 3000);
          // 약간의 지연 후 모달 열기 (알림이 먼저 표시되도록)
          setTimeout(() => {
            setShowMatchRoom(true);
          }, 100);
          return;
        }
      }

      setCurrentMatchRoom(updatedRoom);
      currentMatchRoomRef.current = updatedRoom;
      
      // room이 업데이트될 때 닉네임도 다시 로드 (상대방이 변경되었을 수 있음)
      if (updatedRoom.player1_id && updatedRoom.player1_id !== currentMatchRoom.player1_id) {
        getPlayerNickname(updatedRoom.player1_id).then(nickname => {
          setPlayer1Nickname(nickname);
        }).catch(error => {
          console.error('Failed to load player1 nickname:', error);
        });
      }
      if (updatedRoom.player2_id && updatedRoom.player2_id !== currentMatchRoom.player2_id) {
        getPlayerNickname(updatedRoom.player2_id).then(nickname => {
          setPlayer2Nickname(nickname);
        }).catch(error => {
          console.error('Failed to load player2 nickname:', error);
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [showReadyScreen, currentMatchRoom?.id]);

  // 온라인 대전 턴 타이머 (20초) - 각 플레이어의 타이머를 독립적으로 관리
  useEffect(() => {
    // 기존 타이머 정리
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // 온라인 모드가 아니면 타이머 초기화
    if (config?.mode !== 'ONLINE') {
      setPlayer1Timer(20);
      setPlayer2Timer(20);
      setTurnTimer(20);
      return;
    }
    
    // currentMatchRoom이 없으면 타이머 정지
    if (!currentMatchRoom) {
      setPlayer1Timer(20);
      setPlayer2Timer(20);
      setTurnTimer(20);
      return;
    }
    
    // 두 플레이어가 모두 입장했는지 확인 (상대방 입장 확인)
    const bothPlayersJoined = !!(currentMatchRoom.player1_id && currentMatchRoom.player2_id);
    const gameStarted = gameState.board.length > 0; // 보드가 초기화되었는지 확인
    
    // 준비 화면이 표시 중이면 타이머 정지
    if (showReadyScreen) {
      setPlayer1Timer(20);
      setPlayer2Timer(20);
      setTurnTimer(20);
      return; // 준비 화면이 표시되는 동안 타이머 정지
    }
    
    // 상대방이 입장하지 않았으면 타이머 정지 (20초로 고정, 타이머 시작하지 않음)
    if (!bothPlayersJoined) {
      setPlayer1Timer(20);
      setPlayer2Timer(20);
      setTurnTimer(20);
      return; // 타이머 시작하지 않음 (정지 상태)
    }
    
    // 상대방이 입장했지만 게임이 아직 시작되지 않았으면 타이머 정지
    if (!gameStarted) {
      setPlayer1Timer(20);
      setPlayer2Timer(20);
      setTurnTimer(20);
      return; // 게임이 시작되기 전까지 타이머 정지
    }
    
    // 게임이 초기화되지 않았으면 타이머 정지
    if (!gameInitialized) {
      setPlayer1Timer(20);
      setPlayer2Timer(20);
      setTurnTimer(20);
      return; // 게임이 초기화되기 전까지 타이머 정지
    }
    
    // 게임이 종료되었으면 타이머 정지
    if (gameState.isGameOver) {
      setPlayer1Timer(20);
      setPlayer2Timer(20);
      setTurnTimer(20);
      return;
    }
    
    // 상대방이 게임 화면을 열었는지 확인 (areBothPlayersReady 사용)
    // 이 함수는 두 플레이어가 모두 입장했고, 게임이 시작되었고, 플레이어2 닉네임이 로드되었는지 확인
    const bothPlayersReady = areBothPlayersReady(gameState.board.length);
    
    // 상대방이 게임 화면을 열지 않았으면 타이머 정지
    if (!bothPlayersReady) {
      setPlayer1Timer(20);
      setPlayer2Timer(20);
      setTurnTimer(20);
      return; // 상대방이 게임 화면을 열 때까지 타이머 정지
    }
    
    // 상대방이 게임 화면을 열었고 모든 조건을 만족할 때만 타이머 시작
    const shouldStartTimer = 
      config?.mode === 'ONLINE' && 
      currentMatchRoom && 
      currentPlayer && 
      !gameState.isGameOver && 
      bothPlayersJoined && 
      gameStarted && 
      gameInitialized &&
      bothPlayersReady;
    
    if (!shouldStartTimer) {
      setPlayer1Timer(20);
      setPlayer2Timer(20);
      setTurnTimer(20);
      return;
    }
    
    const currentTurnPlayer = gameState.currentPlayer;
    
    // 턴이 변경되었을 때 해당 플레이어의 타이머 리셋
    if (currentTurnPlayer === 1) {
      setPlayer1Timer(20);
    } else {
      setPlayer2Timer(20);
    }
    
    // 타이머를 ref에 저장하여 중복 실행 방지
    timerRef.current = setInterval(() => {
      // 최신 게임 상태 확인 (ref를 통해)
      const latestRoom = currentMatchRoomRef.current;
      if (!latestRoom) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }
      
      // 두 플레이어가 모두 입장했는지 확인 (상대방이 입장하지 않았으면 타이머 멈춤)
      const bothJoined = !!(latestRoom.player1_id && latestRoom.player2_id);
      if (!bothJoined) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setPlayer1Timer(20);
        setPlayer2Timer(20);
        setTurnTimer(20);
        return;
      }
      
      // 최신 게임 상태 가져오기 (ref를 통해)
      const latestState = gameStateRef.current;
      
      // 게임이 시작되지 않았으면 타이머 중지
      if (latestState.board.length === 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setPlayer1Timer(20);
        setPlayer2Timer(20);
        setTurnTimer(20);
        return;
      }
      
      // 게임이 초기화되지 않았으면 타이머 중지
      if (!gameInitializedRef.current) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setPlayer1Timer(20);
        setPlayer2Timer(20);
        setTurnTimer(20);
        return;
      }
      
      // 상대방이 게임 화면을 열었는지 확인 (플레이어2 닉네임이 로드되었는지 확인)
      // 상대방이 게임 화면을 닫거나 나가면 타이머 중지
      const hasPlayer2Nickname = !!player2NicknameRef.current;
      if (!hasPlayer2Nickname) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setPlayer1Timer(20);
        setPlayer2Timer(20);
        setTurnTimer(20);
        return;
      }
      
      // 게임이 종료되었으면 타이머 중지
      if (latestState.isGameOver) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }
      
      const latestCurrentPlayer = latestState.currentPlayer;
      
      // 현재 턴인 플레이어의 타이머만 감소
      if (latestCurrentPlayer === 1) {
        setPlayer1Timer((prev) => {
          if (prev <= 1) {
            // 시간 초과 처리
            if (!gameInitializedRef.current) {
              return 20; // 리셋
            }
            
            const nextPlayer: Player = 2;
            const nextValidMoves = getValidMoves(latestState.board, nextPlayer);
            
            if (nextValidMoves.length === 0) {
              const currentValidMoves = getValidMoves(latestState.board, 1);
              if (currentValidMoves.length === 0) {
                const finalScore = countScore(latestState.board);
                const winner = finalScore[1] > finalScore[2] ? 1 : finalScore[1] < finalScore[2] ? 2 : 'draw';
                if (latestRoom) {
                  updateOnlineGame(
                    latestRoom.id,
                    latestState.board,
                    nextPlayer,
                    winner as Player | null,
                    true
                  ).catch(error => {
                    console.error('Failed to update game on timeout:', error);
                  });
                }
              } else {
                if (latestRoom) {
                  updateOnlineGame(
                    latestRoom.id,
                    latestState.board,
                    1,
                    null,
                    false
                  ).catch(error => {
                    console.error('Failed to update game on timeout:', error);
                  });
                }
              }
            } else {
              if (latestRoom) {
                updateOnlineGame(
                  latestRoom.id,
                  latestState.board,
                  nextPlayer,
                  null,
                  false
                ).catch(error => {
                  console.error('Failed to update game on timeout:', error);
                });
              }
            }
            return 20; // 리셋
          }
          return prev - 1;
        });
      } else if (latestCurrentPlayer === 2) {
        setPlayer2Timer((prev) => {
          if (prev <= 1) {
            // 시간 초과 처리
            if (!gameInitializedRef.current) {
              return 20; // 리셋
            }
            
            const nextPlayer: Player = 1;
            const nextValidMoves = getValidMoves(latestState.board, nextPlayer);
            
            if (nextValidMoves.length === 0) {
              const currentValidMoves = getValidMoves(latestState.board, 2);
              if (currentValidMoves.length === 0) {
                const finalScore = countScore(latestState.board);
                const winner = finalScore[1] > finalScore[2] ? 1 : finalScore[1] < finalScore[2] ? 2 : 'draw';
                if (latestRoom) {
                  updateOnlineGame(
                    latestRoom.id,
                    latestState.board,
                    nextPlayer,
                    winner as Player | null,
                    true
                  ).catch(error => {
                    console.error('Failed to update game on timeout:', error);
                  });
                }
              } else {
                if (latestRoom) {
                  updateOnlineGame(
                    latestRoom.id,
                    latestState.board,
                    2,
                    null,
                    false
                  ).catch(error => {
                    console.error('Failed to update game on timeout:', error);
                  });
                }
              }
            } else {
              if (latestRoom) {
                updateOnlineGame(
                  latestRoom.id,
                  latestState.board,
                  nextPlayer,
                  null,
                  false
                ).catch(error => {
                  console.error('Failed to update game on timeout:', error);
                });
              }
            }
            return 20; // 리셋
          }
          return prev - 1;
        });
      }
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
  }, [config?.mode, currentMatchRoom, currentPlayer, gameState.currentPlayer, gameState.isGameOver, gameState.board.length, gameInitialized, areBothPlayersReady, showReadyScreen]);

  // --- Online Game Realtime Subscription ---
  useEffect(() => {
    if (config?.mode === 'ONLINE' && currentMatchRoom && currentPlayer) {
      debugLog('Online game subscription started:', {
        roomId: currentMatchRoom.id,
        playerId: currentPlayer.id
      });
      
      const unsubscribe = subscribeToOnlineGame(currentMatchRoom.id, (onlineGame) => {
        debugLog('Online game state update received:', onlineGame);
        
        // 최신 방 상태 확인 (ref를 통해 최신 상태 가져오기)
        const latestRoom = currentMatchRoomRef.current;
        if (!latestRoom) {
          debugLog('No room found, skipping update');
          return;
        }
        
        // 두 플레이어가 모두 입장했고 게임이 실제로 시작되었는지 확인
        const bothPlayersJoined = !!(latestRoom.player1_id && latestRoom.player2_id);
        const gameStarted = onlineGame.board_state && onlineGame.board_state.length > 0;
        
        // 방 상태가 'playing'이 아니면 게임 상태 업데이트하지 않음
        if (latestRoom.status !== 'playing') {
          debugLog('Game not ready yet - room status is not playing');
          return;
        }
        
        // 게임이 시작되지 않았으면 업데이트하지 않음
        if (!gameStarted) {
          debugLog('Game not started yet - waiting for game start');
          return;
        }
        
        // 두 플레이어가 모두 입장하지 않았으면 업데이트하지 않음
        if (!bothPlayersJoined) {
          debugLog('Both players not joined yet - waiting');
          return;
        }
        
        // 게임이 이미 초기화된 경우에는 항상 게임 상태를 업데이트
        // 게임이 아직 초기화되지 않았을 때만 준비 상태 체크
        const boardLength = onlineGame.board_state?.length || 0;
        const isGameAlreadyInitialized = gameInitializedRef.current;
        
        if (!isGameAlreadyInitialized) {
          const isReady = areBothPlayersReady(boardLength);
          const hasPlayer2Nickname = !!player2NicknameRef.current;
          
          // 게임이 시작되었지만 플레이어2 닉네임이 없으면 플레이어2가 아직 입장하지 않은 것으로 간주
          if (boardLength > 0 && !hasPlayer2Nickname && latestRoom.player2_id) {
            debugLog('Game state update blocked: player2Nickname not loaded');
            return;
          }
          
          if (!isReady) {
            debugLog('Game state update blocked: both players not ready yet');
            return;
          }
          
          // 게임이 준비되었으므로 초기화 플래그 설정
          debugLog('Realtime subscription: Both players ready, initializing game');
          setGameInitialized(true);
        }
        
        // 현재 플레이어 번호 확인
        const myPlayerNumber = latestRoom.player1_id === currentPlayer.id ? 1 : 2;
        const isMyTurn = onlineGame.current_player === myPlayerNumber;
        
        // 게임 종료 여부 확인 (게임 상태 업데이트 전에 확인)
        const isGameEnding = onlineGame.is_game_over && onlineGame.winner;
        
        // 게임 상태 업데이트 (함수형 업데이트를 사용하여 최신 상태 참조)
        setGameState((prevState) => {
          // 이전 게임 상태 확인 (턴 변경 감지용)
          const prevCurrentPlayer = prevState.currentPlayer;
          const isTurnChanged = prevCurrentPlayer !== onlineGame.current_player;
          
          // 보드 상태가 실제로 변경되었는지 확인 (빠른 비교 함수 사용)
          const boardChanged = !boardsEqual(prevState.board, onlineGame.board_state);
          const playerChanged = prevState.currentPlayer !== onlineGame.current_player;
          const winnerChanged = prevState.winner !== onlineGame.winner;
          const gameOverChanged = prevState.isGameOver !== onlineGame.is_game_over;
          
          // 실제로 변경된 것이 없으면 이전 상태 반환 (불필요한 리렌더링 방지)
          if (!boardChanged && !playerChanged && !winnerChanged && !gameOverChanged) {
            debugLog('Game state unchanged, skipping update');
            return prevState;
          }
          
          debugLog('Updating game state from realtime subscription:', {
            receivedCurrentPlayer: onlineGame.current_player,
            receivedBoardLength: onlineGame.board_state?.length || 0,
            boardChanged,
            playerChanged,
            prevCurrentPlayer,
            isTurnChanged
          });
          
          // 게임 상태 업데이트 (변경이 있을 때만 계산)
          const updatedState: GameState = {
            board: onlineGame.board_state,
            currentPlayer: onlineGame.current_player,
            winner: onlineGame.winner,
            score: boardChanged ? countScore(onlineGame.board_state) : prevState.score,
            validMovesForCurrentPlayer: (boardChanged || playerChanged) 
              ? getValidMoves(onlineGame.board_state, onlineGame.current_player)
              : prevState.validMovesForCurrentPlayer,
            isGameOver: onlineGame.is_game_over,
            history: []
          };
          
          // 턴이 변경되었을 때 해당 플레이어의 타이머 리셋
          if (isTurnChanged) {
            debugLog('Turn changed, resetting timer:', { from: prevCurrentPlayer, to: onlineGame.current_player });
            if (onlineGame.current_player === 1) {
              setPlayer1Timer(20);
            } else {
              setPlayer2Timer(20);
            }
            setTurnTimer(20);
          }
          
          // 게임 상태 업데이트
          return updatedState;
        });
        
        // 자신의 턴이 아니면 알림 표시
        if (!isMyTurn && !onlineGame.is_game_over) {
          setNotification(`상대방의 턴입니다. (Player ${onlineGame.current_player === 1 ? 'Blue' : 'Red'})`);
          setTimeout(() => setNotification(null), 3000);
        }
        
        // 게임 종료 처리
        if (isGameEnding) {
          debugLog('Online game end detected:', { winner: onlineGame.winner });
          
          // 게임 상태가 아직 종료 상태가 아니면 설정
          setGameState(prev => {
            if (prev.isGameOver && prev.winner) {
              return prev; // 이미 종료 상태면 업데이트하지 않음
            }
            return {
              ...prev,
              isGameOver: true,
              winner: onlineGame.winner
            };
          });
          
          soundService.playWin();
          
          // 게임 종료 처리 (중복 저장 방지는 handleGameEnd 내부에서 처리)
          const finalScore = countScore(onlineGame.board_state);
          handleGameEnd(onlineGame.winner, finalScore, config, currentPlayer, latestRoom);
        }
      });
      
      return () => {
        debugLog('Online game subscription unsubscribed:', currentMatchRoom.id);
        unsubscribe();
      };
    }
  }, [config?.mode, currentMatchRoom?.id, currentMatchRoom?.player1_id, currentMatchRoom?.player2_id, currentPlayer?.id, handleGameEnd]);

  // 플레이어 로그아웃 처리 (컴포넌트 언마운트 시)
  useEffect(() => {
    // 컴포넌트 언마운트 시 로그아웃 처리
    return () => {
      if (currentPlayer?.id) {
        // cleanup 함수에서는 비동기 함수 사용 가능
        logoutPlayer(currentPlayer.id).catch(console.error);
      }
    };
  }, [currentPlayer?.id]);

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
    
    // 온라인 모드에서 자신의 턴인지 확인
    if (config?.mode === 'ONLINE' && currentPlayer) {
      // 최신 방 상태 확인 (ref를 통해 최신 상태 가져오기)
      const latestRoom = currentMatchRoomRef.current;
      if (!latestRoom) {
        setNotification('방 정보를 찾을 수 없습니다.');
        setTimeout(() => setNotification(null), 2000);
        return;
      }
      
      // 두 플레이어가 모두 입장했는지 확인
      if (!latestRoom.player1_id || !latestRoom.player2_id) {
        console.log('Cell click blocked: players not joined', {
          player1_id: latestRoom.player1_id,
          player2_id: latestRoom.player2_id
        });
        setNotification('상대방이 입장할 때까지 기다려주세요.');
        setTimeout(() => setNotification(null), 2000);
        return;
      }
      
      // 게임이 실제로 시작되었는지 확인 (보드가 초기화되었는지)
      if (gameState.board.length === 0) {
        setNotification('게임이 아직 시작되지 않았습니다.');
        setTimeout(() => setNotification(null), 2000);
        return;
      }
      
      // 두 플레이어가 모두 준비되었는지 추가 확인 (가장 중요!)
      if (!areBothPlayersReady(gameState.board.length) || !gameInitialized) {
        console.log('Cell click blocked: both players not ready or game not initialized', {
          boardLength: gameState.board.length,
          player1_id: latestRoom.player1_id,
          player2_id: latestRoom.player2_id,
          gameInitialized,
          areBothReady: areBothPlayersReady(gameState.board.length)
        });
        setNotification('게임 준비 중입니다. 잠시만 기다려주세요.');
        setTimeout(() => setNotification(null), 2000);
        return;
      }
      
      const myPlayerNumber = latestRoom.player1_id === currentPlayer.id ? 1 : 2;
      if (gameState.currentPlayer !== myPlayerNumber) {
        setNotification('상대방의 턴입니다.');
        setTimeout(() => setNotification(null), 2000);
        return;
      }
    }

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

  // Nickname Input Modal
  if (showNicknameInput) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 to-indigo-200 flex items-center justify-center p-4 relative">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border-4 border-indigo-200"
        >
          <h2 className="text-3xl font-black text-slate-800 mb-2 text-center">닉네임 입력</h2>
          <p className="text-slate-500 text-center mb-6">게임을 시작하기 위해 닉네임을 입력해주세요.</p>
          <NicknameInput onSubmit={handleNicknameSubmit} />
        </motion.div>
        
        {/* Notification Toast for Nickname Input Modal */}
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl z-50 font-bold text-center w-max max-w-[90%]"
            >
              {notification}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
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

                  <button 
                    onClick={() => prepareGame('ONLINE')}
                    className="w-full group relative overflow-hidden bg-slate-50 border-b-4 border-slate-200 hover:border-purple-400 p-4 rounded-2xl flex items-center transition-all hover:bg-white hover:shadow-lg hover:-translate-y-1 active:translate-y-0 active:shadow-none active:border-b-0 active:mt-1 active:mb-[-1px]"
                  >
                    <div className="bg-purple-100 p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform">
                      <Users className="w-8 h-8 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-black text-slate-800 text-lg">ONLINE BATTLE</h3>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Online Match</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      soundService.playClick();
                      setShowRanking(true);
                    }}
                    className="w-full group relative overflow-hidden bg-slate-50 border-b-4 border-slate-200 hover:border-yellow-400 p-4 rounded-2xl flex items-center transition-all hover:bg-white hover:shadow-lg hover:-translate-y-1 active:translate-y-0 active:shadow-none active:border-b-0 active:mt-1 active:mb-[-1px]"
                  >
                    <div className="bg-yellow-100 p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform">
                      <Trophy className="w-8 h-8 text-yellow-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-black text-slate-800 text-lg">RANKING</h3>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">View Rankings</p>
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

        {/* Ranking Modal - 메인 메뉴에서 표시 */}
        {showRanking && currentPlayer && (
          <Ranking 
            onClose={() => {
              soundService.playClick();
              setShowRanking(false);
            }}
            currentPlayer={currentPlayer}
          />
        )}

        {/* Match Room Modal - 메인 메뉴에서 표시 */}
        {showMatchRoom && currentPlayer && (
          <MatchRoomComponent
            onClose={async () => {
              soundService.playClick();
              // 방에 참가한 상태에서 나가는 경우 방에서 제거
              if (currentMatchRoom) {
                try {
                  await leaveMatchRoom(currentMatchRoom.id, currentPlayer.id);
                } catch (error) {
                  console.error('Failed to leave room:', error);
                }
              }
              setShowMatchRoom(false);
              setCurrentMatchRoom(null);
            }}
            currentPlayer={currentPlayer}
            onRoomReady={async (room) => {
              console.log('onRoomReady callback called:', {
                roomId: room.id,
                player1_id: room.player1_id,
                player2_id: room.player2_id,
                status: room.status,
                currentPlayerId: currentPlayer?.id
              });
              
              // 플레이어2가 실제로 입장했는지 확인
              if (!room.player1_id || !room.player2_id) {
                console.log('onRoomReady: Players not joined', {
                  player1_id: room.player1_id,
                  player2_id: room.player2_id,
                  status: room.status
                });
                setNotification('상대방이 입장할 때까지 기다려주세요.');
                setTimeout(() => setNotification(null), 3000);
                return;
              }
              
              // 방 상태가 'playing'이 아니면 게임 시작 불가
              if (room.status !== 'playing') {
                console.log('onRoomReady: Room status is not playing', {
                  status: room.status,
                  player1_id: room.player1_id,
                  player2_id: room.player2_id
                });
                setNotification('상대방이 입장할 때까지 기다려주세요.');
                setTimeout(() => setNotification(null), 3000);
                return;
              }
              
              // 플레이어2 닉네임이 로드될 때까지 기다림 (최대 5초)
              let loadedNickname: string | null = null;
              const maxWaitTime = 5000; // 5초
              const checkInterval = 100; // 100ms마다 확인
              const startTime = Date.now();
              
              while (!loadedNickname && (Date.now() - startTime) < maxWaitTime) {
                // 플레이어2 닉네임 로드 시도
                try {
                  const nickname = await getPlayerNickname(room.player2_id);
                  if (nickname) {
                    setPlayer2Nickname(nickname);
                    player2NicknameRef.current = nickname; // ref도 직접 업데이트 (startGame에서 확인하므로 중요)
                    loadedNickname = nickname; // 로드한 닉네임 저장
                    console.log('onRoomReady: Player2 nickname loaded:', nickname);
                    break;
                  }
                } catch (error) {
                  console.error('onRoomReady: Failed to load player2 nickname:', error);
                }
                
                // 이미 로드되어 있는지 확인
                if (player2NicknameRef.current) {
                  loadedNickname = player2NicknameRef.current;
                  console.log('onRoomReady: Player2 nickname already loaded:', loadedNickname);
                  break;
                }
                
                // 잠시 대기 후 다시 시도
                await new Promise(resolve => setTimeout(resolve, checkInterval));
              }
              
              if (!loadedNickname) {
                console.log('onRoomReady: Player2 nickname not loaded after waiting');
                setNotification('상대방 정보를 불러오는 중입니다. 잠시만 기다려주세요.');
                setTimeout(() => setNotification(null), 3000);
                return;
              }
              
              debugLog('onRoomReady: Showing ready screen', {
                player1_id: room.player1_id,
                player2_id: room.player2_id,
                status: room.status,
                currentPlayer: currentPlayer?.id,
                player2Nickname: loadedNickname
              });
              
              // 닉네임 상태와 ref를 모두 업데이트
              setPlayer2Nickname(loadedNickname);
              player2NicknameRef.current = loadedNickname;
              
              // MatchRoom을 먼저 닫아서 UI 반응성 향상
              setShowMatchRoom(false);
              
              // 상태 업데이트를 배치로 처리
              setCurrentMatchRoom(room);
              currentMatchRoomRef.current = room;
              
              // 준비 화면 표시
              setShowReadyScreen(true);
            }}
          />
        )}

        {/* Tutorial Modal - 메인 메뉴에서 표시 */}
        {showTutorial && (
          <Tutorial onClose={() => {
            soundService.playClick();
            setShowTutorial(false);
          }} />
        )}

        {/* Game Ready Screen - 대전 게임 시작 전 준비 화면 */}
        {showReadyScreen && currentMatchRoom && currentPlayer && (
          <GameReadyScreen
            room={currentMatchRoom}
            currentPlayer={currentPlayer}
            player1Nickname={currentMatchRoom.player1_id === currentPlayer.id ? currentPlayer.nickname : player1Nickname}
            player2Nickname={currentMatchRoom.player2_id === currentPlayer.id ? currentPlayer.nickname : player2Nickname}
            onBothReady={() => {
              // 둘 다 준비했을 때 게임 시작
              setShowReadyScreen(false);
              if (currentMatchRoom) {
                startGame('ONLINE', 5, currentMatchRoom);
              }
            }}
            onCancel={async () => {
              // 준비 화면 취소 시 준비 상태 초기화 및 방에서 나가기
              if (currentMatchRoom) {
                try {
                  // 준비 상태 초기화 (방이 이미 삭제되었을 수 있으므로 에러 무시)
                  try {
                    await setPlayerReady(currentMatchRoom.id, currentPlayer.id, false);
                  } catch (readyError) {
                    // 방이 이미 삭제되었거나 존재하지 않으면 무시
                    console.log('Room may already be deleted, skipping ready status update:', readyError);
                  }
                  // 방에서 나가기 (방이 이미 삭제되었을 수 있으므로 에러 무시)
                  try {
                    await leaveMatchRoom(currentMatchRoom.id, currentPlayer.id);
                  } catch (leaveError) {
                    // 방이 이미 삭제되었거나 존재하지 않으면 무시
                    console.log('Room may already be deleted, skipping leave room:', leaveError);
                  }
                } catch (error) {
                  console.error('Failed to cancel ready or leave room:', error);
                }
              }
              setShowReadyScreen(false);
              setCurrentMatchRoom(null);
              currentMatchRoomRef.current = null;
              setShowMatchRoom(true);
            }}
            onOpponentLeft={() => {
              // 상대방이 나갔을 때 알림 표시
              setNotification('상대방이 나갔습니다.');
              setTimeout(() => setNotification(null), 3000);
            }}
          />
        )}

        {/* Notification Toast for Main Menu - 높은 z-index로 매치룸 모달 위에 표시 */}
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-[110] font-bold text-center w-max max-w-[90%]"
            >
              {notification}
            </motion.div>
          )}
        </AnimatePresence>
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

          {/* Player 1 Score (Blue) */}
          {(() => {
            const isMyTeam = config?.mode === 'ONLINE' && currentMatchRoom && currentPlayer
              ? currentMatchRoom.player1_id === currentPlayer.id
              : true; // 로컬 모드에서는 항상 플레이어1
            const isMyTurn = config?.mode === 'ONLINE' && currentMatchRoom && currentPlayer
              ? (currentMatchRoom.player1_id === currentPlayer.id ? gameState.currentPlayer === 1 : gameState.currentPlayer === 2)
              : gameState.currentPlayer === 1;
            
            // 현재 턴인 플레이어의 팀에만 동그라미 표시
            // 온라인 모드: 현재 턴이 1이면 블루팀, 2이면 레드팀에만 표시
            // 로컬 모드: 현재 턴이 1이면 블루팀에만 표시
            const shouldShowCircle = gameState.currentPlayer === 1;
            
            return (
              <div className={`flex items-center gap-3 transition-opacity ${isMyTurn ? 'opacity-100' : 'opacity-60'}`}>
                <div className="relative w-12 h-12 sm:w-16 sm:h-16">
                   <Character player={1} />
                   {shouldShowCircle && (
                     <motion.div 
                       layoutId="active-turn"
                       className="absolute -inset-2 border-4 border-cyan-400 rounded-full"
                       transition={{ type: "spring" }}
                     />
                   )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-400 font-bold uppercase tracking-wider">
                    {config?.mode === 'ONLINE' && currentMatchRoom && currentPlayer && isMyTeam 
                      ? 'You (Blue)' 
                      : 'Blue Team'}
                  </p>
                  {config?.mode === 'ONLINE' && player1Nickname && (
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-slate-500">{player1Nickname}</p>
                      {player1Level !== null && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                          player1Level >= 7 ? 'bg-purple-100 text-purple-700' :
                          player1Level >= 5 ? 'bg-blue-100 text-blue-700' :
                          player1Level >= 3 ? 'bg-green-100 text-green-700' :
                          player1Level >= 1 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          Lv.{player1Level}
                        </span>
                      )}
                      {player1Rank !== null && player1Rank > 0 && (
                        <span className="text-xs font-bold text-slate-400">
                          {player1Rank <= 3 ? (
                            <span className="text-lg">
                              {player1Rank === 1 ? '🥇' : player1Rank === 2 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span>#{player1Rank}</span>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-2xl sm:text-3xl font-black text-slate-800">{gameState.score[1]}</p>
                  {config?.mode === 'ONLINE' && currentMatchRoom?.player1_id && currentMatchRoom?.player2_id && gameState.board.length > 0 && gameInitialized && (
                    <p className={`text-xs font-bold mt-1 ${gameState.currentPlayer === 1 ? 'text-red-500' : 'text-slate-400'}`}>
                      {player1Timer}s
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* VS Badge */}
          <div className="hidden sm:flex flex-col items-center">
            <div className="font-black text-slate-200 text-2xl">VS</div>
            <div className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full mt-1">
              {config.mode === 'AI' ? `Level ${config.difficulty}` : config.mode === 'ONLINE' ? 'Online' : '2 Player'}
            </div>
          </div>

          {/* Player 2 Score (Red) */}
          {(() => {
            const isMyTeam = config?.mode === 'ONLINE' && currentMatchRoom && currentPlayer
              ? currentMatchRoom.player2_id === currentPlayer.id
              : false; // 로컬 모드에서는 플레이어2가 아님
            const isMyTurn = config?.mode === 'ONLINE' && currentMatchRoom && currentPlayer
              ? (currentMatchRoom.player2_id === currentPlayer.id ? gameState.currentPlayer === 2 : gameState.currentPlayer === 1)
              : gameState.currentPlayer === 2;
            
            // 현재 턴인 플레이어의 팀에만 동그라미 표시
            // 현재 턴이 2이면 레드팀에만 표시
            const shouldShowCircle = gameState.currentPlayer === 2;
            
            return (
              <div className={`flex items-center gap-3 flex-row-reverse text-right transition-opacity ${isMyTurn ? 'opacity-100' : 'opacity-60'}`}>
                <div className="relative w-12 h-12 sm:w-16 sm:h-16">
                   <Character player={2} />
                   {shouldShowCircle && (
                     <motion.div 
                       layoutId="active-turn"
                       className="absolute -inset-2 border-4 border-rose-400 rounded-full"
                       transition={{ type: "spring" }}
                     />
                   )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-400 font-bold uppercase tracking-wider">
                    {config.mode === 'AI' 
                      ? 'Robot Team' 
                      : config?.mode === 'ONLINE' && currentMatchRoom && currentPlayer && isMyTeam
                        ? 'You (Red)'
                        : 'Red Team'}
                  </p>
                  {config?.mode === 'ONLINE' && player2Nickname && (
                    <div className="flex items-center gap-1.5 justify-end">
                      {player2Rank !== null && player2Rank > 0 && (
                        <span className="text-xs font-bold text-slate-400">
                          {player2Rank <= 3 ? (
                            <span className="text-lg">
                              {player2Rank === 1 ? '🥇' : player2Rank === 2 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span>#{player2Rank}</span>
                          )}
                        </span>
                      )}
                      {player2Level !== null && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                          player2Level >= 7 ? 'bg-purple-100 text-purple-700' :
                          player2Level >= 5 ? 'bg-blue-100 text-blue-700' :
                          player2Level >= 3 ? 'bg-green-100 text-green-700' :
                          player2Level >= 1 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          Lv.{player2Level}
                        </span>
                      )}
                      <p className="text-xs text-slate-500">{player2Nickname}</p>
                    </div>
                  )}
                  <p className="text-2xl sm:text-3xl font-black text-slate-800">{gameState.score[2]}</p>
                  {config?.mode === 'ONLINE' && currentMatchRoom?.player1_id && currentMatchRoom?.player2_id && gameState.board.length > 0 && gameInitialized && (
                    <p className={`text-xs font-bold mt-1 ${gameState.currentPlayer === 2 ? 'text-red-500' : 'text-slate-400'}`}>
                      {player2Timer}s
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

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
          onClick={() => {
            soundService.playClick();
            if (config?.mode === 'ONLINE' && currentMatchRoom && currentPlayer) {
              // 게임이 초기화되지 않았으면 업데이트하지 않음
              if (!gameInitializedRef.current) {
                console.log('Test button: Game not initialized yet, skipping updateOnlineGame');
                return;
              }
              
              // 온라인 모드: 상대방 턴으로 전환
              const myPlayerNumber = currentMatchRoom.player1_id === currentPlayer.id ? 1 : 2;
              const nextPlayer: Player = myPlayerNumber === 1 ? 2 : 1;
              const nextValidMoves = getValidMoves(gameState.board, nextPlayer);
              
              if (nextValidMoves.length === 0) {
                // 상대방도 움직일 수 없으면 현재 플레이어의 유효한 움직임 확인
                const currentValidMoves = getValidMoves(gameState.board, gameState.currentPlayer);
                if (currentValidMoves.length === 0) {
                  // 둘 다 움직일 수 없으면 게임 종료
                  const finalScore = countScore(gameState.board);
                  const winner = finalScore[1] > finalScore[2] ? 1 : finalScore[1] < finalScore[2] ? 2 : 'draw';
                  if (currentMatchRoom) {
                    updateOnlineGame(
                      currentMatchRoom.id,
                      gameState.board,
                      nextPlayer,
                      winner as Player | null,
                      true
                    );
                  }
                } else {
                  // 현재 플레이어가 움직일 수 있으면 다시 현재 플레이어 턴
                  if (currentMatchRoom) {
                    updateOnlineGame(
                      currentMatchRoom.id,
                      gameState.board,
                      gameState.currentPlayer,
                      null,
                      false
                    );
                  }
                }
              } else {
                // 상대방 턴으로 전환
                if (currentMatchRoom) {
                  updateOnlineGame(
                    currentMatchRoom.id,
                    gameState.board,
                    nextPlayer,
                    null,
                    false
                  );
                }
              }
            } else {
              // 로컬 모드: 상대방 턴으로 전환
              const nextPlayer: Player = gameState.currentPlayer === 1 ? 2 : 1;
              const nextValidMoves = getValidMoves(gameState.board, nextPlayer);
              
              if (nextValidMoves.length === 0) {
                // 상대방도 움직일 수 없으면 현재 플레이어의 유효한 움직임 확인
                const currentValidMoves = getValidMoves(gameState.board, gameState.currentPlayer);
                if (currentValidMoves.length === 0) {
                  // 둘 다 움직일 수 없으면 게임 종료
                  const finalScore = countScore(gameState.board);
                  const winner = finalScore[1] > finalScore[2] ? 1 : finalScore[1] < finalScore[2] ? 2 : 'draw';
                  soundService.playWin();
                  setGameState(prev => ({
                    ...prev,
                    board: gameState.board,
                    isGameOver: true,
                    winner: winner,
                    score: finalScore
                  }));
                  handleGameEnd(winner, finalScore, config, currentPlayer, currentMatchRoom);
                } else {
                  // 현재 플레이어가 움직일 수 있으면 다시 현재 플레이어 턴
                  setNotification(`Player ${gameState.currentPlayer === 1 ? 'Blue' : 'Red'} has no moves! Skipped.`);
                  setTimeout(() => setNotification(null), 2500);
                }
              } else {
                // 상대방 턴으로 전환
                setGameState(prev => ({
                  ...prev,
                  currentPlayer: nextPlayer,
                  validMovesForCurrentPlayer: nextValidMoves,
                  score: countScore(gameState.board)
                }));
                setNotification(`Player ${nextPlayer === 1 ? 'Blue' : 'Red'}'s Turn`);
                setTimeout(() => setNotification(null), 2000);
              }
            }
          }}
          className="flex items-center gap-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold px-4 py-2 rounded-xl transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Skip Turn
        </button>
      </div>

      {/* Tutorial Modal - 게임 중 표시 */}
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
              

              <div className="relative z-10">
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
                  {gameState.winner === 'draw' ? 'It\'s a Tie!' : 
                   gameState.winner === 1 ? 'Blue Team Wins!' : 'Red Team Wins!'}
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
                      Final Score
                    </p>
                    <div className="flex items-center justify-center gap-8">
                      {/* Player 1 Score */}
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <div 
                            className="flex-shrink-0 overflow-visible flex items-center justify-center transition-all duration-300"
                            style={{
                              width: gameState.winner === 1 ? '64px' : '52px',
                              height: gameState.winner === 1 ? '64px' : '52px'
                            }}
                          >
                            <div className="w-full h-full">
                              <Character player={1} />
                            </div>
                          </div>
                          <span className="text-xs font-bold text-slate-500">Blue</span>
                        </div>
                        <motion.div
                          className={`text-4xl font-black ${
                            gameState.winner === 1 ? 'text-cyan-600 scale-110' : 'text-slate-700'
                          } transition-transform`}
                          initial={{ scale: 0 }}
                          animate={{ scale: gameState.winner === 1 ? 1.1 : 1 }}
                          transition={{ delay: 0.9, type: "spring" }}
                        >
                          {gameState.score[1]}
                        </motion.div>
                      </div>

                      {/* VS */}
                      <div className="text-2xl font-black text-slate-300">VS</div>

                      {/* Player 2 Score */}
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <div 
                            className="flex-shrink-0 overflow-visible flex items-center justify-center transition-all duration-300"
                            style={{
                              width: gameState.winner === 2 ? '64px' : '52px',
                              height: gameState.winner === 2 ? '64px' : '52px'
                            }}
                          >
                            <div className="w-full h-full">
                              <Character player={2} />
                            </div>
                          </div>
                          <span className="text-xs font-bold text-slate-500">
                            {config.mode === 'AI' ? 'AI' : 'Red'}
                          </span>
                        </div>
                        <motion.div
                          className={`text-4xl font-black ${
                            gameState.winner === 2 ? 'text-rose-600 scale-110' : 'text-slate-700'
                          } transition-transform`}
                          initial={{ scale: 0 }}
                          animate={{ scale: gameState.winner === 2 ? 1.1 : 1 }}
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
                            {gameState.winner === 1 ? 'Blue' : config.mode === 'AI' ? 'AI' : 'Red'} Team
                          </span>
                          {' '}captured {gameState.score[gameState.winner as Player]} cells!
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
                  {/* 온라인 모드에서는 Play Again 버튼 숨김 (두 플레이어 동의 필요) */}
                  {/* 상대방이 나간 경우에도 Play Again 숨김 */}
                  {config.mode !== 'ONLINE' && (
                    <button 
                      onClick={() => startGame(config.mode, config.difficulty)}
                      className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 hover:scale-105 active:scale-100 transition-all text-lg"
                    >
                      Play Again
                    </button>
                  )}
                  <button 
                    onClick={returnToMenu}
                    className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Back to Menu
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

// Nickname Input Component
const NicknameInput: React.FC<{ onSubmit: (nickname: string) => void }> = ({ onSubmit }) => {
  const [nickname, setNickname] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(nickname);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="닉네임을 입력하세요"
        maxLength={20}
        className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-indigo-500 focus:outline-none text-center text-lg font-bold"
        autoFocus
      />
      <button
        type="submit"
        className="w-full bg-indigo-500 text-white font-black py-4 rounded-xl shadow-lg hover:bg-indigo-600 transition-all text-lg"
      >
        시작하기
      </button>
    </form>
  );
};

export default App;