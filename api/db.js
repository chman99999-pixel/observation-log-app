import supabase from './_utils/supabase.js';
import { hashPassword, verifyPassword, authenticateRequest } from './_utils/auth.js';

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    // 사용자 조회 (비밀번호 필드 제외)
    if (action === 'getUsers') {
      const { data, error } = await supabase.from('users').select('id, name, role, organization, subscription_end, email, phone, created_at').order('name');
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    // 사용자 추가 (관리자 전용 - 비밀번호 bcrypt 해시)
    if (action === 'addUser') {
      const { id, password, name, role, organization, subscription_end, email, phone } = req.body;
      const hashed = hashPassword(password);
      const { error } = await supabase.from('users').insert([{
        id,
        password: hashed,
        name,
        role: role || 'user',
        organization: organization || '감사합니다',
        subscription_end: subscription_end || '2026-02-20',
        email: email || null,
        phone: phone || null,
      }]);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // 사용자 수정 (비밀번호 변경 시 bcrypt 해시)
    if (action === 'updateUser') {
      const { id, password, name, organization, subscription_end, email, phone } = req.body;
      const updateData = {};
      if (password) updateData.password = hashPassword(password);
      if (name) updateData.name = name;
      if (organization !== undefined) updateData.organization = organization;
      if (subscription_end !== undefined) updateData.subscription_end = subscription_end;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;

      const { error } = await supabase.from('users').update(updateData).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // 개인정보 수정 (본인 전용 - JWT 인증)
    if (action === 'updateProfile') {
      const user = authenticateRequest(req);
      if (!user) return res.status(401).json({ error: '인증이 필요합니다.' });

      const { name, email, phone, organization, currentPassword, newPassword } = req.body;
      const updateData = {};

      // 비밀번호 변경
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: '현재 비밀번호를 입력해주세요.' });
        }
        // DB에서 현재 비밀번호 해시 조회
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('password')
          .eq('id', user.id)
          .single();
        if (userError || !userData) {
          return res.status(400).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        if (!verifyPassword(currentPassword, userData.password)) {
          return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
        }
        updateData.password = hashPassword(newPassword);
      }

      // 개인정보 업데이트
      if (name) updateData.name = name;
      if (email !== undefined) {
        // 이메일 중복 체크
        if (email) {
          const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .neq('id', user.id);
          if (existing && existing.length > 0) {
            return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
          }
        }
        updateData.email = email || null;
      }
      if (phone !== undefined) updateData.phone = phone || null;
      if (organization !== undefined) updateData.organization = organization;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: '변경할 항목이 없습니다.' });
      }

      const { error } = await supabase.from('users').update(updateData).eq('id', user.id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // 사용자 삭제
    if (action === 'deleteUser') {
      const { id } = req.body;
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // 구독 상태 변경 (관리자 전용)
    if (action === 'updateSubscriptionStatus') {
      const { user_id, status } = req.body;
      if (!user_id || !status) {
        return res.status(400).json({ error: 'user_id와 status는 필수입니다.' });
      }

      const validStatuses = ['active', 'trial', 'cancelled', 'expired'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: '유효하지 않은 구독 상태입니다.' });
      }

      // 기존 활성/체험 구독이 있으면 상태 업데이트
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user_id)
        .in('status', ['active', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        const updateData = { status };
        if (status === 'cancelled') updateData.cancelled_at = new Date().toISOString();
        const { error } = await supabase
          .from('subscriptions')
          .update(updateData)
          .eq('id', existing[0].id);
        if (error) throw error;
      } else if (status === 'active' || status === 'trial') {
        // 활성 구독이 없는데 구독중/체험중으로 변경 → 새 구독 생성
        const now = new Date();
        const endDate = new Date(now);
        if (status === 'trial') {
          endDate.setDate(endDate.getDate() + 10); // 체험 10일
        } else {
          endDate.setMonth(endDate.getMonth() + 1); // 기본 1개월
        }
        const { error } = await supabase.from('subscriptions').insert([{
          user_id,
          plan_id: status === 'trial' ? null : 'monthly',
          status,
          start_date: now.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
        }]);
        if (error) throw error;

        // users 테이블 subscription_end도 업데이트
        await supabase
          .from('users')
          .update({ subscription_end: endDate.toISOString().split('T')[0] })
          .eq('id', user_id);
      }

      return res.status(200).json({ success: true });
    }

    // 사용자별 구독 상태 조회
    if (action === 'getUserSubscription') {
      const user_id = (req.body && req.body.user_id) || (req.query && req.query.user_id);
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user_id)
        .in('status', ['active', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1);

      return res.status(200).json({ subscription: (data && data[0]) || null });
    }

    // ============ 관리자 통계 ============

    // 관리자 대시보드 통합 통계
    if (action === 'getAdminStats') {
      const [subsResult, payResult] = await Promise.all([
        supabase.from('subscriptions').select('*'),
        supabase.from('payments').select('*').order('paid_at', { ascending: false }),
      ]);
      return res.status(200).json({
        subscriptions: subsResult.data || [],
        payments: payResult.data || [],
      });
    }

    // ============ 상품(요금제) 관리 ============

    // 전체 상품 조회
    if (action === 'getPlans') {
      const { data, error } = await supabase.from('plans').select('*').order('price', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    // 상품 추가
    if (action === 'addPlan') {
      const { id, name, price, interval, is_active, is_popular, description } = req.body;
      const { data, error } = await supabase.from('plans').insert([{
        id, name, price, interval, is_active: is_active !== false, is_popular: is_popular || false, description: description || '',
      }]).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    // 상품 수정
    if (action === 'updatePlan') {
      const { id, name, price, is_active, is_popular, description } = req.body;
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (price !== undefined) updateData.price = price;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (is_popular !== undefined) updateData.is_popular = is_popular;
      if (description !== undefined) updateData.description = description;

      const { data, error } = await supabase.from('plans').update(updateData).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    // 상품 삭제
    if (action === 'deletePlan') {
      const { id } = req.body;
      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // ============ 로그 관리 ============

    // 로그 조회
    if (action === 'getLogs') {
      const { data, error } = await supabase.from('logs').select('*').order('id', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    // 로그 추가
    if (action === 'addLog') {
      const { id, date, time, user_id, user_name, input, observation, action: logAction } = req.body;
      const { error } = await supabase.from('logs').insert([{
        id, date, time, user_id, user_name, input, observation, action: logAction
      }]);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // 로그 단일 삭제
    if (action === 'deleteLog') {
      const { id } = req.body;
      const { error } = await supabase.from('logs').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // 로그 다중 삭제
    if (action === 'deleteLogs') {
      const { ids } = req.body;
      const { error } = await supabase.from('logs').delete().in('id', ids);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // 30일 이전 로그 삭제
    if (action === 'deleteOldLogs') {
      const { beforeDate } = req.body;
      const { data: targetLogs, error: countError } = await supabase
        .from('logs')
        .select('id')
        .lt('date', beforeDate);
      if (countError) throw countError;

      const count = targetLogs?.length || 0;
      if (count === 0) {
        return res.status(200).json({ success: true, deletedCount: 0 });
      }

      const { error } = await supabase.from('logs').delete().lt('date', beforeDate);
      if (error) throw error;
      return res.status(200).json({ success: true, deletedCount: count });
    }

    // ============ 설정 ============

    // 설정 조회
    if (action === 'getSettings') {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    // 설정 저장
    if (action === 'updateSettings') {
      const { key, value } = req.body;
      const { error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('DB Error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
