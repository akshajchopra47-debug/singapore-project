// api/auth.js
// GET  /api/auth?action=me
// POST /api/auth?action=login
// POST /api/auth?action=register
const bcrypt = require('bcryptjs');
const { getSupabase, signToken, requireAuth } = require('./_lib/db');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const publicUser = (u) => ({
  id: u.id, full_name: u.full_name, email: u.email,
  company: u.company, industry: u.industry, plan: u.plan, role: u.role
});

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query?.action;
  const supabase = getSupabase();

  try {
    if (req.method === 'GET' && action === 'me') {
      const session = requireAuth(req);
      const { data, error } = await supabase.from('users').select('*').eq('id', session.userId).single();
      if (error || !data) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ user: publicUser(data) });
    }

    if (req.method === 'POST' && action === 'register') {
      const { full_name, email, password, company, industry } = req.body || {};
      if (!full_name || !email || !password) {
        return res.status(400).json({ error: 'full_name, email and password are required' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const { data: existing } = await supabase.from('users').select('id').eq('email', cleanEmail).single();
      if (existing) return res.status(400).json({ error: 'An account with this email already exists' });

      const password_hash = await bcrypt.hash(password, 10);
      const { data: user, error: insertErr } = await supabase
        .from('users')
        .insert({ full_name: full_name.trim(), email: cleanEmail, password_hash, company, industry, plan: 'free', role: 'user' })
        .select('*')
        .single();

      if (insertErr) throw new Error(insertErr.message);

      const token = signToken({ userId: user.id, email: user.email, plan: user.plan, role: user.role });
      return res.status(201).json({ token, user: publicUser(user) });
    }

    if (req.method === 'POST' && action === 'login') {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

      const cleanEmail = email.toLowerCase().trim();
      const { data: user, error } = await supabase.from('users').select('*').eq('email', cleanEmail).single();
      if (error || !user) return res.status(401).json({ error: 'Invalid email or password' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

      const token = signToken({ userId: user.id, email: user.email, plan: user.plan, role: user.role });
      return res.status(200).json({ token, user: publicUser(user) });
    }

    if (req.method === 'PATCH' && action === 'update') {
      const session = requireAuth(req);
      const { full_name, company, industry } = req.body || {};
      const { data, error } = await supabase
        .from('users')
        .update({ ...(full_name && { full_name }), ...(company !== undefined && { company }), ...(industry !== undefined && { industry }) })
        .eq('id', session.userId)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return res.status(200).json({ user: publicUser(data) });
    }

    return res.status(404).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('auth error:', e);
    return res.status(e.statusCode || 500).json({ error: e.message || 'Something went wrong' });
  }
};
