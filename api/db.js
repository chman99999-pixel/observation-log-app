import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    // 사용자 조회
    if (action === 'getUsers') {
      const { data, error } = await supabase.from('users').select('*').order('name');
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    // 사용자 추가
    if (action === 'addUser') {
      const { id, password, name, role, organization, subscription_end } = req.body;
      const { error } = await supabase.from('users').insert([{ 
        id, 
        password, 
        name, 
        role: role || 'user',
        organization: organization || '감사합니다',
        subscription_end: subscription_end || '2026-02-20'
      }]);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // 사용자 수정
    if (action === 'updateUser') {
      const { id, password, name, organization, subscription_end } = req.body;
      const updateData = {};
      if (password) updateData.password = password;
      if (name) updateData.name = name;
      if (organization !== undefined) updateData.organization = organization;
      if (subscription_end !== undefined) updateData.subscription_end = subscription_end;
      
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

    return res.status(400).json({ error: 'Invalid action' });
    
  } catch (error) {
    console.error('DB Error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}
