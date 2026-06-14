import { supabase } from '../lib/supabase';

// 타입 정의
export interface PlayerRecord {
  id: string;
  nickname: string;
  pvp_wins: number;
  point_score: number;
  is_online?: boolean;
  created_at: string;
  updated_at: string;
}

export interface MatchRoom {
  id: string;
  invite_code: string;
  player1_id: string | null;
  player2_id: string | null;
  status: 'waiting' | 'playing' | 'finished' | 'cancelled';
  player1_ready?: boolean;
  player2_ready?: boolean;
  created_at: string;
  updated_at: string;
}

export interface RankingEntry {
  nickname: string;
  score: number;
  rank: number;
  medal?: 'gold' | 'silver' | 'bronze';
  level: number;
}

import { CellState } from '../types';

export interface OnlineGame {
  id: string;
  room_id: string;
  board_state: CellState[][];
  current_player: 1 | 2;
  winner: 1 | 2 | null;
  is_game_over: boolean;
  created_at: string;
  updated_at: string;
}

function normalizeOnlineGame(game: any): OnlineGame {
  return {
    ...game,
    board_state: game.board_state as CellState[][],
    current_player: game.current_player as 1 | 2,
    winner: game.winner as 1 | 2 | null
  };
}

// 닉네임으로 플레이어 가져오기 또는 생성
export async function getOrCreatePlayer(nickname: string): Promise<PlayerRecord> {
  // 먼저 기존 플레이어 확인
  const { data: existingPlayer, error: fetchError } = await supabase
    .from('players')
    .select('*')
    .eq('nickname', nickname)
    .single();

  if (existingPlayer && !fetchError) {
    // 이미 온라인인 플레이어가 있으면 중복 로그인 방지
    // 단, 마지막 업데이트 시간이 1분 이상 지났으면 자동으로 오프라인 처리
    console.log('Checking existing player:', { nickname, is_online: existingPlayer.is_online, playerId: existingPlayer.id, updated_at: existingPlayer.updated_at });
    
    if (existingPlayer.is_online === true) {
      // 마지막 업데이트 시간 확인
      const lastUpdate = new Date(existingPlayer.updated_at);
      const now = new Date();
      const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
      
      // 1분 이상 지났으면 자동으로 오프라인 처리
      if (minutesSinceUpdate >= 1) {
        console.log('Player was online but inactive for', minutesSinceUpdate, 'minutes. Auto-logging out.');
        const { error: updateError } = await supabase
          .from('players')
          .update({ is_online: false })
          .eq('id', existingPlayer.id);
        
        if (updateError) {
          console.error('Failed to auto-logout inactive player:', updateError);
        }
      } else {
        // 아직 활성 상태면 중복 로그인 방지
        console.log('Duplicate login attempt detected for:', nickname);
        throw new Error('이미 접속 중인 닉네임입니다. 다른 닉네임을 사용해주세요.');
      }
    }
    
    // is_online을 true로 설정
    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .update({ is_online: true })
      .eq('id', existingPlayer.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`로그인 상태 업데이트 실패: ${updateError.message}`);
    }

    return updatedPlayer;
  }

  // 없으면 새로 생성 (is_online을 true로 설정)
  const { data: newPlayer, error: createError } = await supabase
    .from('players')
    .insert({ nickname, is_online: true })
    .select()
    .single();

  if (createError) {
    throw new Error(`플레이어 생성 실패: ${createError.message}`);
  }

  return newPlayer;
}

// 플레이어 로그아웃 처리 (is_online을 false로 설정)
export async function logoutPlayer(playerId: string): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ is_online: false })
    .eq('id', playerId);

  if (error) {
    console.error('로그아웃 처리 실패:', error);
    // 에러가 발생해도 계속 진행 (사용자 경험을 위해)
  }
}

