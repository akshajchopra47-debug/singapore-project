// functions/api/scope3.js
// Cloudflare Pages Function — Scope 3 Carbon Engine
// URL: /api/scope3  (POST)
// Accepts a base64-encoded supplier document, sends it to Claude via
// OpenRouter, and returns structured carbon extraction data.

import { ok, err, cors, parseBody } from '../_shared/helpers.js';

const EXTRACTION_PROMPT = `You are an expert carbon accounting analyst specialising in Scope 3 supply chain emissions for ASEAN manufacturing suppliers.

Analyse this supplier document carefully. It may be an invoice, utility bill, delivery note, or factory record from a supplier in Vietnam, Bangladesh, Indonesia, India, Thailand, or another ASEAN country. The document may be in English or another language.

Extract every carbon-relevant data point you can find. Look specifically for:
- Energy consumption (electricity in kWh, fuel in litres or kg)
- Production or output volume (units, kg, tonnes, metres)
- Fuel types used (diesel, LPG, natural gas, coal, etc.)
- Company name and location/country
- Industry or product type
- Reporting period or invoice date
- Any existing emissions data or carbon figures

Return ONLY a valid JSON object in this exact format with no additional text, markdown, or explanation:

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
  "confidence_reason": "one sentence explaining confidence level",
  "data_gaps": ["list", "of", "missing", "fields"],
  "summary": "2-3 sentence professional summary of what was found and what it means for Scope 3 calculation",
  "methodology_note": "which calculation method will be used: activity-based, spend-based, or hybrid, and why"
}

Confidence levels:
HIGH = direct energy/fuel consumption data found
MEDIUM = production volumes found but no direct energy data
LOW = only company/country/industry found, no activity data`;

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    let apiKey = env.OPENROUTER_API_KEY;
    let useGemini = false;
    
    if (!apiKey) {
      if (env.GEMINI_API_KEY) {
        apiKey = env.GEMINI_API_KEY;
        useGemini = true;
      } else {
        return err('Neither OpenRouter nor Gemini API key is configured', env, 500);
      }
    }

    const body = await parseBody(request);
    const { fileData, mimeType, fileName } = body;

    if (!fileData || !mimeType) {
      return err('fileData and mimeType are required', env, 400);
    }

    // Validate file type
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(mimeType)) {
      return err('Unsupported file type. Please upload a PDF, JPG, or PNG.', env, 400);
    }

    let rawContent;

    if (useGemini) {
      // Direct call to Gemini 2.5 Flash model supporting inline PDF base64
      const geminiPayload = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: fileData
                }
              },
              {
                text: EXTRACTION_PROMPT
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        }
      );

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error('Gemini Scope3 error:', errText);
        return err('AI service error. Please try again.', env, 502);
      }

      const geminiData = await geminiRes.json();
      rawContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
      // Build the message content array for Claude
      const messageContent = [];

      if (mimeType === 'application/pdf') {
        // Claude supports PDF documents directly via the document type
        messageContent.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: fileData
          }
        });
      } else {
        // Image (JPEG or PNG)
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: fileData
          }
        });
      }

      messageContent.push({
        type: 'text',
        text: EXTRACTION_PROMPT
      });

      const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://bholi-pi.vercel.app',
          'X-Title': 'The Climate Architects — Scope 3 Engine'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-5',
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: messageContent
            }
          ]
        })
      });

      if (!openRouterResponse.ok) {
        const errText = await openRouterResponse.text();
        console.error('OpenRouter error:', errText);
        return err('AI service error. Please try again in a moment.', env, 502);
      }

      const openRouterData = await openRouterResponse.json();
      rawContent = openRouterData?.choices?.[0]?.message?.content;
    }

    if (!rawContent) {
      return err('No response from AI. Please try again.', env, 502);
    }

    // Parse the JSON response from Claude
    let parsed;
    try {
      // Strip any markdown code fences Claude might add
      const cleaned = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw content:', rawContent);
      // Return raw text if JSON parsing fails — frontend still renders summary
      parsed = {
        extracted: {},
        confidence: 'LOW',
        confidence_reason: 'Could not parse structured data from document',
        data_gaps: ['all fields'],
        summary: rawContent,
        methodology_note: 'Manual review required',
        raw: rawContent
      };
    }

    return ok(parsed, env);

  } catch (e) {
    console.error('scope3 handler error:', e);
    return err('Server error: ' + (e.message || 'Unknown error'), env, 500);
  }
}

export async function onRequestOptions({ env }) {
  return cors(env);
}
