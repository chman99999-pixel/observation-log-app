const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function supabaseFetch(endpoint, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers
    }
  });
  return res;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    // 사용자 목록 가져오기
    if (action === 'getUsers') {
      const response = await supabaseFetch('users?select=*');
      const data = await response.json();
      return res.status(200).json(data);
    }

    // 사용자 추가
    if (action === 'addUser') {
      const { id, password, name, role } = req.body;
      const response = await supabaseFetch('users', {
        method: 'POST',
        body: JSON.stringify({ id, password, name, role: role || 'user' })
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    // 사용자 삭제
    if (action === 'deleteUser') {
      const { id } = req.body;
      await supabaseFetch(`users?id=eq.${id}`, { method: 'DELETE' });
      return res.status(200).json({ success: true });
    }

    // 로그 목록 가져오기
    if (action === 'getLogs') {
      const response = await supabaseFetch('logs?select=*&order=id.desc');
      const data = await response.json();
      return res.status(200).json(data);
    }

    // 로그 추가
    if (action === 'addLog') {
      const { id, date, time, user_id, user_name, input, observation, action: act } = req.body;
      const response = await supabaseFetch('logs', {
        method: 'POST',
        body: JSON.stringify({ id, date, time, user_id, user_name, input, observation, action: act })
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    // 로그 삭제
    if (action === 'deleteLog') {
      const { id } = req.body;
      await supabaseFetch(`logs?id=eq.${id}`, { method: 'DELETE' });
      return res.status(200).json({ success: true });
    }

    // 오래된 로그 삭제
    if (action === 'deleteOldLogs') {
      const { ids } = req.body;
      for (const id of ids) {
        await supabaseFetch(`logs?id=eq.${id}`, { method: 'DELETE' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
