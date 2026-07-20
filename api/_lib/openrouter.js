// api/_lib/openrouter.js
// Shared helper for calling OpenRouter's chat-completions API with an
// automatic fallback chain across three free models. If a model is
// rate-limited, down, or errors out, the next one in the list is tried.

const MODEL_CHAIN = [
  'google/gemma-4-31b-it:free',
  'poolside/laguna-xs-2.1:free',
  'nvidia/nemotron-3-nano-30b-a3b:free'
];

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Calls OpenRouter, trying each model in MODEL_CHAIN in order until one
 * succeeds. Throws only if every model in the chain fails.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [opts]
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @returns {Promise<{ text: string, modelUsed: string }>}
 */
async function callOpenRouter(messages, opts = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const err = new Error('AI is not configured on this server (missing OPENROUTER_API_KEY).');
    err.statusCode = 503;
    throw err;
  }

  const { temperature = 0.3, maxTokens = 800, model: preferredModel } = opts;
  // If the caller (e.g. the model dropdown) asked for a specific model, try
  // that first, then fall back to the rest of the chain if it fails.
  const chain = preferredModel
    ? [preferredModel, ...MODEL_CHAIN.filter(m => m !== preferredModel)]
    : MODEL_CHAIN;
  let lastError = null;

  for (const model of chain) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          // OpenRouter uses these for its free-tier leaderboard / rankings.
          'HTTP-Referer': process.env.SITE_URL || 'https://theclimatearchitects.vercel.app',
          'X-Title': 'The Climate Architects'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errBody = await res.text();
        lastError = new Error(`OpenRouter (${model}) returned ${res.status}: ${errBody.slice(0, 300)}`);
        console.error(lastError.message);
        continue; // try next model
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        lastError = new Error(`OpenRouter (${model}) returned no content.`);
        console.error(lastError.message);
        continue;
      }

      return { text, modelUsed: model };
    } catch (e) {
      lastError = e;
      console.error(`OpenRouter (${model}) failed:`, e.message);
      // try next model
    }
  }

  const err = new Error('All AI models are temporarily unavailable. Please try again shortly.');
  err.statusCode = 503;
  err.cause = lastError;
  throw err;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function extractJson(rawText) {
  if (!rawText) return null;
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Provider-agnostic entry point used by the model dropdown: resolves the
 * UI's selected model key to a provider (gemini/openrouter) + real model id,
 * and calls the matching helper.
 */
async function callAI(messages, opts = {}) {
  const { resolveModel } = require('./models');
  const { callGemini } = require('./gemini');

  const { modelKey, temperature, maxTokens } = opts;
  const { provider, model } = resolveModel(modelKey);

  if (provider === 'gemini') {
    return callGemini(messages, { model, temperature, maxTokens });
  }
  return callOpenRouter(messages, { model, temperature, maxTokens });
}

module.exports = { callOpenRouter, callAI, setCors, extractJson, MODEL_CHAIN };
