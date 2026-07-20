// api/_lib/gemini.js
// Shared helper for calling Google's Gemini API (generateContent) with the
// same {text, modelUsed} shape that api/_lib/openrouter.js returns, so
// callers can swap providers without changing their own code.

const GEMINI_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/**
 * @param {Array<{role: string, content: string}>} messages  OpenRouter-style
 *   messages ({role: 'system'|'user'|'assistant', content: string}).
 * @param {object} [opts]
 * @param {string} [opts.model]        Gemini model id, e.g. 'gemini-2.5-flash'.
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @returns {Promise<{ text: string, modelUsed: string }>}
 */
async function callGemini(messages, opts = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('AI is not configured on this server (missing GEMINI_API_KEY).');
    err.statusCode = 503;
    throw err;
  }

  const { model = 'gemini-2.5-flash', temperature = 0.3, maxTokens = 800 } = opts;

  // Gemini has no separate "system" role — fold any system message into the
  // first user turn, and map assistant -> model.
  const systemMsg = messages.find(m => m.role === 'system');
  const turns = messages.filter(m => m.role !== 'system');

  const contents = turns.map((m, i) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{
      text: (i === 0 && systemMsg) ? `${systemMsg.content}\n\n${m.content}` : m.content
    }]
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(`${GEMINI_URL(model)}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text();
      const err = new Error(`Gemini (${model}) returned ${res.status}: ${errBody.slice(0, 300)}`);
      err.statusCode = res.status === 429 ? 429 : 502;
      throw err;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    if (!text) {
      const err = new Error(`Gemini (${model}) returned no content.`);
      err.statusCode = 502;
      throw err;
    }

    return { text, modelUsed: model };
  } catch (e) {
    clearTimeout(timeout);
    if (!e.statusCode) e.statusCode = 500;
    throw e;
  }
}

module.exports = { callGemini };
