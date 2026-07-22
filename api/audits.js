// api/audits.js
// GET  /api/audits           — list current user's audits
// POST /api/audits           — save new audit
// DELETE /api/audits?id=...  — delete an audit
const { getSupabase, requireAuth } = require('./_lib/db');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const supabase = getSupabase();

  try {
    const session = requireAuth(req);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('audits')
        .select('*')
        .eq('user_id', session.userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { score, applicable, compliant, high_gaps, gaps, answers, ai_insight, market } = req.body || {};
      const { data, error } = await supabase
        .from('audits')
        .insert({
          user_id: session.userId,
          score: score ?? 0, applicable: applicable ?? 0, compliant: compliant ?? 0,
          high_gaps: high_gaps ?? 0, gaps: gaps ?? [], answers: answers ?? {},
          ai_insight: ai_insight ?? '', market: market ?? 'sg'
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('audits').delete().eq('id', id).eq('user_id', session.userId);
      if (error) throw new Error(error.message);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('audits error:', e);
    return res.status(e.statusCode || 500).json({ error: e.message || 'Something went wrong' });
  }
};
