import supabase from './_utils/supabase.js';
import { hashPassword, authenticateRequest } from './_utils/auth.js';

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    // 사용자 조회 (비밀번호 필드 제외)
    if (action === 'getUsers') {
      const { data, error } = await supabase.from('users').select('id, name, role, organization, subscription_end, email, phone').order('name');
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

    // 사용자 삭제
    if (action === 'deleteUser') {
      const { id } = req.body;
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
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
