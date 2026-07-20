// api/extract-pdf.js
// POST /api/extract-pdf
// AI-powered extraction for the carbon calculator's "Upload PDF" mode.
// The free OpenRouter models used here don't accept raw PDF bytes the way
// Gemini did, so this endpoint first extracts the raw text layer from the
// PDF (via pdf-parse) and then runs the same extraction prompt used by
// /api/extract-text through OpenRouter's fallback chain.

const { callOpenRouter, setCors, extractJson } = require('./_lib/openrouter');

const EXTRACTION_PROMPT = `You are a data-extraction assistant for a Scope 1 & 2 carbon calculator.

Read the document text below (extracted from an invoice, utility bill, or delivery note PDF) and extract:
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

  const { fileData, mimeType, fileName } = req.body || {};
  if (!fileData) {
    return res.status(400).json({ error: 'Please select a PDF first.' });
  }
  if (mimeType !== 'application/pdf') {
    return res.status(400).json({ error: 'Only PDF files are supported.' });
  }

  // ~15MB base64 ceiling to stay well under serverless payload limits
  if (fileData.length > 20_000_000) {
    return res.status(413).json({ error: 'PDF is too large. Please upload a file under 15MB.' });
  }

  try {
    // Lazy-require so a missing dependency only breaks this one route.
    const pdfParse = require('pdf-parse');
    const buffer = Buffer.from(fileData, 'base64');
    const parsed = await pdfParse(buffer);
    const text = (parsed.text || '').trim();

    if (text.length < 20) {
      return res.status(200).json({
        error: `Could not read any text from ${fileName || 'this PDF'}. It may be a scanned image — try the guided form instead.`
      });
    }

    const prompt = EXTRACTION_PROMPT + text.slice(0, 12000) + '\n"""';
    const { text: rawText } = await callOpenRouter(
      [{ role: 'user', content: prompt }],
      { temperature: 0.1, maxTokens: 300 }
    );

    const extracted = extractJson(rawText);
    if (!extracted) {
      return res.status(200).json({ error: `Could not extract structured data from ${fileName || 'this PDF'}. Try the guided form instead.` });
    }

    return res.status(200).json({ extracted });
  } catch (e) {
    console.error('extract-pdf error:', e);
    return res.status(e.statusCode || 500).json({ error: e.message || 'Something went wrong while analysing the PDF.' });
  }
};