// 플레이어 ID로 닉네임 가져오기
export async function getPlayerNickname(playerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('players')
    .select('nickname')
    .eq('id', playerId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.nickname;
}

// 대전 방 생성
export async function createMatchRoom(playerId: string): Promise<MatchRoom> {
  // 고유한 초대코드 생성
  let inviteCode: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    inviteCode = generateInviteCode();
    const { data: existing, error } = await supabase
      .from('match_rooms')
      .select('id')
      .eq('invite_code', inviteCode)
      .maybeSingle();

    // 에러가 없고 데이터도 없으면 고유한 코드
    if (!error && !existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('초대코드 생성 실패. 다시 시도해주세요.');
  }

  const { data: room, error } = await supabase
    .from('match_rooms')
    .insert({
      invite_code: inviteCode!,
      player1_id: playerId,
      status: 'waiting'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`방 생성 실패: ${error.message}`);
  }

  return room;
}

// 초대코드로 방 찾기
export async function findMatchRoomByCode(inviteCode: string): Promise<MatchRoom | null> {
  const { data, error } = await supabase
    .from('match_rooms')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

// 방에 플레이어2 참가
export async function joinMatchRoom(roomId: string, player2Id: string): Promise<MatchRoom> {
  console.log('joinMatchRoom called:', { roomId, player2Id });
  const { data: room, error } = await supabase
    .from('match_rooms')
    .update({
      player2_id: player2Id,
      status: 'playing'
    })
    .eq('id', roomId)
    .select()
    .single();

  if (error) {
    console.error('Join room error:', error);
    throw new Error(`방 참가 실패: ${error.message}`);
  }

  console.log('Join room success, updated room:', room);
  return room;
}

// 플레이어가 나갈 때 방 상태 업데이트
export async function leaveMatchRoom(roomId: string, playerId: string): Promise<void> {
  console.log('leaveMatchRoom called:', { roomId, playerId });
  
  // 먼저 현재 방 상태 확인
  const { data: room, error: fetchError } = await supabase
    .from('match_rooms')
    .select('player1_id, player2_id')
    .eq('id', roomId)
    .single();

  if (fetchError || !room) {
    console.error('Room fetch error:', fetchError);
    throw new Error(`방 조회 실패: ${fetchError?.message || '방을 찾을 수 없습니다'}`);
  }

  if (room.player1_id === playerId) {
    // 플레이어1(방 만든 사람)이 나가면 방을 완전히 삭제
    console.log('Player 1 (room creator) leaving, deleting room');
    
    // 외래 키 제약 조건 때문에 관련된 레코드를 먼저 삭제해야 함
    // 1. 먼저 pvp_matches 레코드 삭제
    const { error: deletePvpMatchesError } = await supabase
      .from('pvp_matches')
      .delete()
      .eq('room_id', roomId);
    
    if (deletePvpMatchesError) {
      console.error('Delete pvp_matches error:', deletePvpMatchesError);
      // pvp_matches 삭제 실패해도 계속 진행 (레코드가 없을 수도 있음)
    } else {
      console.log('PvP matches deleted successfully');
    }
    
    // 2. 그 다음 online_games 레코드 삭제
    const { error: deleteGameError } = await supabase
      .from('online_games')
      .delete()
      .eq('room_id', roomId);
    
    if (deleteGameError) {
      console.error('Delete online game error:', deleteGameError);
      // 게임 삭제 실패해도 방 삭제는 시도 (게임이 없을 수도 있음)
    } else {
      console.log('Online game deleted successfully');
    }
    
    // 3. 마지막으로 방 삭제
    const { error } = await supabase
      .from('match_rooms')
      .delete()
      .eq('id', roomId);

    if (error) {
      console.error('Delete room error:', error);
      throw new Error(`방 삭제 실패: ${error.message}`);
    }

    console.log('Room deleted successfully');
  } else if (room.player2_id === playerId) {
    // 플레이어2가 나가면 플레이어2만 제거하고 방을 waiting 상태로 변경 (새 플레이어 참가 가능)
    const updateData: any = {
      player2_id: null,
      status: 'waiting',
      updated_at: new Date().toISOString() // 업데이트 시간 명시적으로 설정하여 실시간 구독 트리거
    };

    const { error } = await supabase
      .from('match_rooms')
      .update(updateData)
      .eq('id', roomId)
      .select(); // select를 추가하여 업데이트된 데이터 반환

    if (error) {
      console.error('Leave room error:', error);
      throw new Error(`방 나가기 실패: ${error.message}`);
    }

    console.log('Player 2 left room, room set to waiting:', updateData);
  }
}

// 플레이어 준비 상태 설정
export async function setPlayerReady(roomId: string, playerId: string, isReady: boolean): Promise<MatchRoom> {
  console.log('setPlayerReady called:', { roomId, playerId, isReady });
  
  // 먼저 현재 방 상태 확인
  const { data: room, error: fetchError } = await supabase
    .from('match_rooms')
    .select('player1_id, player2_id, player1_ready, player2_ready')
    .eq('id', roomId)
    .single();

  if (fetchError || !room) {
    // 방이 삭제되었거나 존재하지 않는 경우 (PGRST116: The result contains 0 rows)
    if (fetchError?.code === 'PGRST116' || fetchError?.message?.includes('0 rows')) {
      console.log('Room not found (may have been deleted):', roomId);
      throw new Error('방이 이미 삭제되었거나 존재하지 않습니다.');
    }
    console.error('Room fetch error:', fetchError);
    throw new Error(`방 조회 실패: ${fetchError?.message || '방을 찾을 수 없습니다'}`);
  }

  // 플레이어가 방에 속해있는지 확인
  if (room.player1_id !== playerId && room.player2_id !== playerId) {
    throw new Error('이 방의 플레이어가 아닙니다.');
  }

  // 업데이트할 데이터 준비
  const updateData: any = {
    updated_at: new Date().toISOString() // 업데이트 시간 명시적으로 설정하여 실시간 구독 트리거
  };

  // 플레이어1인지 플레이어2인지에 따라 준비 상태 설정
  if (room.player1_id === playerId) {
    updateData.player1_ready = isReady;
  } else if (room.player2_id === playerId) {
    updateData.player2_ready = isReady;
  }

  const { data: updatedRoom, error } = await supabase
    .from('match_rooms')
    .update(updateData)
    .eq('id', roomId)
    .select()
    .single();

  if (error) {
    console.error('Set player ready error:', error);
    throw new Error(`준비 상태 설정 실패: ${error.message}`);
  }

  console.log('Player ready status updated:', updateData);
  return updatedRoom;
}

// PVP 게임 결과 저장
export async function savePVPMatch(
  roomId: string,
  winnerId: string,
  loserId: string
): Promise<void> {
  // 매치 기록 저장
  const { error: matchError } = await supabase
    .from('pvp_matches')
    .insert({
      room_id: roomId,
      winner_id: winnerId,
      loser_id: loserId
    });

  if (matchError) {
    throw new Error(`매치 기록 저장 실패: ${matchError.message}`);
  }

  // 승자의 다승리그 승리 횟수 증가
  const { error: updateError } = await supabase.rpc('increment_pvp_wins', {
    player_id: winnerId
  });

  // RPC 함수가 없으면 직접 업데이트
  if (updateError) {
    const { data: player } = await supabase
      .from('players')
      .select('pvp_wins')
      .eq('id', winnerId)
      .single();

    if (player) {
      await supabase
        .from('players')
        .update({ pvp_wins: (player.pvp_wins || 0) + 1 })
        .eq('id', winnerId);
    }
  }

  // 방 상태를 finished로 변경
  await supabase
    .from('match_rooms')
    .update({ status: 'finished' })
    .eq('id', roomId);
}

// AI 게임 결과 저장
export async function saveAIMatch(
  playerId: string,
  difficulty: number,
  won: boolean
): Promise<void> {
  console.log('saveAIMatch called:', { playerId, difficulty, won });
  
  // 난이도별 점수 계산 (2^difficulty)
  const points = won ? Math.pow(2, difficulty) : 0;
  console.log('Calculated points:', points);

  // AI 매치 기록 저장
  const { data: matchData, error: matchError } = await supabase
    .from('ai_matches')
    .insert({
      player_id: playerId,
      difficulty,
      won,
      points
    })
    .select();

  if (matchError) {
    console.error('AI match record save error:', matchError);
    throw new Error(`AI 매치 기록 저장 실패: ${matchError.message}`);
  }

  console.log('AI match record saved successfully:', matchData);

  // 승리한 경우에만 포인트리그 점수 증가
  if (won) {
    console.log('Player won, attempting point update');
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('point_score')
      .eq('id', playerId)
      .single();

    if (fetchError) {
      console.error('Player fetch error:', fetchError);
      throw new Error(`플레이어 조회 실패: ${fetchError.message}`);
    }

    if (player) {
      const newScore = (player.point_score || 0) + points;
      console.log('Point update:', { currentScore: player.point_score, addedPoints: points, newScore: newScore });
      
      const { error: updateError } = await supabase
        .from('players')
        .update({ point_score: newScore })
        .eq('id', playerId);

      if (updateError) {
        console.error('Point update error:', updateError);
        throw new Error(`포인트 업데이트 실패: ${updateError.message}`);
      }
      
      console.log('Point update successful');
    } else {
      console.error('Player not found:', playerId);
      throw new Error(`플레이어를 찾을 수 없습니다: ${playerId}`);
    }
  } else {
    console.log('Player lost, skipping point update');
  }
}

// 레벨 계산 함수
export function calculateLevel(rank: number, totalPlayers: number): number {
  if (totalPlayers === 0) return 0;
  
  // 백분율 계산 (버림 처리)
  const percentage = Math.floor((rank / totalPlayers) * 100);
  
  // 레벨 결정
  if (percentage <= 5) return 9;      // 상위 5%
  if (percentage <= 10) return 8;    // 상위 5~10%
  if (percentage <= 20) return 7;    // 상위 10~20%
  if (percentage <= 30) return 6;    // 상위 20~30%
  if (percentage <= 50) return 5;    // 상위 30~50%
  if (percentage <= 70) return 4;    // 상위 50~70%
  if (percentage <= 80) return 3;    // 상위 70~80%
  if (percentage <= 90) return 2;    // 상위 80~90%
  if (percentage <= 95) return 1;    // 상위 90~95%
  return 0;                           // 상위 95~100%
}

// 플레이어 레벨 조회
export async function getPlayerLevel(playerId: string, league: 'pvp' | 'point'): Promise<number> {
  const rank = await getPlayerRank(playerId, league);
  if (rank === -1) return 0;
  
  // 전체 참여자 수 가져오기
  const { count: totalCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  const totalPlayers = totalCount || 0;
  return calculateLevel(rank, totalPlayers);
}

// 다승리그 랭킹 조회
export async function getPVPRanking(limit: number = 100): Promise<RankingEntry[]> {
  // 전체 참여자 수 가져오기
  const { count: totalCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  const totalPlayers = totalCount || 0;
  
  const { data, error } = await supabase
    .from('players')
    .select('nickname, pvp_wins')
    .order('pvp_wins', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`랭킹 조회 실패: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // 동점자 처리: 같은 점수는 같은 등수로 표시
  const result: RankingEntry[] = [];
  let currentRank = 1;
  
  for (let index = 0; index < data.length; index++) {
    const player = data[index];
    const score = player.pvp_wins || 0;
    
    // 첫 번째 플레이어는 항상 1등
    if (index === 0) {
      const medal = currentRank === 1 ? 'gold' : currentRank === 2 ? 'silver' : currentRank === 3 ? 'bronze' : undefined;
      const level = calculateLevel(currentRank, totalPlayers);
      result.push({
        nickname: player.nickname,
        score: score,
        rank: currentRank,
        medal: medal,
        level: level
      });
      continue;
    }
    
    // 이전 플레이어의 점수와 비교
    const previousScore = data[index - 1].pvp_wins || 0;
    
    // 점수가 다르면 등수 업데이트 (현재 인덱스 + 1)
    if (score !== previousScore) {
      currentRank = index + 1;
    }
    // 점수가 같으면 currentRank 유지 (동점자)
    
    // 메달은 실제 등수 기준 (1, 2, 3등만)
    const medal = currentRank === 1 ? 'gold' : currentRank === 2 ? 'silver' : currentRank === 3 ? 'bronze' : undefined;
    const level = calculateLevel(currentRank, totalPlayers);
    
    result.push({
      nickname: player.nickname,
      score: score,
      rank: currentRank,
      medal: medal,
      level: level
    });
  }
  
  // 동점자는 알파벳 오름차순으로 정렬
  return result.sort((a, b) => {
    // 먼저 등수로 정렬
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    // 등수가 같으면 알파벳 오름차순
    return a.nickname.localeCompare(b.nickname, 'ko', { sensitivity: 'base' });
  });
}

// 포인트리그 랭킹 조회
export async function getPointRanking(limit: number = 100): Promise<RankingEntry[]> {
  // 전체 참여자 수 가져오기
  const { count: totalCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  const totalPlayers = totalCount || 0;
  
  const { data, error } = await supabase
    .from('players')
    .select('nickname, point_score')
    .order('point_score', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`랭킹 조회 실패: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // 동점자 처리: 같은 점수는 같은 등수로 표시
  const result: RankingEntry[] = [];
  let currentRank = 1;
  
  for (let index = 0; index < data.length; index++) {
    const player = data[index];
    const score = player.point_score || 0;
    
    // 첫 번째 플레이어는 항상 1등
    if (index === 0) {
      const medal = currentRank === 1 ? 'gold' : currentRank === 2 ? 'silver' : currentRank === 3 ? 'bronze' : undefined;
      const level = calculateLevel(currentRank, totalPlayers);
      result.push({
        nickname: player.nickname,
        score: score,
        rank: currentRank,
        medal: medal,
        level: level
      });
      continue;
    }
    
    // 이전 플레이어의 점수와 비교
    const previousScore = data[index - 1].point_score || 0;
    
    // 점수가 다르면 등수 업데이트 (현재 인덱스 + 1)
    if (score !== previousScore) {
      currentRank = index + 1;
    }
    // 점수가 같으면 currentRank 유지 (동점자)
    
    // 메달은 실제 등수 기준 (1, 2, 3등만)
    const medal = currentRank === 1 ? 'gold' : currentRank === 2 ? 'silver' : currentRank === 3 ? 'bronze' : undefined;
    const level = calculateLevel(currentRank, totalPlayers);
    
    result.push({
      nickname: player.nickname,
      score: score,
      rank: currentRank,
      medal: medal,
      level: level
    });
  }
  
  // 동점자는 알파벳 오름차순으로 정렬
  return result.sort((a, b) => {
    // 먼저 등수로 정렬
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    // 등수가 같으면 알파벳 오름차순
    return a.nickname.localeCompare(b.nickname, 'ko', { sensitivity: 'base' });
  });
}

// 특정 플레이어의 랭킹 위치 찾기
export async function getPlayerRank(playerId: string, league: 'pvp' | 'point'): Promise<number> {
  const column = league === 'pvp' ? 'pvp_wins' : 'point_score';
  
  // 플레이어의 점수 가져오기
  const { data: player } = await supabase
    .from('players')
    .select(column)
    .eq('id', playerId)
    .single();

  if (!player) {
    return -1;
  }

  const playerScore =
    league === 'pvp'
      ? (player as { pvp_wins: number }).pvp_wins || 0
      : (player as { point_score: number }).point_score || 0;

  // 더 높은 점수를 가진 플레이어 수 세기
  const { count, error } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .gt(column, playerScore);

  if (error) {
    throw new Error(`랭킹 조회 실패: ${error.message}`);
  }

  return (count || 0) + 1;
}

// 온라인 게임 생성 또는 가져오기
export async function getOrCreateOnlineGame(roomId: string, initialBoard: CellState[][]): Promise<OnlineGame> {
  console.log('getOrCreateOnlineGame called:', { roomId });
  
  // 방 정보 확인 - 두 플레이어가 모두 입장했는지 확인
  const { data: room, error: roomError } = await supabase
    .from('match_rooms')
    .select('player1_id, player2_id')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    throw new Error(`방 조회 실패: ${roomError?.message || '방을 찾을 수 없습니다'}`);
  }

  if (!room.player1_id || !room.player2_id) {
    throw new Error('두 플레이어가 모두 입장해야 게임을 시작할 수 있습니다.');
  }
  
  // 기존 게임 확인
  const { data: existing, error: fetchError } = await supabase
    .from('online_games')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('게임 조회 에러:', fetchError);
    throw new Error(`게임 조회 실패: ${fetchError.message}`);
  }

  if (existing) {
    console.log('Existing game found:', existing.id);
    return normalizeOnlineGame(existing);
  }

  // 새 게임 생성
  console.log('Creating new game:', roomId);
  const { data: newGame, error } = await supabase
    .from('online_games')
    .insert({
      room_id: roomId,
      board_state: initialBoard,
      current_player: 1,
      is_game_over: false
    })
    .select()
    .single();

  if (error) {
    // 중복 키 에러인 경우 (다른 플레이어가 이미 게임을 생성한 경우)
    if (error.code === '23505' && error.message.includes('online_games_room_id_key')) {
      console.log('Game already exists (race condition), fetching existing game:', roomId);
      // 기존 게임을 다시 조회
      const { data: existingGame, error: refetchError } = await supabase
        .from('online_games')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle();
      
      if (refetchError) {
        console.error('Failed to refetch existing game:', refetchError);
        throw new Error(`온라인 게임 조회 실패: ${refetchError.message}`);
      }
      
      if (!existingGame) {
        console.error('Game should exist but not found after conflict error');
        throw new Error('온라인 게임 조회 실패: 게임을 찾을 수 없습니다.');
      }
      
      console.log('Returning existing game after conflict:', existingGame.id);
      return normalizeOnlineGame(existingGame);
    }
    
    console.error('Game creation error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
    throw new Error(`온라인 게임 생성 실패: ${error.message}`);
  }

  if (!newGame) {
    console.error('Game creation returned no data');
    throw new Error('온라인 게임 생성 실패: 데이터가 반환되지 않았습니다.');
  }

  console.log('Game created successfully:', {
    gameId: newGame.id,
    roomId: newGame.room_id,
    currentPlayer: newGame.current_player,
    boardLength: (newGame.board_state as any)?.length || 0,
    note: 'This should trigger a Realtime INSERT event for all subscribers'
  });
  return normalizeOnlineGame(newGame);
}

// 온라인 게임 상태 업데이트
export async function updateOnlineGame(
  roomId: string,
  boardState: CellState[][],
  currentPlayer: 1 | 2,
  winner: 1 | 2 | null = null,
  isGameOver: boolean = false
): Promise<void> {
  console.log('updateOnlineGame called:', {
    roomId,
    boardStateLength: boardState.length,
    currentPlayer,
    winner,
    isGameOver
  });
  
  // 먼저 게임 ID를 가져옴 (없으면 생성)
  let { data: existingGame, error: fetchError } = await supabase
    .from('online_games')
    .select('id')
    .eq('room_id', roomId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Game fetch error:', fetchError);
    throw new Error(`게임 조회 실패: ${fetchError.message}`);
  }

  // 게임이 없으면 생성하지 않고 에러 발생 (게임은 getOrCreateOnlineGame에서만 생성)
  if (!existingGame) {
    // 게임이 아직 생성되지 않았을 수 있음 (정상적인 상황)
    // 조용히 실패 (경고 메시지 출력하지 않음)
    // 개발 환경에서만 디버깅을 위해 로그 출력
    if (import.meta.env.DEV) {
      console.debug('updateOnlineGame: Game not found yet, skipping update (this is normal during game initialization)', {
        roomId,
        currentPlayer,
        isGameOver
      });
    }
    return;
  }

  console.log('Game ID to update:', existingGame.id);
  console.log('Updating game state:', {
    gameId: existingGame.id,
    roomId,
    currentPlayer,
    boardStateLength: boardState.length,
    isGameOver
  });
  
  const { data, error } = await supabase
    .from('online_games')
    .update({
      board_state: boardState,
      current_player: currentPlayer,
      winner: winner,
      is_game_over: isGameOver,
      updated_at: new Date().toISOString() // 업데이트 시간 명시적으로 설정
    })
    .eq('id', existingGame.id)
    .select();

  if (error) {
    console.error('Online game update error:', error);
    throw new Error(`온라인 게임 업데이트 실패: ${error.message}`);
  }
  
  console.log('Online game updated successfully:', {
    gameId: existingGame.id,
    roomId,
    updatedRows: data?.length || 0,
    updatedData: data
  });
  
  if (!data || data.length === 0) {
    console.warn('No updated data returned. Realtime may not be working.');
  } else {
    console.log('Update successful, realtime subscription should trigger for room:', roomId);
  }
}

// 온라인 게임 상태 구독 (Realtime)
export function subscribeToOnlineGame(
  roomId: string,
  callback: (game: OnlineGame) => void
) {
  const channelName = `online_game_${roomId}`;
  console.log('subscribeToOnlineGame called:', { roomId, channelName });
  
  let pollTimer: NodeJS.Timeout | null = null;
  
  const channel = supabase
    .channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: '' }
      }
    })
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'online_games',
        filter: `room_id=eq.${roomId}`
      },
      (payload) => {
        console.log('OnlineGame Realtime update event received:', {
          eventType: payload.eventType,
          hasNew: !!payload.new,
          hasOld: !!payload.old,
          table: payload.table,
          roomId: (payload.new as any)?.room_id || (payload.old as any)?.room_id,
          fullPayload: payload
        });
        
        // 폴링이 실행 중이면 중지 (Realtime 이벤트가 작동하고 있음)
        if (pollTimer) {
          console.log('Realtime event received, stopping polling');
          clearInterval(pollTimer);
          pollTimer = null;
        }
        
        // UPDATE 또는 INSERT 이벤트 처리
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          if (payload.new) {
            const game = payload.new as any;
            console.log('OnlineGame callback called with new data:', {
              gameId: game.id,
              roomId: game.room_id,
              currentPlayer: game.current_player,
              boardLength: game.board_state?.length || 0
            });
            callback(normalizeOnlineGame(game));
          } else {
            console.warn('OnlineGame UPDATE/INSERT event has no new data:', payload);
          }
        } else if (payload.eventType === 'DELETE') {
          console.log('OnlineGame DELETE event received:', payload);
          // 게임이 삭제된 경우 처리하지 않음
        } else {
          const eventType = (payload as { eventType?: string }).eventType;
          console.warn('OnlineGame unknown event type:', eventType, payload);
        }
      }
    )
    .subscribe(async (status, err) => {
      console.log('OnlineGame subscription status:', status, channelName);
      if (err) {
        console.error('OnlineGame subscription error:', err);
      }
      
      // 초기 상태 동기화 함수
      const syncGameState = async () => {
        console.log('syncGameState: Querying for game with roomId:', roomId);
        
        const { data: currentGame, error: fetchError } = await supabase
          .from('online_games')
          .select('*')
          .eq('room_id', roomId)
          .maybeSingle();
        
        console.log('syncGameState: Query result:', {
          hasData: !!currentGame,
          hasError: !!fetchError,
          error: fetchError,
          gameId: currentGame?.id,
          gameRoomId: currentGame?.room_id,
          queriedRoomId: roomId,
          boardLength: (currentGame?.board_state as any)?.length || 0
        });
        
        if (fetchError) {
          console.error('Error fetching current game state:', {
            code: fetchError.code,
            message: fetchError.message,
            details: fetchError.details,
            hint: fetchError.hint
          });
          return false;
        } else if (currentGame) {
          console.log('Current game state found, syncing:', {
            gameId: currentGame.id,
            roomId: currentGame.room_id,
            currentPlayer: currentGame.current_player,
            boardLength: (currentGame.board_state as any)?.length || 0
          });
          // 초기 상태 동기화
          callback(normalizeOnlineGame(currentGame));
          return true;
        } else {
          console.log('No current game state found, waiting for game creation', {
            queriedRoomId: roomId,
            note: 'This might mean the game has not been created yet, or there is a room_id mismatch'
          });
          
          // 디버깅: 모든 게임을 조회해서 room_id 확인
          return false;
        }
      };
      
      // SUBSCRIBED 상태가 되면 구독이 준비되었음을 확인
      if (status === 'SUBSCRIBED') {
        console.log('OnlineGame subscription fully ready, listening for events:', channelName);
        
        // 즉시 한 번 확인
        const gameExists = await syncGameState();
        
        // 게임이 없으면 주기적으로 확인 (Realtime 이벤트가 트리거되지 않을 경우 대비)
        if (!gameExists) {
          console.log('Starting polling for game creation...');
          let pollCount = 0;
          const maxPolls = 30; // 약 30초
          const pollInterval = 1000; // 1초마다 확인
          
          pollTimer = setInterval(async () => {
            pollCount++;
            
            // 매 10번마다 상세 로그 출력
            if (pollCount % 10 === 0) {
              console.log(`Polling attempt ${pollCount}/${maxPolls} for game creation...`);
            }
            
            const exists = await syncGameState();
            
            if (exists) {
              console.log(`Game found via polling after ${pollCount} attempts, stopping poll`);
              if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
              }
            } else if (pollCount >= maxPolls) {
              console.warn(`Polling timeout reached after ${pollCount} attempts. Game may not have been created yet or Realtime events may not be working.`);
              console.warn('Please check if player1 has started the game. Realtime events should handle updates if game is created.');
              if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
              }
            }
          }, pollInterval);
        }
      } else if (status === 'TIMED_OUT') {
        // 구독이 타임아웃되었지만, 게임 상태는 여전히 동기화할 수 있음
        console.warn('OnlineGame subscription timed out, but will still sync game state:', channelName);
        console.warn('This may happen if the Realtime connection is slow. Falling back to polling.');
        
        // 타임아웃된 경우에도 게임 상태 동기화 시도
        await syncGameState();
        
        // TIMED_OUT이 발생하면 Realtime 이벤트를 받을 수 없으므로 주기적으로 폴링
        // 게임이 존재하든 존재하지 않든 주기적으로 상태를 동기화
        console.log('Starting periodic polling for game state updates (after timeout)...');
        let pollCount = 0;
        const maxPolls = 60; // 약 60초
        const pollInterval = 1000; // 1초마다 확인
        
        pollTimer = setInterval(async () => {
          pollCount++;
          
          // 매 20번마다 상세 로그 출력 (너무 많은 로그 방지)
          if (pollCount % 20 === 0) {
            console.log(`Polling attempt ${pollCount}/${maxPolls} for game state updates (after timeout)...`);
          }
          
          // 게임 상태 동기화 (게임이 존재하면 업데이트, 없으면 생성 대기)
          const exists = await syncGameState();
          
          // Realtime 이벤트 핸들러에서 폴링을 중지할 것이므로 여기서는 계속 폴링
          // (Realtime 이벤트가 수신되면 postgres_changes 핸들러에서 폴링을 중지함)
          
          if (pollCount >= maxPolls) {
            // 최대 폴링 횟수에 도달했지만 게임이 없으면 중지
            if (!exists) {
              console.warn(`Polling timeout reached after ${pollCount} attempts (after subscription timeout). Game may not have been created yet.`);
            } else {
              console.log(`Polling completed after ${pollCount} attempts. Continuing with periodic sync.`);
            }
            // 게임이 존재하면 계속 폴링하되, 간격을 늘림 (1초마다)
            if (exists && pollTimer) {
              clearInterval(pollTimer);
              pollTimer = null;
              // 느린 폴링 시작 (1초마다)
              pollTimer = setInterval(async () => {
                await syncGameState();
              }, 1000);
            } else if (pollTimer) {
              clearInterval(pollTimer);
              pollTimer = null;
            }
          }
        }, pollInterval);
      } else if (status === 'CLOSED') {
        console.log('OnlineGame subscription closed:', channelName);
        // 구독이 닫혔을 때는 정리만 수행
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }
    });

  return () => {
    console.log('OnlineGame subscription unsubscribed:', channelName);
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    supabase.removeChannel(channel);
  };
}

