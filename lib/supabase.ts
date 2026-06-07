import { createClient } from "@supabase/supabase-js";

// Vite 환경변수 읽기
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// 안전장치 (환경변수 누락 시 바로 에러)
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase env vars are missing. Check .env.local and Vercel env settings."
  );
}

// Supabase 클라이언트 생성 (Realtime 활성화)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});