// -----------------------------------------------------------------------------
// Central runtime configuration for the Multi Hazard Monitoring frontend.
// Every API + OAuth credential resolves dynamically so the same production
// build works on Vercel (frontend) and Render (backend) without hardcoding
// localhost URLs anywhere in the app.
// -----------------------------------------------------------------------------

const readEnv = (key) => {
  if (typeof window !== 'undefined') {
    const runtime = window.__MH_CONFIG__ || {};
    if (runtime[key]) return runtime[key];
  }
  return (typeof process !== 'undefined' && process.env && process.env[key]) || '';
};

const trimSlash = (url) => String(url || '').replace(/\/+$/, '');

// Backend base URL (live production backend hosted on Render).
export const API_BASE_URL = trimSlash(
  readEnv('REACT_APP_API_BASE_URL') || 'https://multi-hazard-backend.onrender.com'
);

// Google OAuth Client ID (Explicitly set to ensure Official Google OAuth Popup loads).
export const GOOGLE_CLIENT_ID =
  readEnv('REACT_APP_GOOGLE_CLIENT_ID') ||
  readEnv('GOOGLE_CLIENT_ID') ||
  '1095227319145-f8efi0aa283hlu3815faad6c17omjv3e.apps.googleusercontent.com';

// Google Gemini API key for the multilingual AI Chatbot Copilot (read securely
// from process.env / runtime config; never hardcoded).
export const GEMINI_API_KEY = readEnv('REACT_APP_GEMINI_API_KEY') || '';

// Optional model override (defaults to a fast, widely-available Gemini model).
export const GEMINI_MODEL = readEnv('REACT_APP_GEMINI_MODEL') || 'gemini-2.0-flash';

// Build an absolute API URL from either "/api/..." or "https://...".
export const apiUrl = (path) => {
  const p = String(path || '');
  if (/^https?:\/\//.test(p)) return p;
  return `${API_BASE_URL}${p.startsWith('/') ? p : `/${p}`}`;
};

// Small retry helper used to survive Render cold starts.
export const withRetry = async (fn, retries = 3, baseBackoffMs = 2500) => {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        console.warn(`[config] retry ${attempt + 1}/${retries} after: ${err?.message}`);
        await new Promise((r) => setTimeout(r, baseBackoffMs * (attempt + 1)));
      }
    }
  }
  throw lastErr;
};

// Minimal CSS-aware skeleton shimmer used across loading states.
export const SKELETON = {
  background: 'linear-gradient(90deg, rgba(148,163,184,0.12) 25%, rgba(148,163,184,0.22) 50%, rgba(148,163,184,0.12) 75%)',
  backgroundSize: '200% 100%',
  animation: 'mh-skeleton-shimmer 1.4s ease-in-out infinite'
};