// Match Room 상태 구독 (Realtime)
export function subscribeToMatchRoom(
  roomId: string,
  callback: (room: MatchRoom | null) => void // null을 반환할 수 있도록 타입 변경 (방이 삭제된 경우)
) {
  const channelName = `match_room_${roomId}`;
  console.log('subscribeToMatchRoom called:', { roomId, channelName });
  
  const channel = supabase
    .channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: '' }
      }
    })
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'match_rooms',
        filter: `id=eq.${roomId}`
      },
      (payload) => {
        console.log('MatchRoom Realtime update event received:', {
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
          table: payload.table,
          fullPayload: payload
        });
        if (payload.new) {
          const room = payload.new as MatchRoom;
          console.log('MatchRoom callback called:', room);
          callback(room);
        } else {
          console.warn('MatchRoom update has no new data:', payload);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'match_rooms',
        filter: `id=eq.${roomId}`
      },
      (payload) => {
        console.log('MatchRoom DELETE event received:', {
          eventType: payload.eventType,
          old: payload.old,
          table: payload.table
        });
        // 방이 삭제되었음을 알림 (null 전달)
        callback(null);
      }
    )
    .subscribe(async (status, err) => {
      console.log('MatchRoom subscription status:', status, channelName);
      if (err) {
        console.error('MatchRoom subscription error:', err);
      }
      
      // SUBSCRIBED 상태가 되면 구독이 준비되었음을 확인
      if (status === 'SUBSCRIBED') {
        console.log('MatchRoom subscription fully ready, listening for events:', channelName);
      }
    });

  return () => {
    console.log('MatchRoom subscription unsubscribed:', channelName);
    supabase.removeChannel(channel);
  };
}

// 유틸리티 함수: 초대코드 생성
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

