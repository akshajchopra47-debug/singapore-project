module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { fileData, mimeType, model } = req.body || {};
  if (!fileData || !mimeType) return res.status(400).json({ error: 'fileData and mimeType required' });

  const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (!allowed.includes(mimeType)) return res.status(400).json({ error: 'Unsupported file type' });

  const MODELS = {
    'gemma-free':   'google/gemma-3-27b-it:free',
    'llama-free':   'meta-llama/llama-3.3-70b-instruct:free',
    'mistral-free': 'mistralai/mistral-small-3.2-24b-instruct:free',
    'gemini-flash': 'google/gemini-2.0-flash-001',
    'claude':       'anthropic/claude-sonnet-4-6'
  };
  const selectedModel = MODELS[model] || MODELS['gemma-free'];

  const prompt = `You are an expert carbon accounting analyst specialising in Scope 3 supply chain emissions for ASEAN manufacturing suppliers.

Analyse this supplier document carefully and extract every carbon-relevant data point. Look for:
- Electricity consumption (kWh)
- Fuel type and quantity (litres, therms, m3, kg)
- Production or output volume
- Company name and country
- Reporting period or billing date
- Any stated emissions figures (tCO2e)

Return ONLY valid JSON, no markdown, no text outside the JSON:

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
  "data_gaps": ["missing", "fields"],
  "summary": "2-3 sentence professional summary for Scope 3 calculation",
  "methodology_note": "activity-based, spend-based, or hybrid and why"
}`;

  try {
    // Use OpenRouter's native file handling via image_url with data URI
    // This works for both PDFs and images — OpenRouter handles extraction
    const dataUri = `data:${mimeType};base64,${fileData}`;

    const messageContent = [
      {
        type: 'image_url',
        image_url: { url: dataUri }
      },
      {
        type: 'text',
        text: prompt
      }
    ];

    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bholi-pi.vercel.app',
        'X-Title': 'TCA Scope 3 Engine'
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 1500,
        messages: [{ role: 'user', content: messageContent }]
      })
    });

    if (!orRes.ok) {
      const errText = await orRes.text();
      console.error('OpenRouter error:', orRes.status, errText);
      return res.status(502).json({ error: 'AI service error: ' + errText });
    }

    const orData = await orRes.json();
    const raw = orData?.choices?.[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'No AI response. Try again.' });

    const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch(e) {
      console.error('Parse error:', e.message, '| Raw:', raw.substring(0, 200));
      return res.status(200).json({
        extracted: {},
        confidence: 'LOW',
        confidence_reason: 'Could not parse structured data',
        data_gaps: ['all fields'],
        summary: raw,
        methodology_note: 'Manual review required'
      });
    }

    return res.status(200).json({ ...parsed, model_used: selectedModel });

  } catch(err) {
    console.error('scope3 error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
