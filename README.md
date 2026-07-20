# 🌿 The Climate Architects — Vercel + OpenRouter

Currently live on **dashboard.html** (the no-login demo dashboard). Its
"Aria" AI chat, PDF upload, and paste-text carbon calculator are now wired
to real AI via **OpenRouter**, running on **Vercel serverless functions**.

The `dashboard-sg.html` / `dashboard-sg-free.html` pages (real login +
Supabase + JWT) and the `functions/` folder are the old Cloudflare Pages
build — left in place but not yet reconnected. We're doing dashboard.html
first; login/signup comes later.

---

## What's wired up right now

| Feature | Endpoint | Models |
|---|---|---|
| Aria chat | `POST /api/chat` | OpenRouter, 3-model fallback chain |
| Audit insight | `POST /api/chat?action=insight` | same |
| Paste-text extraction | `POST /api/extract-text` | same |
| PDF upload extraction | `POST /api/extract-pdf` | text extracted locally (`pdf-parse`), then same |
| Carbon calculation | `POST /api/calculate` | pure math, no AI |

**Model fallback chain** (tried in order, first success wins — see
`api/_lib/openrouter.js`):
1. `google/gemma-4-31b-it:free`
2. `poolside/laguna-xs-2.1:free`
3. `nvidia/nemotron-3-nano-30b-a3b:free`

Free OpenRouter models come and go — if all three ever return errors, add a
model ID from https://openrouter.ai/models?fmt=cards to the `MODEL_CHAIN`
array in `api/_lib/openrouter.js`.

---

## Deploy in 3 steps

### 1. Get an OpenRouter API key
Sign up free at https://openrouter.ai/keys — no card needed for the `:free`
models.

### 2. Set the environment variable
**Vercel Dashboard → your project → Settings → Environment Variables:**

| Variable | Value |
|---|---|
| `OPENROUTER_API_KEY` | your key from step 1 |
| `SITE_URL` *(optional)* | `https://your-project.vercel.app` |

### 3. Deploy
```bash
npm install -g vercel
vercel        # first deploy, follow prompts
vercel --prod # production deploy
```
Vercel auto-detects `public/` as the static site root and `api/*.js` as
serverless functions — no extra config needed beyond `vercel.json`
(already set to 30s timeout / 1024MB for the AI routes).

### Local development
```bash
npm install
cp .env.example .env   # fill in OPENROUTER_API_KEY
vercel dev
```
Runs at `http://localhost:3000`.

---

## Project structure
```
├── vercel.json
├── package.json                 ← pdf-parse dependency for PDF extraction
├── .env.example
├── public/                      ← static site (Vercel serves this as root)
│   ├── dashboard.html           ← being worked on now (no login)
│   ├── dashboard-sg.html        ← real app, not yet reconnected
│   ├── dashboard-sg-free.html   ← real app (free plan), not yet reconnected
│   └── ...
├── api/                         ← Vercel serverless functions
│   ├── _lib/openrouter.js       ← shared fallback-chain helper
│   ├── chat.js                  ← Aria chat + audit insight
│   ├── extract-text.js          ← paste-text extraction
│   ├── extract-pdf.js           ← PDF upload extraction
│   ├── calculate.js             ← Scope 1 & 2 carbon math
│   └── contact.js
└── functions/                   ← OLD Cloudflare Pages Functions
                                    (login, register, audits, admin — not
                                    used on Vercel; kept for later migration)
```

---

## Migrating login/audits later (when you're ready)
`functions/api/{login,register,me,audits,change-password}.js` are Cloudflare
Workers-style handlers (`context.env`, Web Crypto JWT, Cloudflare KV). To
bring them to Vercel you'd rewrite each as `module.exports = async (req,
res) => {...}` (like `api/calculate.js`), swap `context.env.VAR` for
`process.env.VAR`, and swap Cloudflare KV for a real DB call (Supabase is
already referenced in the old handlers). Happy to do this in a follow-up
once dashboard.html itself is where you want it.
