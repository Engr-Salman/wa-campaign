const trimTrailingSlash = (value) => (value ? value.replace(/\/+$/, '') : value);

const apiBaseFromEnv = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL);
const socketUrlFromEnv = trimTrailingSlash(import.meta.env.VITE_SOCKET_URL);
const localApiBase = `http://${window.location.hostname}:3001`;

export const API_BASE_URL =
  apiBaseFromEnv || (window.location.hostname === 'localhost' ? localApiBase : '');

export const SOCKET_URL =
  socketUrlFromEnv || API_BASE_URL || window.location.origin;

// Warn at startup if VITE_API_BASE_URL was accidentally set to this site's own
// URL.  When that happens every /api/* request hits the Netlify CDN, gets
// matched by the SPA catch-all redirect, and returns index.html instead of
// JSON — causing the "Unexpected end of JSON" / HTML error below.
if (typeof window !== 'undefined' && apiBaseFromEnv) {
  try {
    const configuredOrigin = new URL(apiBaseFromEnv).origin;
    if (configuredOrigin === window.location.origin) {
      console.error(
        '[WA Campaign] VITE_API_BASE_URL is set to this site\'s own origin ' +
        `(${apiBaseFromEnv}). It must point to your BACKEND server, not this ` +
        'frontend. Clear VITE_API_BASE_URL in Netlify and use BACKEND_URL instead — ' +
        'see netlify.toml for setup instructions.'
      );
    }
  } catch {
    // invalid URL — ignore, will surface as a network error anyway
  }
}

export function apiUrl(path) {
  if (!path) return API_BASE_URL || '/';
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith('/')) {
    throw new Error(`apiUrl expected an absolute path, received: ${path}`);
  }
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

function looksLikeHtml(text) {
  const sample = (text || '').trim().slice(0, 200).toLowerCase();
  return sample.startsWith('<!doctype html') || sample.startsWith('<html');
}

export async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (looksLikeHtml(text)) {
      // Detect the common Netlify misconfiguration: VITE_API_BASE_URL pointing
      // to the frontend origin instead of the backend.
      let hint;
      if (
        apiBaseFromEnv &&
        typeof window !== 'undefined' &&
        (() => {
          try { return new URL(apiBaseFromEnv).origin === window.location.origin; }
          catch { return false; }
        })()
      ) {
        hint =
          `VITE_API_BASE_URL is set to this site's own URL (${apiBaseFromEnv}). ` +
          'That makes API requests loop back to the frontend — the backend is never reached. ' +
          'Fix: remove VITE_API_BASE_URL from Netlify and set BACKEND_URL to your backend URL instead ' +
          '(e.g. https://wa-backend.up.railway.app). See netlify.toml for full instructions.';
      } else {
        const where = API_BASE_URL || '(same origin — no BACKEND_URL proxy configured)';
        hint =
          `Backend API is not reachable. The frontend is trying to reach: ${where}. ` +
          'Make sure BACKEND_URL and VITE_SOCKET_URL are set in Netlify to your backend URL, ' +
          'and that the backend server is running.';
      }
      throw new Error(hint);
    }
    const fallbackMessage =
      text.trim() || `Request failed with status ${response.status}`;

    throw new Error(fallbackMessage);
  }
}

export async function readJsonOrThrow(response, fallbackMessage) {
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || fallbackMessage || 'Request failed');
  }

  return data;
}
