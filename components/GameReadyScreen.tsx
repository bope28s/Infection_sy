import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader } from 'lucide-react';
import { MatchRoom, PlayerRecord, subscribeToMatchRoom, setPlayerReady, getPlayerNickname } from '../services/backend';
import Character from './Character';

interface GameReadyScreenProps {
  room: MatchRoom;
  currentPlayer: PlayerRecord;
  player1Nickname: string | null;
  player2Nickname: string | null;
  onBothReady: () => void;
  onCancel: () => void;
  onOpponentLeft?: () => void; // 상대방이 나갔을 때 호출되는 콜백
}

const GameReadyScreen: React.FC<GameReadyScreenProps> = ({
  room: initialRoom,
  currentPlayer,
  player1Nickname: initialPlayer1Nickname,
  player2Nickname: initialPlayer2Nickname,
  onBothReady,
  onCancel,
  onOpponentLeft
}) => {
  const [room, setRoom] = useState<MatchRoom>(initialRoom);
  const [player1Nickname, setPlayer1Nickname] = useState<string | null>(initialPlayer1Nickname);
  const [player2Nickname, setPlayer2Nickname] = useState<string | null>(initialPlayer2Nickname);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const roomRef = useRef<MatchRoom>(initialRoom);
  const countdownRef = useRef<number | null>(null);
  const onCancelRef = useRef(onCancel);
  const onOpponentLeftRef = useRef(onOpponentLeft);

  // 현재 플레이어가 플레이어1인지 플레이어2인지 확인

  // 준비 버튼 클릭
  const handleReady = async () => {
    try {
      const updatedRoom = await setPlayerReady(room.id, currentPlayer.id, true);
      // 즉시 로컬 상태 업데이트
      setRoom(updatedRoom);
      roomRef.current = updatedRoom;
      setIsReady(true);
    } catch (error: any) {
      console.error('Failed to set ready status:', error);
      alert(error.message || '준비 상태 설정에 실패했습니다.');
    }
  };

  // 준비 취소
  const handleCancelReady = async () => {
    try {
      const updatedRoom = await setPlayerReady(room.id, currentPlayer.id, false);
      // 즉시 로컬 상태 업데이트
      setRoom(updatedRoom);
      roomRef.current = updatedRoom;
      setIsReady(false);
      setCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    } catch (error: any) {
      console.error('Failed to cancel ready status:', error);
    }
  };

  // onCancel ref 업데이트
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  // onOpponentLeft ref 업데이트
  useEffect(() => {
    onOpponentLeftRef.current = onOpponentLeft;
  }, [onOpponentLeft]);

  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  // 초기 room 상태 설정 및 준비 상태 확인
  useEffect(() => {
    setRoom(initialRoom);
    roomRef.current = initialRoom;
    const currentReadyStatus = initialRoom.player1_id === currentPlayer.id 
      ? initialRoom.player1_ready === true
      : initialRoom.player2_ready === true;
    setIsReady(currentReadyStatus);
  }, [initialRoom, currentPlayer.id]);

  // 닉네임 로드
  useEffect(() => {
    const loadNicknames = async () => {
      // 플레이어1 닉네임 로드
      if (room.player1_id && room.player1_id !== currentPlayer.id) {
        try {
          const nickname = await getPlayerNickname(room.player1_id);
          setPlayer1Nickname(nickname);
        } catch (error) {
          console.error('Failed to load player1 nickname:', error);
        }
      } else if (room.player1_id === currentPlayer.id) {
        setPlayer1Nickname(currentPlayer.nickname);
      }

      // 플레이어2 닉네임 로드
      if (room.player2_id && room.player2_id !== currentPlayer.id) {
        try {
          const nickname = await getPlayerNickname(room.player2_id);
          setPlayer2Nickname(nickname);
        } catch (error) {
          console.error('Failed to load player2 nickname:', error);
        }
      } else if (room.player2_id === currentPlayer.id) {
        setPlayer2Nickname(currentPlayer.nickname);
      }
    };

    loadNicknames();
  }, [room.player1_id, room.player2_id, currentPlayer.id, currentPlayer.nickname]);

  // 실시간 구독으로 두 플레이어 준비 상태 확인
  useEffect(() => {
    if (!room?.id) return;

    const unsubscribe = subscribeToMatchRoom(room.id, (updatedRoom) => {
      // 방이 삭제되었거나 상대방이 나갔을 때
      if (!updatedRoom) {
        // 상대방이 나갔음을 알리고 준비 화면 닫기
        if (onOpponentLeftRef.current) {
          onOpponentLeftRef.current();
        }
        onCancelRef.current();
        return;
      }

      // 상대방이 나갔는지 확인 (player1이 나갔거나 player2가 나갔을 때)
      const prevRoom = roomRef.current;
      const wasPlayer1 = prevRoom.player1_id !== null;
      const wasPlayer2 = prevRoom.player2_id !== null;
      const isPlayer1Now = updatedRoom.player1_id !== null;
      const isPlayer2Now = updatedRoom.player2_id !== null;

      // 자신이 나간 경우는 처리하지 않음
      const myPlayerId = currentPlayer.id;
      const iLeft = 
        (prevRoom.player1_id === myPlayerId && !isPlayer1Now) ||
        (prevRoom.player2_id === myPlayerId && !isPlayer2Now);

      // 상대방이 나갔는지 확인 (플레이어1이 나갔거나 플레이어2가 나갔을 때, 하지만 자신이 나간 경우는 제외)
      const opponentLeft = 
        ((wasPlayer1 && !isPlayer1Now) && prevRoom.player1_id !== myPlayerId) ||
        ((wasPlayer2 && !isPlayer2Now) && prevRoom.player2_id !== myPlayerId);

      // 상대방이 나갔을 때만 처리
      if (opponentLeft && !iLeft) {
        // 상대방이 나갔음을 알리고 준비 화면 닫기
        if (onOpponentLeftRef.current) {
          onOpponentLeftRef.current();
        }
        onCancelRef.current();
        return;
      }

      // room 상태 업데이트
      setRoom(updatedRoom);
      roomRef.current = updatedRoom;

      const bothReady = updatedRoom.player1_ready === true && updatedRoom.player2_ready === true;
      const currentReadyStatus = updatedRoom.player1_id === currentPlayer.id
        ? updatedRoom.player1_ready === true
        : updatedRoom.player2_ready === true;

      // 내 준비 상태 업데이트
      setIsReady(currentReadyStatus || false);

      // 두 플레이어 모두 준비되었고 카운트다운이 시작되지 않았으면 카운트다운 시작
      if (bothReady && countdownRef.current === null) {
        setCountdown(5);
      } else if (!bothReady && countdownRef.current !== null) {
        // 한 명이 준비 취소하면 카운트다운 중지
        setCountdown(null);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [room?.id, currentPlayer.id]);

  // 카운트다운 처리
  useEffect(() => {
    if (countdown === null) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    if (countdown === 0) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      onBothReady();
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [countdown, onBothReady]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col border-4 border-indigo-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 p-6 text-white text-center">
          <h2 className="text-3xl font-black mb-2">게임 준비</h2>
          <p className="text-sm opacity-90">
            두 플레이어가 모두 준비하면 게임이 시작됩니다
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6">
          {/* 플레이어1 상태 */}
          <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                <Character player={1} />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg">
                  {room.player1_id === currentPlayer.id 
                    ? currentPlayer.nickname 
                    : (player1Nickname || '로딩 중...')}
                </p>
                {room.player1_id === currentPlayer.id && (
                  <p className="text-xs text-slate-500">나</p>
                )}
              </div>
            </div>
            <div className="flex items-center">
              {room.player1_ready === true ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <div className="w-8 h-8 border-2 border-slate-300 rounded-full" />
              )}
            </div>
          </div>

          {/* 플레이어2 상태 */}
          <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                <Character player={2} />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg">
                  {room.player2_id === currentPlayer.id 
                    ? currentPlayer.nickname 
                    : (player2Nickname || '로딩 중...')}
                </p>
                {room.player2_id === currentPlayer.id && (
                  <p className="text-xs text-slate-500">나</p>
                )}
              </div>
            </div>
            <div className="flex items-center">
              {room.player2_ready === true ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <div className="w-8 h-8 border-2 border-slate-300 rounded-full" />
              )}
            </div>
          </div>

          {/* 카운트다운 */}
          <AnimatePresence>
            {countdown !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-center"
              >
                <div className="text-6xl font-black text-indigo-600 mb-2">
                  {countdown}
                </div>
                <p className="text-lg font-bold text-slate-600">
                  게임 시작까지...
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 버튼 */}
          <div className="flex gap-3">
            {isReady ? (
              <button
                onClick={handleCancelReady}
                className="flex-1 bg-slate-200 text-slate-700 font-bold py-4 rounded-xl shadow-lg hover:bg-slate-300 transition-all"
              >
                준비 취소
              </button>
            ) : (
              <button
                onClick={handleReady}
                disabled={countdown !== null}
                className="flex-1 bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {countdown !== null ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    대기 중...
                  </>
                ) : (
                  '준비 완료'
                )}
              </button>
            )}
            <button
              onClick={onCancel}
              disabled={countdown !== null}
              className="flex-1 bg-rose-100 text-rose-700 font-bold py-4 rounded-xl shadow-lg hover:bg-rose-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              나가기
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default GameReadyScreen;

