import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Users, Loader } from 'lucide-react';
import { createMatchRoom, findMatchRoomByCode, joinMatchRoom, MatchRoom, PlayerRecord, subscribeToMatchRoom, getPlayerNickname, getPlayerRank, leaveMatchRoom, getPlayerLevel } from '../services/backend';
import Character from './Character';

interface MatchRoomProps {
  onClose: () => void;
  currentPlayer: PlayerRecord;
  onRoomReady: (room: MatchRoom) => void;
}

const MatchRoomComponent: React.FC<MatchRoomProps> = ({ onClose, currentPlayer, onRoomReady }) => {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [inviteCode, setInviteCode] = useState('');
  const [room, setRoom] = useState<MatchRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [player1Nickname, setPlayer1Nickname] = useState<string | null>(null);
  const [player2Nickname, setPlayer2Nickname] = useState<string | null>(null);
  const [player1Rank, setPlayer1Rank] = useState<number | null>(null);
  const [player2Rank, setPlayer2Rank] = useState<number | null>(null);
  const [player1Level, setPlayer1Level] = useState<number | null>(null);
  const [player2Level, setPlayer2Level] = useState<number | null>(null);

  const handleCreateRoom = async () => {
    try {
      setLoading(true);
      setError(null);
      const newRoom = await createMatchRoom(currentPlayer.id);
      setRoom(newRoom);
    } catch (err: any) {
      setError(err.message || '방 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!inviteCode.trim()) {
      setError('초대코드를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const foundRoom = await findMatchRoomByCode(inviteCode.trim().toUpperCase());

      if (!foundRoom) {
        setError('존재하지 않는 초대코드입니다.');
        return;
      }

      if (foundRoom.status !== 'waiting') {
        setError('이미 시작되었거나 종료된 게임입니다.');
        return;
      }

      if (foundRoom.player1_id === currentPlayer.id) {
        setError('자신이 만든 방에는 참가할 수 없습니다.');
        return;
      }

      if (foundRoom.player2_id) {
        setError('이미 참가자가 있는 방입니다.');
        return;
      }

      // 방에 참가
      const updatedRoom = await joinMatchRoom(foundRoom.id, currentPlayer.id);
      setRoom(updatedRoom);
      // 플레이어2는 참가만 하고, 게임 시작은 두 플레이어 모두 버튼을 눌러야 함
    } catch (err: any) {
      setError(err.message || '방 참가 실패');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (room?.invite_code) {
      await navigator.clipboard.writeText(room.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 플레이어 닉네임 및 랭킹 로드
  useEffect(() => {
    if (!room) return;

    const loadNicknamesAndRanks = async () => {
      if (room.player1_id) {
        // 현재 플레이어인 경우 currentPlayer에서 닉네임 가져오기
        if (room.player1_id === currentPlayer.id) {
          setPlayer1Nickname(currentPlayer.nickname);
        } else {
          const nickname = await getPlayerNickname(room.player1_id);
          setPlayer1Nickname(nickname);
        }
        try {
          const [rank, level] = await Promise.all([
            getPlayerRank(room.player1_id, 'pvp'),
            getPlayerLevel(room.player1_id, 'pvp')
          ]);
          setPlayer1Rank(rank);
          setPlayer1Level(level);
        } catch (error) {
          console.error('Failed to load player1 rank:', error);
          setPlayer1Rank(null);
          setPlayer1Level(null);
        }
      }
      if (room.player2_id) {
        // 현재 플레이어인 경우 currentPlayer에서 닉네임 가져오기
        if (room.player2_id === currentPlayer.id) {
          setPlayer2Nickname(currentPlayer.nickname);
        } else {
          const nickname = await getPlayerNickname(room.player2_id);
          setPlayer2Nickname(nickname);
        }
        try {
          const [rank, level] = await Promise.all([
            getPlayerRank(room.player2_id, 'pvp'),
            getPlayerLevel(room.player2_id, 'pvp')
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
  }, [room?.player1_id, room?.player2_id, currentPlayer.id, currentPlayer.nickname]);

  // 이전 방 상태를 추적하기 위한 ref
  const prevRoomRef = useRef<MatchRoom | null>(null);
  
  // 방 상태 실시간 구독
  useEffect(() => {
    if (!room?.id) return;
    
    const roomId = room.id; // 의존성 배열에서 room 객체 전체를 참조하지 않도록
    console.log('MatchRoom 구독 시작:', roomId);
    console.log('구독 시작 시점의 방 상태:', {
      player1_id: room.player1_id,
      player2_id: room.player2_id,
      status: room.status
    });
    
    // 현재 방 상태를 ref에 저장 (구독 시작 시점의 상태)
    // 중요: 구독 시작 시점에 player2_id가 있어도, 이것은 이전 세션의 데이터일 수 있으므로
    // 실제로 플레이어2가 방금 입장했는지는 첫 번째 업데이트에서 확인해야 함
    prevRoomRef.current = { ...room };
    
    const unsubscribe = subscribeToMatchRoom(roomId, async (updatedRoom) => {
      // 방이 삭제된 경우 (플레이어1이 나간 경우)
      if (!updatedRoom) {
        console.log('Room was deleted (player1 left)');
        setRoom(null);
        setPlayer1Nickname(null);
        setPlayer2Nickname(null);
        setPlayer1Rank(null);
        setPlayer2Rank(null);
        setError('방이 삭제되었습니다. 방을 만든 플레이어가 나갔습니다.');
        // 3초 후 모달 닫기
        setTimeout(() => {
          onClose();
        }, 3000);
        return;
      }
      
      console.log('MatchRoom 상태 업데이트 수신:', updatedRoom);
      console.log('현재 플레이어:', currentPlayer.id);
      console.log('이전 방 정보:', {
        player1_id: prevRoomRef.current?.player1_id,
        player2_id: prevRoomRef.current?.player2_id,
        status: prevRoomRef.current?.status
      });
      console.log('업데이트된 방 정보:', {
        player1_id: updatedRoom.player1_id,
        player2_id: updatedRoom.player2_id,
        status: updatedRoom.status
      });
      
      const prevRoom = prevRoomRef.current;
      
      // 플레이어1 상태 업데이트
      if (updatedRoom.player1_id) {
        if (!prevRoom?.player1_id || updatedRoom.player1_id !== prevRoom.player1_id) {
          // 새로 참가하거나 변경된 경우
          const nickname = await getPlayerNickname(updatedRoom.player1_id);
          setPlayer1Nickname(nickname);
          try {
            const [rank, level] = await Promise.all([
              getPlayerRank(updatedRoom.player1_id, 'pvp'),
              getPlayerLevel(updatedRoom.player1_id, 'pvp')
            ]);
            setPlayer1Rank(rank);
            setPlayer1Level(level);
          } catch (error) {
            console.error('Failed to load player1 rank:', error);
            setPlayer1Rank(null);
            setPlayer1Level(null);
          }
        }
      } else if (prevRoom?.player1_id) {
        // 플레이어1이 나간 경우 (이전에 있었는데 지금 없음)
        console.log('Player 1 left the room');
        setPlayer1Nickname(null);
        setPlayer1Rank(null);
        setPlayer1Level(null);
      }
      
      // 플레이어2 상태 업데이트
      if (updatedRoom.player2_id) {
        // 플레이어2가 있는 경우
        if (!prevRoom?.player2_id || updatedRoom.player2_id !== prevRoom.player2_id) {
          // 새로 참가하거나 변경된 경우
          console.log('Player 2 joined or changed');
          const nickname = await getPlayerNickname(updatedRoom.player2_id);
          setPlayer2Nickname(nickname);
          try {
            const [rank, level] = await Promise.all([
              getPlayerRank(updatedRoom.player2_id, 'pvp'),
              getPlayerLevel(updatedRoom.player2_id, 'pvp')
            ]);
            setPlayer2Rank(rank);
            setPlayer2Level(level);
          } catch (error) {
            console.error('Failed to load player2 rank:', error);
            setPlayer2Rank(null);
            setPlayer2Level(null);
          }
          
          // 플레이어2가 방에 입장했고, 두 플레이어가 모두 입장했으며, 방 상태가 'playing'이면 자동으로 게임 시작
          // 하지만 실제로 플레이어2가 현재 세션에서 입장했는지 확인 (이전에 없었는데 지금 생긴 경우만)
          // 그리고 플레이어2 닉네임이 로드된 후에만 게임 시작
          // 중요: prevRoom이 없거나 player2_id가 없었는데 지금 생긴 경우만 true
          // Boolean 변환: && 연산자는 첫 번째가 truthy면 두 번째 값을 반환하므로, 명시적으로 boolean으로 변환 필요
          const player2JustJoined = !!(!prevRoom?.player2_id && updatedRoom.player2_id);
          
          console.log('Player 2 join check:', {
            prevRoomPlayer2Id: prevRoom?.player2_id,
            updatedRoomPlayer2Id: updatedRoom.player2_id,
            player2JustJoined,
            player2JustJoinedType: typeof player2JustJoined,
            note: 'player2JustJoined should be true only if player2 was not in prevRoom but is in updatedRoom'
          });
          
          // 플레이어2가 방에 입장했을 때 (플레이어2 관점)
          // 플레이어2도 자동으로 게임을 시작하지 않음 - 플레이어1이 "게임 시작하기" 버튼을 클릭해야 함
          // 또는 플레이어1이 이미 게임을 시작한 경우에만 플레이어2가 자동으로 게임에 참여
          if (updatedRoom.status === 'playing' && updatedRoom.player1_id && updatedRoom.player2_id && nickname && currentPlayer.id === updatedRoom.player2_id && player2JustJoined) {
            console.log('Player 2: Joined room, but not auto-starting. Waiting for player1 to start the game.', {
              player1_id: updatedRoom.player1_id,
              player2_id: updatedRoom.player2_id,
              player2Nickname: nickname,
              roomId: updatedRoom.id,
              note: 'Player2 should wait for player1 to click "Start Game" button or for game to be already started'
            });
            // 자동 시작하지 않음 - 플레이어1이 게임을 시작하거나, 이미 게임이 시작된 경우에만 참여
          } else if (updatedRoom.status === 'playing' && updatedRoom.player1_id && updatedRoom.player2_id && currentPlayer.id === updatedRoom.player2_id && !player2JustJoined) {
            console.log('Player 2 already in room, not auto-starting (may be old data)');
          } else if (updatedRoom.status === 'playing' && updatedRoom.player1_id && updatedRoom.player2_id && currentPlayer.id === updatedRoom.player2_id && !nickname) {
            console.log('Player 2 joined but nickname not loaded yet, waiting...');
          }
          
          // 플레이어1이 방을 생성했고 플레이어2가 입장했을 때 (플레이어1 관점)
          // 플레이어2 닉네임이 로드되었고, 플레이어2가 방금 입장했을 때만 자동 시작
          const isPlayer1 = currentPlayer.id === updatedRoom.player1_id;
          const roomStatusPlaying = updatedRoom.status === 'playing';
          const bothPlayersPresent = !!(updatedRoom.player1_id && updatedRoom.player2_id);
          const hasNickname = !!nickname;
          
          // 추가 확인: 플레이어1이 방을 생성한 직후가 아닌지 확인
          // prevRoom이 없거나 player1_id가 없었던 경우는 방을 방금 생성한 경우일 수 있음
          const roomJustCreated = !prevRoom || !prevRoom.player1_id;
          
          console.log('Player 1 auto-start check:', {
            isPlayer1,
            roomStatusPlaying,
            bothPlayersPresent,
            hasNickname,
            player2JustJoined,
            roomJustCreated,
            currentPlayerId: currentPlayer.id,
            roomPlayer1Id: updatedRoom.player1_id,
            roomPlayer2Id: updatedRoom.player2_id,
            roomStatus: updatedRoom.status,
            roomId: updatedRoom.id,
            prevRoomPlayer1Id: prevRoom?.player1_id,
            prevRoomPlayer2Id: prevRoom?.player2_id
          });
          
          // 플레이어1이 방을 방금 생성한 경우에는 자동 시작하지 않음
          // 플레이어2가 실제로 입장했을 때만 자동 시작
          // 추가 확인: 플레이어2가 실제로 게임에 참여할 준비가 되었는지 확인
          // 플레이어2가 초대코드만 입력하고 아직 게임 화면에 진입하지 않았을 수 있으므로,
          // 플레이어1은 자동으로 게임을 시작하지 않고 "게임 시작하기" 버튼을 클릭하도록 함
          // 또는 플레이어2가 실제로 게임에 참여할 준비가 되었을 때만 시작
          
          // 플레이어1은 자동으로 게임을 시작하지 않음 (플레이어2가 실제로 준비되었는지 확인 불가)
          // 대신 "게임 시작하기" 버튼을 표시하여 수동으로 시작하도록 함
          if (roomStatusPlaying && bothPlayersPresent && isPlayer1 && player2JustJoined && !roomJustCreated) {
            console.log('Player 1: Player2 joined, but not auto-starting. Player1 should click "Start Game" button manually.', {
              player1_id: updatedRoom.player1_id,
              player2_id: updatedRoom.player2_id,
              player2Nickname: nickname,
              roomId: updatedRoom.id,
              note: 'Auto-start disabled to prevent starting before player2 is ready'
            });
            // 자동 시작하지 않음 - 플레이어1이 수동으로 시작 버튼을 클릭해야 함
          } else if (roomStatusPlaying && bothPlayersPresent && isPlayer1 && !hasNickname && player2JustJoined && !roomJustCreated) {
            console.log('Player 1: Player2 just joined but nickname not loaded yet, waiting...', {
              player2_id: updatedRoom.player2_id,
              nickname
            });
          } else if (roomStatusPlaying && bothPlayersPresent && isPlayer1 && !player2JustJoined) {
            console.log('Player 1: Player2 already in room, not auto-starting (may be old data or already started)');
          } else if (isPlayer1 && roomJustCreated && bothPlayersPresent) {
            console.log('Player 1: Room just created, not auto-starting (waiting for player2 to actually join)');
          } else if (isPlayer1 && (!roomStatusPlaying || !bothPlayersPresent)) {
            console.log('Player 1: Conditions not met for auto-start', {
              roomStatusPlaying,
              bothPlayersPresent,
              hasNickname,
              player2JustJoined,
              roomJustCreated
            });
          }
        }
      } else if (prevRoom?.player2_id) {
        // 플레이어2가 나간 경우 (이전에 있었는데 지금 없음)
        console.log('Player 2 left the room - clearing player2 data');
        setPlayer2Nickname(null);
        setPlayer2Rank(null);
        setPlayer2Level(null);
      } else if (!updatedRoom.player2_id && !prevRoom?.player2_id) {
        // 처음부터 없었던 경우
        setPlayer2Nickname(null);
        setPlayer2Rank(null);
      }
      
      // ref 업데이트 (다음 업데이트를 위해)
      prevRoomRef.current = updatedRoom;
      
      // 항상 업데이트 (React가 변경을 감지하도록)
      setRoom(updatedRoom);
      console.log('MatchRoom 상태 업데이트 완료:', updatedRoom);
    });

    return () => {
      console.log('MatchRoom 구독 해제:', roomId);
      unsubscribe();
    };
  }, [room?.id]); // room.id만 의존성으로 사용 (currentPlayer는 콜백 내에서 참조)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col border-4 border-indigo-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 p-6 text-white relative">
          <button
            onClick={async () => {
              // 방에 참가한 상태에서 나가는 경우 방에서 제거
              if (room && (room.player1_id === currentPlayer.id || room.player2_id === currentPlayer.id)) {
                try {
                  console.log('Leaving room from MatchRoom component:', room.id, currentPlayer.id);
                  await leaveMatchRoom(room.id, currentPlayer.id);
                } catch (error) {
                  console.error('Failed to leave room:', error);
                }
              }
              onClose();
            }}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-8 h-8" />
            <h2 className="text-3xl font-black">대전게임</h2>
          </div>

          {/* 탭 */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setMode('create');
                setRoom(null);
                setError(null);
              }}
              className={`px-6 py-2 rounded-xl font-bold transition-all ${
                mode === 'create'
                  ? 'bg-white text-indigo-600 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              방 만들기
            </button>
            <button
              onClick={() => {
                setMode('join');
                setRoom(null);
                setError(null);
              }}
              className={`px-6 py-2 rounded-xl font-bold transition-all ${
                mode === 'join'
                  ? 'bg-white text-indigo-600 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              초대코드 입력
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          <AnimatePresence mode="wait">
            {!room ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {mode === 'create' ? (
                  <>
                    <p className="text-slate-600 text-center mb-6">
                      대전 방을 만들면 초대코드가 생성됩니다.
                      <br />
                      친구에게 초대코드를 공유하여 함께 플레이하세요!
                    </p>
                    <button
                      onClick={handleCreateRoom}
                      disabled={loading}
                      className="w-full bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          생성 중...
                        </>
                      ) : (
                        '방 만들기'
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-slate-600 text-center mb-6">
                      친구에게 받은 초대코드를 입력하세요.
                    </p>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => {
                        setInviteCode(e.target.value.toUpperCase());
                        setError(null);
                      }}
                      placeholder="초대코드 입력 (예: ABC123)"
                      maxLength={6}
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-indigo-500 focus:outline-none text-center text-2xl font-black tracking-widest uppercase"
                    />
                    <button
                      onClick={handleJoinRoom}
                      disabled={loading || !inviteCode.trim()}
                      className="w-full bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          참가 중...
                        </>
                      ) : (
                        '참가하기'
                      )}
                    </button>
                  </>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-100 text-rose-700 px-4 py-3 rounded-xl text-sm font-bold"
                  >
                    {error}
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="room"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6"
              >
                <div>
                  <p className="text-slate-600 mb-2">초대코드</p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="bg-indigo-100 px-6 py-4 rounded-xl">
                      <p className="text-4xl font-black text-indigo-700 tracking-widest">
                        {room.invite_code}
                      </p>
                    </div>
                    <button
                      onClick={copyToClipboard}
                      className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      title="복사"
                    >
                      {copied ? (
                        <Check className="w-6 h-6 text-green-600" />
                      ) : (
                        <Copy className="w-6 h-6 text-slate-600" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-center gap-3">
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                      <Character player={1} />
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-2">
                      <p className="font-bold text-slate-800 text-lg">
                        {room.player1_id === currentPlayer.id 
                          ? currentPlayer.nickname 
                          : player1Nickname || '로딩 중...'}
                      </p>
                      {player1Rank !== null && player1Rank > 0 && (
                        <span className="text-sm font-bold text-slate-400">
                          {player1Rank <= 3 ? (
                            <span className="text-xl">
                              {player1Rank === 1 ? '🥇' : player1Rank === 2 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span>#{player1Rank}</span>
                          )}
                        </span>
                      )}
                      {player1Level !== null && (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          player1Level >= 7 ? 'bg-purple-100 text-purple-700' :
                          player1Level >= 5 ? 'bg-blue-100 text-blue-700' :
                          player1Level >= 3 ? 'bg-green-100 text-green-700' :
                          player1Level >= 1 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          Lv.{player1Level}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-center gap-3">
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                      <Character player={2} />
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-2">
                      <p className="font-bold text-slate-800 text-lg">
                        {room.player2_id === currentPlayer.id
                          ? currentPlayer.nickname
                          : room.player2_id
                          ? (player2Nickname || '로딩 중...')
                          : '대기 중...'}
                      </p>
                      {room.player2_id && player2Rank !== null && player2Rank > 0 && (
                        <span className="text-sm font-bold text-slate-400">
                          {player2Rank <= 3 ? (
                            <span className="text-xl">
                              {player2Rank === 1 ? '🥇' : player2Rank === 2 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span>#{player2Rank}</span>
                          )}
                        </span>
                      )}
                      {room.player2_id && player2Level !== null && (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          player2Level >= 7 ? 'bg-purple-100 text-purple-700' :
                          player2Level >= 5 ? 'bg-blue-100 text-blue-700' :
                          player2Level >= 3 ? 'bg-green-100 text-green-700' :
                          player2Level >= 1 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          Lv.{player2Level}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {room.status === 'playing' && room.player2_id && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="bg-green-100 text-green-700 px-4 py-3 rounded-xl font-bold">
                      {room.player1_id === currentPlayer.id 
                        ? '상대방이 참가했습니다! 게임을 시작하세요.'
                        : '게임 시작 준비 완료!'}
                    </div>
                    <button
                      onClick={() => onRoomReady(room)}
                      disabled={!room.player1_id || !room.player2_id}
                      className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all ${
                        room.player1_id && room.player2_id
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {room.player1_id && room.player2_id ? '게임 시작하기' : '상대방 입장 대기 중...'}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default MatchRoomComponent;

