// server.js
// Modern Full-stack Express Server for ESG Compliance Platform
// Serves static files on port 3000 and maps Cloudflare Pages / API routes.

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Import Cloudflare Pages functions (ESM)
import * as authFunc from './functions/api/auth.js';
import * as chatFunc from './functions/api/chat.js';
import * as auditsFunc from './functions/api/audits.js';
import * as meFunc from './functions/api/me.js';
import * as loginFunc from './functions/api/login.js';
import * as registerFunc from './functions/api/register.js';
import * as scope3Func from './functions/api/scope3.js';

// Import CommonJS handlers (Vercel style)
import calculateHandler from './api/calculate.js';
import scope3textHandler from './api/scope3text.js';
import contactHandler from './api/contact.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Set up JSON body parsers with generous limits for file/image uploading
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Helper to construct a standard Web Request from Express Request
function toWebRequest(req) {
  const method = req.method;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }
  }

  const protocol = req.secure ? 'https' : 'http';
  const host = req.get('host') || `localhost:${port}`;
  const url = `${protocol}://${host}${req.originalUrl}`;

  const init = {
    method,
    headers,
  };

  if (method !== 'GET' && method !== 'HEAD') {
    if (req.body) {
      init.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }
  }

  return new Request(url, init);
}

// Helper to send standard Web Response back to Express Response
async function sendWebResponse(webRes, expressRes) {
  expressRes.status(webRes.status);
  webRes.headers.forEach((value, key) => {
    expressRes.setHeader(key, value);
  });

  const text = await webRes.text();
  expressRes.send(text);
}

// Wrapper for Cloudflare Pages API Functions
async function wrapPagesRoute(handler, req, res) {
  try {
    const webReq = toWebRequest(req);
    const context = {
      request: webReq,
      env: process.env
    };
    const webRes = await handler(context);
    await sendWebResponse(webRes, res);
  } catch (error) {
    console.error('Error in Pages Route wrapper:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
  }
}

// ── API ROUTES ───────────────────────────────────────────────────────────

// Auth routes (/api/auth)
app.all('/api/auth', async (req, res) => {
  const method = req.method.toUpperCase();
  if (method === 'OPTIONS') {
    return wrapPagesRoute(authFunc.onRequestOptions, req, res);
  } else if (method === 'GET') {
    return wrapPagesRoute(authFunc.onRequestGet, req, res);
  } else if (method === 'POST') {
    return wrapPagesRoute(authFunc.onRequestPost, req, res);
  }
  res.status(405).json({ error: 'Method not allowed' });
});

// Chat routes (/api/chat)
app.all('/api/chat', async (req, res) => {
  const method = req.method.toUpperCase();
  if (method === 'OPTIONS') {
    return wrapPagesRoute(chatFunc.onRequestOptions, req, res);
  } else if (method === 'POST') {
    return wrapPagesRoute(chatFunc.onRequestPost, req, res);
  }
  res.status(405).json({ error: 'Method not allowed' });
});

// Audits routes (/api/audits)
app.all('/api/audits', async (req, res) => {
  const method = req.method.toUpperCase();
  if (method === 'OPTIONS') {
    return wrapPagesRoute(auditsFunc.onRequestOptions, req, res);
  } else if (method === 'GET') {
    return wrapPagesRoute(auditsFunc.onRequestGet, req, res);
  } else if (method === 'POST') {
    return wrapPagesRoute(auditsFunc.onRequestPost, req, res);
  } else if (method === 'DELETE') {
    return wrapPagesRoute(auditsFunc.onRequestDelete, req, res);
  }
  res.status(405).json({ error: 'Method not allowed' });
});

// User info route (/api/me)
app.get('/api/me', async (req, res) => {
  return wrapPagesRoute(meFunc.onRequestGet, req, res);
});

// Individual Auth login/register routes
app.post('/api/login', async (req, res) => {
  return wrapPagesRoute(loginFunc.onRequestPost, req, res);
});

app.post('/api/register', async (req, res) => {
  return wrapPagesRoute(registerFunc.onRequestPost, req, res);
});

// Scope 3 Carbon Engine (/api/scope3)
app.all('/api/scope3', async (req, res) => {
  const method = req.method.toUpperCase();
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  return wrapPagesRoute(scope3Func.onRequestPost, req, res);
});

// Vercel / CommonJS style endpoints mapped directly
app.all('/api/calculate', (req, res) => {
  calculateHandler(req, res);
});

app.all('/api/scope3text', (req, res) => {
  scope3textHandler(req, res);
});

app.all('/api/contact', (req, res) => {
  contactHandler(req, res);
});

// ── STATIC FILES SERVING ─────────────────────────────────────────────────

// Serve static assets from `/public` directory
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all to serve index.html for undefined frontend pages
app.get('*', (req, res, next) => {
  // If request looks like an API route or file, pass it
  if (req.path.startsWith('/api/') || req.path.includes('.')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
app.listen(port, '0.0.0.0', () => {
  console.log(`ESG compliance platform running on port ${port}...`);
});
