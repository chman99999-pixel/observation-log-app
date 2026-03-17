import supabase from './_utils/supabase.js';
import { hashPassword, verifyPassword, isHashed, createToken, verifyToken, sanitizeUser } from './_utils/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;

  try {
    // ====== 로그인 ======
    if (action === 'login') {
      const { id, password } = req.body;
      if (!id || !password) {
        return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !user) {
        return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      }

      // 비밀번호 검증 (bcrypt 해시 또는 레거시 평문 모두 지원)
      if (!verifyPassword(password, user.password)) {
        return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      }

      // 레거시 평문 비밀번호 → bcrypt 자동 업그레이드
      if (!isHashed(user.password)) {
        const hashed = hashPassword(password);
        await supabase.from('users').update({ password: hashed }).eq('id', id);
      }

      // 구독 만료 체크 (관리자는 제외)
      if (user.role !== 'admin' && user.subscription_end) {
        const expireDate = new Date(user.subscription_end);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expireDate < today) {
          return res.status(403).json({ error: 'subscription_expired', subscription_end: user.subscription_end });
        }
      }

      const token = createToken(user);
      return res.status(200).json({ token, user: sanitizeUser(user) });
    }

    // ====== 토큰 검증 (세션 복원용) ======
    if (action === 'verify') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '토큰이 없습니다.' });
      }

      const decoded = verifyToken(authHeader.slice(7));
      if (!decoded) {
        return res.status(401).json({ error: '토큰이 만료되었거나 유효하지 않습니다.' });
      }

      // DB에서 최신 사용자 정보 조회
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.id)
        .single();

      if (error || !user) {
        return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
      }

      return res.status(200).json({ user: sanitizeUser(user) });
    }

    // ====== 회원가입 ======
    if (action === 'register') {
      const { id, password, name, email, organization } = req.body;
      if (!id || !password || !name || !email) {
        return res.status(400).json({ error: '아이디, 비밀번호, 이름, 이메일은 필수입니다.' });
      }

      // 이메일 형식 검증
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다.' });
      }

      // 아이디 중복 체크
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', id)
        .single();

      if (existing) {
        return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
      }

      // 이메일 중복 체크
      const { data: existingEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingEmail) {
        return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
      }

      // 무료체험 10일
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 10);
      const subscription_end = trialEnd.toISOString().split('T')[0];

      const hashed = hashPassword(password);
      const { error } = await supabase.from('users').insert([{
        id,
        password: hashed,
        name,
        email,
        role: 'user',
        organization: organization || '',
        subscription_end
      }]);

      if (error) throw error;

      const newUser = { id, name, email, role: 'user', organization: organization || '', subscription_end };
      const token = createToken(newUser);
      return res.status(201).json({ token, user: newUser });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
