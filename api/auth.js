import supabase from './_utils/supabase.js';
import { hashPassword, verifyPassword, isHashed, createToken, verifyToken, sanitizeUser } from './_utils/auth.js';
import { Resend } from 'resend';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';

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

    // ====== 이메일 기반 통합 로그인/회원가입 ======
    if (action === 'continueWithEmail') {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
      }

      // email 컬럼 또는 id 컬럼(레거시)으로 사용자 검색
      let user = null;
      const { data: byEmail } = await supabase
        .from('users').select('*').eq('email', email).single();
      if (byEmail) {
        user = byEmail;
      } else {
        const { data: byId } = await supabase
          .from('users').select('*').eq('id', email).single();
        if (byId) user = byId;
      }

      // 신규 사용자
      if (!user) {
        return res.status(200).json({ newUser: true });
      }

      // 소셜 로그인 사용자 (비밀번호 없음)
      if (!user.password) {
        const providerName = user.provider === 'kakao' ? '카카오' : user.provider === 'google' ? 'Google' : '소셜';
        return res.status(400).json({ error: `${providerName} 로그인으로 등록된 계정입니다. ${providerName}로 로그인해주세요.` });
      }

      // 비밀번호 검증
      if (!verifyPassword(password, user.password)) {
        return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
      }

      // 레거시 평문 → bcrypt 자동 업그레이드
      if (!isHashed(user.password)) {
        const hashed = hashPassword(password);
        await supabase.from('users').update({ password: hashed }).eq('id', user.id);
      }

      // 구독 만료 체크 (관리자 제외)
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

    // ====== 소셜 로그인 (카카오/구글) ======
    if (action === 'socialLogin') {
      const { provider, providerId, email, name } = req.body;
      if (!provider || !providerId) {
        return res.status(400).json({ error: '소셜 로그인 정보가 부족합니다.' });
      }

      // 1. provider + provider_id로 기존 사용자 검색
      const { data: byProvider } = await supabase
        .from('users').select('*')
        .eq('provider', provider).eq('provider_id', providerId).single();

      if (byProvider) {
        const token = createToken(byProvider);
        return res.status(200).json({ token, user: sanitizeUser(byProvider) });
      }

      // 2. email로 기존 사용자 검색 → 계정 연결
      if (email) {
        const { data: byEmail } = await supabase
          .from('users').select('*').eq('email', email).single();

        if (byEmail) {
          await supabase.from('users')
            .update({ provider, provider_id: providerId })
            .eq('id', byEmail.id);
          byEmail.provider = provider;
          byEmail.provider_id = providerId;
          const token = createToken(byEmail);
          return res.status(200).json({ token, user: sanitizeUser(byEmail) });
        }
      }

      // 3. 신규 사용자 → 자동 회원가입
      const userId = email || `${provider}_${providerId}`;
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 10);
      const subscription_end = trialEnd.toISOString().split('T')[0];

      const newUser = {
        id: userId,
        password: null,
        name: name || '사용자',
        email: email || null,
        phone: null,
        role: 'user',
        organization: '',
        subscription_end,
        provider,
        provider_id: providerId
      };

      const { error: insertErr } = await supabase.from('users').insert([newUser]);
      if (insertErr) throw insertErr;

      // 체험 구독 생성
      await supabase.from('subscriptions').insert([{
        user_id: userId,
        plan_id: null,
        status: 'trial',
        start_date: new Date().toISOString().split('T')[0],
        end_date: subscription_end
      }]);

      const token = createToken(newUser);
      return res.status(201).json({ token, user: sanitizeUser(newUser) });
    }

    // ====== 회원가입 ======
    if (action === 'register') {
      const { id, password, name, email, phone, organization } = req.body;
      if (!id || !password || !name || !email || !phone) {
        return res.status(400).json({ error: '아이디, 비밀번호, 이름, 이메일, 휴대폰 번호는 필수입니다.' });
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
        phone: phone.replace(/-/g, ''),
        role: 'user',
        organization: organization || '',
        subscription_end
      }]);

      if (error) throw error;

      // 체험 구독 생성
      await supabase.from('subscriptions').insert([{
        user_id: id,
        plan_id: null,
        status: 'trial',
        start_date: new Date().toISOString().split('T')[0],
        end_date: subscription_end
      }]);

      const newUser = { id, name, email, phone: phone.replace(/-/g, ''), role: 'user', organization: organization || '', subscription_end };
      const token = createToken(newUser);
      return res.status(201).json({ token, user: newUser });
    }

    // ====== 비밀번호 재설정 요청 ======
    if (action === 'requestPasswordReset') {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: '이메일 또는 아이디를 입력해주세요.' });
      }

      // email 또는 id로 사용자 검색
      let user = null;
      const { data: byEmail } = await supabase
        .from('users').select('*').eq('email', email).single();
      if (byEmail) {
        user = byEmail;
      } else {
        const { data: byId } = await supabase
          .from('users').select('*').eq('id', email).single();
        if (byId) user = byId;
      }

      // 사용자 없음 → 보안상 동일 성공 메시지
      if (!user) {
        return res.status(200).json({ success: true, message: '등록된 이메일이 있다면 비밀번호 재설정 링크를 보내드렸습니다.' });
      }

      // 소셜 로그인 전용 사용자
      if (!user.password && user.provider) {
        const providerName = user.provider === 'kakao' ? '카카오' : 'Google';
        return res.status(400).json({ error: `${providerName} 로그인으로 등록된 계정입니다. ${providerName}로 로그인해주세요.` });
      }

      // 이메일이 없는 레거시 사용자
      if (!user.email) {
        return res.status(400).json({ error: '등록된 이메일이 없습니다. 관리자에게 문의해주세요.\n📞 070-8065-0429' });
      }

      // 비밀번호 재설정 토큰 생성 (30분 만료)
      const resetToken = jwt.sign(
        { id: user.id, purpose: 'password-reset' },
        JWT_SECRET,
        { expiresIn: '30m' }
      );

      const resetUrl = `https://www.bokji-ai.co.kr?resetToken=${resetToken}`;

      // Resend로 이메일 발송
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: user.email,
        subject: '[복서방] 비밀번호 재설정 안내',
        html: `
          <div style="max-width:480px;margin:0 auto;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <h2 style="color:#1f2937;margin-bottom:16px;">비밀번호 재설정</h2>
            <p style="color:#4b5563;line-height:1.6;">안녕하세요, <strong>${user.name || '회원'}</strong>님.</p>
            <p style="color:#4b5563;line-height:1.6;">아래 버튼을 클릭하여 비밀번호를 재설정해주세요.<br>이 링크는 <strong>30분</strong> 동안 유효합니다.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:16px;">비밀번호 재설정하기</a>
            </div>
            <p style="color:#9ca3af;font-size:13px;line-height:1.5;">본인이 요청하지 않았다면 이 이메일을 무시해주세요.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="color:#9ca3af;font-size:12px;">복서방 | 복지인 서류해방</p>
          </div>
        `
      });

      return res.status(200).json({ success: true, message: '비밀번호 재설정 이메일을 보내드렸습니다. 메일함을 확인해주세요.' });
    }

    // ====== 비밀번호 재설정 실행 ======
    if (action === 'resetPassword') {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
      }

      if (newPassword.length < 4) {
        return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.' });
      }

      // 토큰 검증
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (e) {
        if (e.name === 'TokenExpiredError') {
          return res.status(400).json({ error: '재설정 링크가 만료되었습니다. 다시 요청해주세요.' });
        }
        return res.status(400).json({ error: '유효하지 않은 링크입니다.' });
      }

      if (decoded.purpose !== 'password-reset') {
        return res.status(400).json({ error: '유효하지 않은 링크입니다.' });
      }

      // 비밀번호 업데이트
      const hashed = hashPassword(newPassword);
      const { error } = await supabase
        .from('users')
        .update({ password: hashed })
        .eq('id', decoded.id);

      if (error) throw error;

      return res.status(200).json({ success: true, message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
