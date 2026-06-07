-- players 테이블에 is_online 필드 추가
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_players_is_online ON players(is_online) WHERE is_online = TRUE;

