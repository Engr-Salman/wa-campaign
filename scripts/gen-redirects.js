#!/usr/bin/env node
/**
 * Generates frontend/public/_redirects before the Vite build.
 *
 * If BACKEND_URL is set (e.g. https://wa-backend.up.railway.app), Netlify
 * proxies all /api/* requests to that host server-side.  This means the
 * browser never makes cross-origin API calls, so CORS is not required for
 * API routes and VITE_API_BASE_URL can be left empty.
 *
 * Socket.IO WebSocket upgrades cannot be proxied through Netlify redirects.
 * Set VITE_SOCKET_URL to the backend origin so the browser connects directly.
 *
 * Expected Netlify environment variables
 * ─────────────────────────────────────
 *   BACKEND_URL      https://wa-backend.up.railway.app  (server-side proxy)
 *   VITE_SOCKET_URL  https://wa-backend.up.railway.app  (build-time, for ws)
 *   VITE_API_BASE_URL  ← leave EMPTY when using BACKEND_URL proxy
 */

const fs   = require('fs');
const path = require('path');

const backendUrl = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
const dest       = path.join(__dirname, '..', 'frontend', 'public', '_redirects');

const lines = [];

if (backendUrl) {
  // Proxy /api/* to the real backend (same-origin from browser's perspective).
  lines.push(`/api/*  ${backendUrl}/api/:splat  200`);
  console.log(`[gen-redirects] Proxying /api/* → ${backendUrl}/api/:splat`);
} else {
  console.log('[gen-redirects] BACKEND_URL not set — API calls will use VITE_API_BASE_URL directly.');
}

// SPA catch-all must come last.
lines.push('/*  /index.html  200');

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, lines.join('\n') + '\n');
console.log(`[gen-redirects] Written ${dest}`);
