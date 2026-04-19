import jwt from 'jsonwebtoken';
import { authenticateRequest } from './_utils/auth.js';
import supabase from './_utils/supabase.js';

const HUB_JWT_SECRET = process.env.HUB_JWT_SECRET || process.env.JWT_SECRET || 'fallback-hub-secret-change-me';
const HUB_JWT_EXPIRES_IN = '30m'; // 30분 — 사용자 요청

// 허용된 서브앱 목록 (화이트리스트)
const ALLOWED_APPS = {
  girokgi: '기록지해방',
  plan1: '계획서해방1',
  plan2: '계획서해방2',
};

// 구독 만료 체크
const isSubscriptionActive = (user) => {
  if (user.role === 'admin') return true;
  if (!user.subscription_end) return false;
  const expire = new Date(user.subscription_end);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expire >= today;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;

  try {
    // ====== 서브앱 접근 토큰 발급 ======
    if (action === 'issueToken') {
      // 1) 복서방 로그인 JWT 검증
      const authPayload = authenticateRequest(req);
      if (!authPayload) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      // 2) 대상 앱 검증
      const { app } = req.body || {};
      if (!app || !ALLOWED_APPS[app]) {
        return res.status(400).json({ error: '유효하지 않은 앱입니다.' });
      }

      // 3) 최신 사용자 정보 조회 (구독 상태 확인)
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, role, organization, subscription_end')
        .eq('id', authPayload.id)
        .single();

      if (error || !user) {
        return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
      }

      // 4) 구독 활성 상태 확인
      if (!isSubscriptionActive(user)) {
        return res.status(403).json({
          error: '구독이 만료되었습니다. 복서방에서 구독을 갱신해주세요.',
          code: 'SUBSCRIPTION_EXPIRED',
        });
      }

      // 5) 서브앱용 JWT 발급 (30분)
      const now = Math.floor(Date.now() / 1000);
      const expSeconds = 30 * 60;
      const token = jwt.sign(
        {
          sub: user.id,
          name: user.name,
          org: user.organization || null,
          role: user.role || 'user',
          plan_end: user.subscription_end || null,
          app, // 대상 앱 식별자 (girokgi / plan1 / plan2)
          iss: 'bokseobang-hub',
        },
        HUB_JWT_SECRET,
        { expiresIn: HUB_JWT_EXPIRES_IN }
      );

      return res.status(200).json({
        token,
        app,
        appName: ALLOWED_APPS[app],
        expiresAt: (now + expSeconds) * 1000, // ms epoch (클라이언트 편의)
      });
    }

    // ====== 서브앱이 사용하는 토큰 검증 엔드포인트 (선택) ======
    // 서브앱 서버에서 직접 jwt.verify 하는 것이 이상적이지만,
    // Streamlit 등 런타임에서 공유 시크릿 관리가 어려울 경우 이 엔드포인트로 검증 가능.
    if (action === 'verifyToken') {
      const { token } = req.body || {};
      if (!token) return res.status(400).json({ error: '토큰이 없습니다.' });

      try {
        const payload = jwt.verify(token, HUB_JWT_SECRET);
        return res.status(200).json({ valid: true, payload });
      } catch (err) {
        return res.status(401).json({ valid: false, error: err.message });
      }
    }

    return res.status(400).json({ error: '지원하지 않는 action 입니다.' });
  } catch (err) {
    console.error('[hub]', err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
