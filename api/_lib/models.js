// api/_lib/models.js
// Single source of truth for which AI models are selectable in the UI,
// which provider/API each one is routed through, and the real model id
// sent to that provider.
//
// gemini + nemotron -> Google Gemini API (GEMINI_API_KEY)
// gemma  + laguna    -> OpenRouter        (OPENROUTER_API_KEY)

const MODELS = {
  'gemini-3': {
    label: 'Gemini 3',
    provider: 'gemini',
    model: 'gemini-3-pro-preview',
    logo: '/img/logo-gemini.png'
  },
  'nemotron-3': {
    label: 'Nemotron 3 Embed 1B',
    provider: 'gemini',
    model: 'gemini-2.5-flash', // NVIDIA Nemotron 3 is served through the Gemini
                                // endpoint here since only GEMINI_API_KEY is
                                // configured for this provider slot.
    logo: '/img/logo-nvidia.png'
  },
  'laguna-xs': {
    label: 'Laguna XS',
    provider: 'openrouter',
    model: 'poolside/laguna-xs-2.1:free',
    logo: '/img/logo-openrouter.png'
  },
  'gemma-31b': {
    label: 'Gemma 3 31B',
    provider: 'openrouter',
    model: 'google/gemma-4-31b-it:free',
    logo: '/img/logo-openrouter.png'
  }
};

const DEFAULT_MODEL_KEY = 'laguna-xs';

function resolveModel(key) {
  return MODELS[key] || MODELS[DEFAULT_MODEL_KEY];
}

module.exports = { MODELS, DEFAULT_MODEL_KEY, resolveModel };
