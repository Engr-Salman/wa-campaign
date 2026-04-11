// Base URL of the backend API.
//
// - In local development (Vite dev server), this is empty so requests go through
//   the Vite proxy defined in vite.config.js (/api -> http://localhost:3001).
// - In a Netlify (or other static) deployment, set VITE_API_URL at build time to
//   the public URL of your backend (e.g. https://my-backend.up.railway.app).
//   All /api/* requests will then go directly to that host.
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Prefix an API path with the base URL. Paths should start with "/".
export const apiUrl = (path) => `${API_BASE}${path}`;
