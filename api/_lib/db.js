// api/_lib/db.js
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function getTokenFromReq(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function requireAuth(req) {
  const token = getTokenFromReq(req);
  if (!token) {
    const e = new Error('No token provided. Please log in.');
    e.statusCode = 401;
    throw e;
  }
  try {
    return verifyToken(token);
  } catch {
    const e = new Error('Session expired. Please log in again.');
    e.statusCode = 401;
    throw e;
  }
}

module.exports = { getSupabase, signToken, verifyToken, requireAuth };
