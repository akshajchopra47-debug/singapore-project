module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let apiKey = process.env.OPENROUTER_API_KEY;
  let useGemini = false;
  if (!apiKey) {
    if (process.env.GEMINI_API_KEY) {
      apiKey = process.env.GEMINI_API_KEY;
      useGemini = true;
    } else {
      return res.status(500).json({ error: 'API key not configured' });
    }
  }
  const { text, model } = req.body || {};
  if (!text || text.trim().length < 10) return res.status(400).json({ error: 'No text provided' });
  const MODELS = {
    'gemma-free':   'google/gemma-3-27b-it:free',
    'llama-free':   'meta-llama/llama-3.3-70b-instruct:free',
    'mistral-free': 'mistralai/mistral-small-3.2-24b-instruct:free',
    'gemini-flash': 'google/gemini-2.0-flash-001',
    'claude':       'anthropic/claude-sonnet-4-6'
  };
  const selectedModel = MODELS[model] || MODELS['gemma-free'];
  const prompt = `You are an expert carbon accounting analyst for Scope 3 supply chain emissions.

Analyse this supplier document text and extract all carbon-relevant data points.

DOCUMENT TEXT:
${text.substring(0, 6000)}

Return ONLY valid JSON, no markdown:
{
  "extracted": {
    "company_name": "value or null",
    "country": "value or null",
    "industry": "value or null",
    "reporting_period": "value or null",
    "electricity_kwh": "value with unit or null",
    "fuel_type": "value or null",
    "fuel_quantity": "value with unit or null",
    "production_volume": "value with unit or null",
    "product_type": "value or null",
    "existing_emissions_data": "value or null"
  },
  "confidence": "HIGH or MEDIUM or LOW",
  "confidence_reason": "one sentence",
  "data_gaps": ["missing fields"],
  "summary": "2-3 sentence professional summary for Scope 3 calculation",
  "methodology_note": "activity-based, spend-based, or hybrid and why"
}`;
  try {
    let raw = '';
    if (useGemini) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        }
      );
      if (!geminiRes.ok) {
        const e = await geminiRes.text();
        return res.status(502).json({ error: 'Gemini error: ' + e });
      }
      const d = await geminiRes.json();
      raw = d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://bholi-pi.vercel.app',
          'X-Title': 'TCA Scope 3 Text Engine'
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!orRes.ok) {
        const e = await orRes.text();
        return res.status(502).json({ error: 'AI error: ' + e });
      }
      const d = await orRes.json();
      raw = d?.choices?.[0]?.message?.content || '';
    }
    const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch(e) { return res.status(200).json({ extracted:{}, confidence:'LOW', confidence_reason:'Parse failed', data_gaps:['all'], summary: raw, methodology_note:'Manual review' }); }
    return res.status(200).json({ ...parsed, model_used: selectedModel });
  } catch(err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
