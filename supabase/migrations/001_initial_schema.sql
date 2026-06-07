-- Players 테이블: 닉네임과 랭킹 정보 저장
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT UNIQUE NOT NULL,
  pvp_wins INTEGER DEFAULT 0, -- 다승리그 승리 횟수
  point_score INTEGER DEFAULT 0, -- 포인트리그 점수
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Match Rooms 테이블: 대전 게임 방 관리
CREATE TABLE IF NOT EXISTS match_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT UNIQUE NOT NULL, -- 초대코드 (6자리)
  player1_id UUID REFERENCES players(id),
  player2_id UUID REFERENCES players(id),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PVP Matches 테이블: 대전 게임 기록
CREATE TABLE IF NOT EXISTS pvp_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES match_rooms(id),
  winner_id UUID REFERENCES players(id) NOT NULL,
  loser_id UUID REFERENCES players(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Matches 테이블: AI와의 게임 기록
CREATE TABLE IF NOT EXISTS ai_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty >= 1 AND difficulty <= 10),
  won BOOLEAN NOT NULL,
  points INTEGER NOT NULL, -- 난이도별 점수 (2^difficulty)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_players_pvp_wins ON players(pvp_wins DESC);
CREATE INDEX IF NOT EXISTS idx_players_point_score ON players(point_score DESC);
CREATE INDEX IF NOT EXISTS idx_match_rooms_invite_code ON match_rooms(invite_code);
CREATE INDEX IF NOT EXISTS idx_match_rooms_status ON match_rooms(status);
CREATE INDEX IF NOT EXISTS idx_pvp_matches_winner ON pvp_matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_ai_matches_player ON ai_matches(player_id);

-- 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_match_rooms_updated_at BEFORE UPDATE ON match_rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 초대코드 생성 함수 (6자리 랜덤 문자열)
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) 정책 설정
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE pvp_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_matches ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능하도록 설정 (익명 사용자 허용)
CREATE POLICY "Allow all operations on players" ON players
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on match_rooms" ON match_rooms
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on pvp_matches" ON pvp_matches
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on ai_matches" ON ai_matches
  FOR ALL USING (true) WITH CHECK (true);

-- RPC 함수: PVP 승리 횟수 증가
CREATE OR REPLACE FUNCTION increment_pvp_wins(player_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE players
  SET pvp_wins = COALESCE(pvp_wins, 0) + 1
  WHERE id = player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

