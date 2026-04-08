// ============================================
// API CONFIGURATION
// Keys are loaded from localStorage (set via setup.html)
// ============================================

const _keys = JSON.parse(localStorage.getItem('fittrack_keys') || '{}');

const CONFIG = {
  SUPABASE_URL: _keys.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: _keys.SUPABASE_ANON_KEY || '',
  USDA_API_KEY: _keys.USDA_API_KEY || '',
  OPENAI_API_KEY: _keys.OPENAI_API_KEY || '',
  OPENFOODFACTS_URL: 'https://world.openfoodfacts.org',
  WGER_URL: 'https://wger.de/api/v2',
};

// Redirect to setup if Supabase keys are missing (except on setup page itself)
if (!CONFIG.SUPABASE_URL && !window.location.pathname.includes('setup')) {
  window.location.href = 'setup.html';
}
