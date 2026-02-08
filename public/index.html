import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    // 사용자 관련
    if (action === 'getUsers') {
      const { data } = await supabase.from('users').select('*').order('name');
      return res.json(data || []);
    }

    if (action === 'addUser') {
      const { id, password, name, role, organization, subscription_end } = req.body;
      await supabase.from('users').insert([{ 
        id, 
        password, 
        name, 
        role: role || 'user',
        organization: organization || '감사합니다',
        subscription_end: subscription_end || '2026-02-20'
      }]);
      return res.json({ success: true });
    }

    if (action === 'updateUser') {
      const { id, password, name, organization, subscription_end } = req.body;
      const updateData = {};
      if (password) updateData.password = password;
      if (name) updateData.name = name;
      if (organization) updateData.organization = organization;
      if (subscription_end) updateData.subscription_end = subscription_end;
      
      await supabase.from('users').update(updateData).eq('id', id);
      return res.json({ success: true });
    }

    if (action === 'deleteUser') {
      const { id } = req.body;
      await supabase.from('users').delete().eq('id', id);
      return res.json({ success: true });
    }

    // 로그 관련
    if (action === 'getLogs') {
      const { data } = await supabase.from('logs').select('*').order('id', { ascending: false });
      return res.json(data || []);
    }

    if (action === 'addLog') {
      const { id, date, time, user_id, user_name, input, observation, action: logAction } = req.body;
      await supabase.from('logs').insert([{ id, date, time, user_id, user_name, input, observation, action: logAction }]);
      return res.json({ success: true });
    }

    if (action === 'deleteLog') {
      const { id } = req.body;
      await supabase.from('logs').delete().eq('id', id);
      return res.json({ success: true });
    }

    if (action === 'deleteLogs') {
      const { ids } = req.body;
      await supabase.from('logs').delete().in('id', ids);
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
