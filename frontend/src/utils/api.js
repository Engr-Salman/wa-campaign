const trimTrailingSlash = (value) => (value ? value.replace(/\/+$/, '') : value);

const apiBaseFromEnv = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL);
const socketUrlFromEnv = trimTrailingSlash(import.meta.env.VITE_SOCKET_URL);
const localApiBase = `http://${window.location.hostname}:3001`;

export const API_BASE_URL =
  apiBaseFromEnv || (window.location.hostname === 'localhost' ? localApiBase : '');

export const SOCKET_URL =
  socketUrlFromEnv || API_BASE_URL || window.location.origin;

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
      const configuredApiBase = API_BASE_URL || '(not set)';
      throw new Error(
        `Backend API is not reachable from this frontend. Configure VITE_API_BASE_URL (current: ${configuredApiBase}) and redeploy.`
      );
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
