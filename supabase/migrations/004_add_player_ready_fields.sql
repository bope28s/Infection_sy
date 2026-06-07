-- match_rooms 테이블에 플레이어 준비 상태 필드 추가
ALTER TABLE match_rooms 
ADD COLUMN IF NOT EXISTS player1_ready BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS player2_ready BOOLEAN DEFAULT false;

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_match_rooms_player_ready ON match_rooms(player1_ready, player2_ready);

