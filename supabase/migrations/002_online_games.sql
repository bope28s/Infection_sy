-- Online Games 테이블: 온라인 대전 게임 상태 저장
CREATE TABLE IF NOT EXISTS online_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES match_rooms(id) UNIQUE NOT NULL,
  board_state JSONB NOT NULL, -- 게임 보드 상태
  current_player INTEGER NOT NULL CHECK (current_player IN (1, 2)),
  winner INTEGER CHECK (winner IN (1, 2)),
  is_game_over BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_online_games_room_id ON online_games(room_id);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_online_games_updated_at BEFORE UPDATE ON online_games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS 정책 설정
ALTER TABLE online_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on online_games" ON online_games
  FOR ALL USING (true) WITH CHECK (true);

-- Realtime 활성화 (이미 활성화되어 있으면 에러가 나지만 무시해도 됨)
DO $$ 
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE online_games;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE match_rooms;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

