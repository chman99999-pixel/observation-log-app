import { createClient } from '@supabase/supabase-js';

// 서버 전용: service_role 키는 RLS를 우회하며 모든 테이블에 접근 가능
// 절대 클라이언트(브라우저)에 노출되어서는 안 됨
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default supabase;
