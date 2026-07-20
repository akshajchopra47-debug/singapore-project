// api/chat.js
// POST /api/chat            -> { messages: [{role, content}, ...] } => { reply }
// POST /api/chat?action=insight -> { score, gaps, applicable } => { insight }
//
// Powers the "Aria" AI Copilot on the dashboard, via OpenRouter
// (free model fallback chain — see api/_lib/openrouter.js).

const { callOpenRouter, setCors, extractJson } = require('./_lib/openrouter');

const SYSTEM_PROMPT = `You are Aria, an expert ESG compliance advisor for The Climate Architects.
You help businesses understand and comply with sustainability regulations in Singapore.

Singapore regulations you know deeply:
- Carbon Tax (CPA): S$45/tonne for facilities emitting >=25,000 tCO2e/year from 2026-27
- Mandatory Energy Management (ECA): companies consuming >=54 TJ/year must appoint certified Energy Manager
- Water Efficiency Management (WEMP): premises using >=60,000 m3/year must submit records to PUB
- Mandatory Packaging Reporting: brand owners/importers >S$10M turnover with >=50 tonnes packaging
- Climate Reporting for non-listed companies: revenue >=S$1B + assets >=S$500M, from FY2027
- SGX Sustainability Reporting: listed companies, IFRS SDS, 4 months after FY end
- E-waste EPR: producers/retailers of regulated electronics

Keep answers concise, practical, and actionable. Always mention the specific threshold or deadline.
If you don't know something, say so and suggest they book a call with the team.`;

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query?.action;
  const body = req.body || {};

  try {
    // ── Audit insight generation ──────────────────────────────────
    if (action === 'insight') {
      const { score, gaps, applicable } = body;
      const prompt = `A business just completed their ESG compliance audit for Singapore regulations (Carbon Tax, ECA, WEMP, SGX).
Score: ${score}% compliant. Applicable frameworks: ${applicable}. Gaps: ${gaps?.length || 0}.
${gaps?.length ? `Key gaps: ${gaps.map(g => g.title).join(', ')}` : 'No gaps identified.'}

Write a 2-3 sentence professional insight about their compliance standing and the most important next step they should take. Be specific and actionable.`;

      const { text } = await callOpenRouter(
        [{ role: 'user', content: prompt }],
        { temperature: 0.4, maxTokens: 300 }
      );
      return res.status(200).json({ insight: text });
    }

    // ── Regular chat ──────────────────────────────────────────────
    const { messages } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const orMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      }))
    ];

    const { text } = await callOpenRouter(orMessages, { temperature: 0.5, maxTokens: 700 });
    return res.status(200).json({ reply: text });

  } catch (e) {
    console.error('chat error:', e);
    return res.status(e.statusCode || 500).json({ error: e.message || 'Chat failed' });
  }
};
