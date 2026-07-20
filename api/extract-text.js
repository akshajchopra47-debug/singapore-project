// api/extract-text.js
// POST /api/extract-text
// AI-powered extraction for the carbon calculator's "Paste Text" mode.
// Reads pasted invoice / utility bill / delivery note text and pulls out
// the fields needed for Scope 1 (fuel combustion) and Scope 2 (electricity)
// calculations: country, electricity_kwh, fuel_type, fuel_quantity.
// Uses OpenRouter (free model fallback chain — see api/_lib/openrouter.js).

const { callAI, setCors, extractJson } = require('./_lib/openrouter');

const EXTRACTION_PROMPT = `You are a data-extraction assistant for a Scope 1 & 2 carbon calculator.

Read the document text below (an invoice, utility bill, or delivery note) and extract:
- country: the country of operation/usage (e.g. "Singapore", "Malaysia"). If not stated, infer from currency/context, otherwise null.
- electricity_kwh: total electricity consumption in kWh (Scope 2). Convert units if needed. Null if not present.
- fuel_type: one of "natural gas", "diesel", "petrol", "lpg", "coal", "heavy fuel oil", "biomass". Null if not present.
- fuel_quantity: the numeric quantity of that fuel, in the unit the document uses (litres, therms, kg). Null if not present.

Respond with ONLY a raw JSON object, no markdown, no commentary, in this exact shape:
{"country": string|null, "electricity_kwh": number|null, "fuel_type": string|null, "fuel_quantity": number|null}

Document text:
"""`;

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, model } = req.body || {};
  if (!text || String(text).trim().length < 20) {
    return res.status(400).json({ error: 'Please provide at least a few lines of document text.' });
  }

  try {
    const prompt = EXTRACTION_PROMPT + String(text).slice(0, 12000) + '\n"""';
    const { text: rawText, modelUsed } = await callAI(
      [{ role: 'user', content: prompt }],
      { modelKey: model, temperature: 0.1, maxTokens: 300 }
    );

    const extracted = extractJson(rawText);
    if (!extracted) {
      return res.status(200).json({ error: 'Could not extract structured data from that text. Try the guided form instead.' });
    }

    return res.status(200).json({ extracted, modelUsed });
  } catch (e) {
    console.error('extract-text error:', e);
    return res.status(e.statusCode || 500).json({ error: e.message || 'Something went wrong while analysing the text.' });
  }
};
