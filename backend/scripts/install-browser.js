const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function normalizeHomeDir(homeDir) {
  if (!homeDir) return homeDir;
  const marker = '/domains/';
  const markerIndex = homeDir.indexOf(marker);
  if (markerIndex > 0) {
    return homeDir.slice(0, markerIndex);
  }
  return homeDir;
}

function normalizeCacheDir(cacheDir) {
  if (!cacheDir) return cacheDir;
  const marker = '/domains/';
  if (cacheDir.includes(marker)) {
    const homeRoot = cacheDir.slice(0, cacheDir.indexOf(marker));
    return path.posix.join(homeRoot, '.cache', 'puppeteer');
  }
  return cacheDir;
}

function resolveCacheDir() {
  const envPath = process.env.PUPPETEER_CACHE_DIR;
  if (envPath && path.isAbsolute(envPath)) {
    const normalized = normalizeCacheDir(envPath);
    if (normalized !== envPath) {
      console.warn(
        `[puppeteer] Remapped PUPPETEER_CACHE_DIR from non-executable shared path ${envPath} to ${normalized}`
      );
    }
    return normalized;
  }
  const rawHomeDir = process.env.HOME || process.env.USERPROFILE || path.join(__dirname, '..');
  const homeDir = normalizeHomeDir(rawHomeDir);
  return path.join(homeDir, '.cache', 'puppeteer');
}

const cacheDir = resolveCacheDir();

fs.mkdirSync(cacheDir, { recursive: true });

let cliPath;
try {
  cliPath = require.resolve('puppeteer/lib/cjs/puppeteer/node/cli.js');
} catch (error) {
  console.warn('[puppeteer] CLI not found. Skipping browser install.');
  process.exit(0);
}

console.log(`[puppeteer] Installing Chrome into ${cacheDir}`);

const result = spawnSync(
  process.execPath,
  [cliPath, 'browsers', 'install', 'chrome'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PUPPETEER_CACHE_DIR: cacheDir,
      PUPPETEER_SKIP_DOWNLOAD: 'false',
    },
  }
);

if (result.status !== 0) {
  console.warn(
    '[puppeteer] Chrome install did not complete during install. The app will try to run with any available browser at runtime.'
  );
}
