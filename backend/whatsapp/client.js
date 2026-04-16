const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer');
const { WWEBJS_DIR } = require('../utils/paths');

let io = null;
const sessions = new Map();

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

const runtimeHomeDir = normalizeHomeDir(process.env.HOME || process.env.USERPROFILE || path.join(__dirname, '..'));
const defaultPuppeteerCacheDir = path.join(
  runtimeHomeDir,
  '.cache',
  'puppeteer'
);

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
  if (envPath && !path.isAbsolute(envPath)) {
    console.warn(
      `[puppeteer] Ignoring relative PUPPETEER_CACHE_DIR (${envPath}). Using absolute fallback: ${defaultPuppeteerCacheDir}`
    );
  }
  return defaultPuppeteerCacheDir;
}

const puppeteerCacheDir = resolveCacheDir();
process.env.PUPPETEER_CACHE_DIR = puppeteerCacheDir;

function ensureExecutablePermission(executablePath) {
  try {
    fs.accessSync(executablePath, fs.constants.X_OK);
    return executablePath;
  } catch {
    try {
      fs.chmodSync(executablePath, 0o755);
      fs.accessSync(executablePath, fs.constants.X_OK);
      return executablePath;
    } catch {
      return executablePath;
    }
  }
}

function installChromeIfMissing() {
  let cliPath;
  try {
    cliPath = require.resolve('puppeteer/lib/cjs/puppeteer/node/cli.js');
  } catch {
    return;
  }

  fs.mkdirSync(puppeteerCacheDir, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [cliPath, 'browsers', 'install', 'chrome'],
    {
      stdio: 'pipe',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR: puppeteerCacheDir,
        PUPPETEER_SKIP_DOWNLOAD: 'false',
      },
    }
  );

  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim();
    const stdout = result.stdout?.toString().trim();
    console.warn('[puppeteer] Runtime Chrome install failed.');
    if (stderr) console.warn(stderr);
    if (stdout) console.warn(stdout);
  }
}

function resolveExecutablePath() {
  const explicitPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH;

  if (explicitPath) {
    const normalizedExplicitPath = normalizeCacheDir(explicitPath);
    if (normalizedExplicitPath !== explicitPath) {
      console.warn(
        `[puppeteer] Ignoring executable path under /domains/: ${explicitPath}. Using ${normalizedExplicitPath} instead.`
      );
    }

    if (fs.existsSync(normalizedExplicitPath)) {
      return { executablePath: ensureExecutablePermission(normalizedExplicitPath), source: 'env' };
    }

    return {
      executablePath: undefined,
      source: 'env',
      warning: `Configured browser path does not exist: ${normalizedExplicitPath}`,
    };
  }

  try {
    const bundledPath = puppeteer.executablePath();
    if (bundledPath && fs.existsSync(bundledPath)) {
      return { executablePath: ensureExecutablePermission(bundledPath), source: 'puppeteer' };
    }
  } catch {
    // Continue without executablePath and let runtime report an actionable error.
  }

  // Self-heal for environments where build-time cache path and runtime path differ.
  installChromeIfMissing();
  try {
    const installedPath = puppeteer.executablePath();
    if (installedPath && fs.existsSync(installedPath)) {
      return {
        executablePath: ensureExecutablePermission(installedPath),
        source: 'puppeteer-runtime-install',
      };
    }
  } catch {
    // keep falling back
  }

  return { executablePath: undefined, source: 'auto' };
}

function getRoom(userId) {
  return `user:${userId}`;
}

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      client: null,
      status: 'disconnected',
      info: null,
      qr: null,
      message: '',
      initializing: false,
      initPromise: null,
      initTimeout: null,
    });
  }

  return sessions.get(userId);
}

function getAuthSessionDir(userId) {
  return path.join(WWEBJS_DIR, `session-user-${userId}`);
}

function cleanupSessionLocks(userId) {
  const sessionDir = getAuthSessionDir(userId);
  const staleFiles = [
    'SingletonLock',
    'SingletonSocket',
    'SingletonCookie',
    'DevToolsActivePort',
  ];

  for (const fileName of staleFiles) {
    const filePath = path.join(sessionDir, fileName);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn(`[whatsapp] Failed to remove stale lock file ${filePath}:`, error.message);
    }
  }
}

function cleanupStaleBrowserProcesses(userId) {
  if (process.platform === 'win32') {
    return;
  }

  const sessionDir = getAuthSessionDir(userId);
  try {
    const result = spawnSync('sh', ['-lc', `ps -eo pid=,args= | grep -F "${sessionDir}" | grep -E "chrome|chromium" | grep -v grep || true`], {
      encoding: 'utf8',
    });
    const output = result.stdout || '';
    const pids = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/, 1)[0])
      .filter(Boolean);

    for (const pid of pids) {
      const killResult = spawnSync('kill', ['-9', pid], { encoding: 'utf8' });
      if (killResult.status === 0) {
        console.warn(`[whatsapp] Killed stale browser process ${pid} for user ${userId}`);
      }
    }
  } catch (error) {
    console.warn(`[whatsapp] Failed to clean stale browser processes for user ${userId}:`, error.message);
  }

  cleanupSessionLocks(userId);
}

function emitStatus(userId, extra = {}) {
  if (!io) return;

  const session = getSession(userId);
  io.to(getRoom(userId)).emit('whatsapp:status', {
    status: session.status,
    info: session.info,
    message: session.message || '',
    ...extra,
  });
}

function emitQr(userId, qr) {
  if (!io) return;
  io.to(getRoom(userId)).emit('whatsapp:qr', qr);
}

function getConnectionStatus(userId) {
  return getSession(userId).status;
}

function getClientInfo(userId) {
  return getSession(userId).info;
}

function getQrCode(userId) {
  return getSession(userId).qr;
}

function getStatusSnapshot(userId) {
  const session = getSession(userId);
  return {
    status: session.status,
    info: session.info,
    qr: session.qr,
    message: session.message || '',
  };
}

function getClient(userId) {
  return getSession(userId).client;
}

function clearInitTimeout(session) {
  if (session.initTimeout) {
    clearTimeout(session.initTimeout);
    session.initTimeout = null;
  }
}

function initClient(socketIo, userId) {
  io = socketIo;
  const session = getSession(userId);

  if (session.initPromise) {
    return session.initPromise;
  }

  if (session.client || session.initializing) {
    return Promise.resolve(session.client);
  }

  session.initializing = true;
  session.status = 'initializing';
  session.message = '';
  session.qr = null;
  const { executablePath, source, warning } = resolveExecutablePath();
  console.log(`[whatsapp] Initializing client for user ${userId} using browser source=${source}${executablePath ? ` path=${executablePath}` : ''}`);
  if (warning) {
    console.warn(`WhatsApp browser path warning for user ${userId}: ${warning}`);
  }

  cleanupStaleBrowserProcesses(userId);

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `user-${userId}`,
      dataPath: WWEBJS_DIR,
    }),
    puppeteer: {
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-features=site-per-process',
        '--disable-features=IsolateOrigins',
      ],
    },
  });

  session.client = client;
  clearInitTimeout(session);
  session.initTimeout = setTimeout(async () => {
    if (!session.initializing || session.status === 'qr' || session.status === 'connected') {
      return;
    }

    session.initializing = false;
    session.initPromise = null;
    session.status = 'error';
    session.message = 'WhatsApp initialization timed out before a QR code was generated. Please try again.';

    try {
      await client.destroy();
    } catch {
      // ignore cleanup failure
    }

    session.client = null;
    emitStatus(userId);
  }, 90000);

  client.on('qr', (qr) => {
    clearInitTimeout(session);
    session.status = 'qr';
    session.qr = qr;
    session.message = '';
    console.log(`[whatsapp] QR generated for user ${userId}`);
    emitQr(userId, qr);
    emitStatus(userId);
  });

  client.on('authenticated', () => {
    session.status = 'authenticated';
    session.message = '';
    console.log(`[whatsapp] Authenticated for user ${userId}`);
    emitStatus(userId);
  });

  client.on('auth_failure', (msg) => {
    clearInitTimeout(session);
    session.initializing = false;
    session.initPromise = null;
    session.status = 'auth_failure';
    session.info = null;
    session.qr = null;
    session.message = msg || 'WhatsApp authentication failed.';
    session.client = null;
    console.error(`[whatsapp] Authentication failure for user ${userId}: ${session.message}`);
    emitStatus(userId);
  });

  client.on('ready', () => {
    clearInitTimeout(session);
    session.initializing = false;
    session.initPromise = null;
    session.status = 'connected';
    session.qr = null;
    session.message = '';
    session.info = {
      pushname: client.info.pushname,
      phone: client.info.wid.user,
      platform: client.info.platform,
    };
    console.log(`[whatsapp] Ready for user ${userId} (${session.info.pushname || 'unknown'} / ${session.info.phone || 'unknown'})`);
    emitStatus(userId);
  });

  client.on('disconnected', (reason) => {
    clearInitTimeout(session);
    session.initializing = false;
    session.initPromise = null;
    session.status = 'disconnected';
    session.info = null;
    session.qr = null;
    session.message = reason || '';
    session.client = null;
    console.warn(`[whatsapp] Disconnected for user ${userId}: ${reason || 'unknown reason'}`);
    emitStatus(userId, { reason });
  });

  client.on('change_state', (state) => {
    console.log(`[whatsapp] State changed for user ${userId}: ${state}`);
    emitStatus(userId, { state });
  });

  session.initPromise = client.initialize()
    .then(() => client)
    .catch(async (err) => {
      console.error(`WhatsApp client init error for user ${userId}:`, err);
      clearInitTimeout(session);
      session.initializing = false;
      session.initPromise = null;
      session.client = null;
      session.status = 'error';
      session.info = null;
      session.qr = null;

      try {
        await client.destroy();
      } catch {
        // ignore cleanup failure
      }

      const hasSessionDirLock =
        typeof err.message === 'string' &&
        err.message.includes('browser is already running for');
      const troubleshootingHint = hasSessionDirLock
        ? 'A stale WhatsApp browser session was detected. Retry in a few seconds. If it persists, restart the backend once.'
        : executablePath
          ? undefined
          : 'No valid Chromium executable was found. Set CHROMIUM_PATH or PUPPETEER_EXECUTABLE_PATH to a valid browser binary.';

      session.message = troubleshootingHint ? `${err.message} ${troubleshootingHint}` : err.message;

      emitStatus(userId, {
        executablePath: executablePath || null,
        executablePathSource: source,
      });

      return null;
    });

  return session.initPromise;
}

async function ensureClient(userId) {
  const session = getSession(userId);
  if (!session.client && !session.initializing && io) {
    await initClient(io, userId);
  }
  return getSession(userId);
}

async function sendMessage(userId, phoneNumber, message, mediaPath) {
  const session = await ensureClient(userId);
  if (!session.client || session.status !== 'connected') {
    throw new Error('WhatsApp client not connected');
  }

  const chatId = `${phoneNumber}@c.us`;

  if (mediaPath) {
    const media = MessageMedia.fromFilePath(mediaPath);
    await session.client.sendMessage(chatId, media, { caption: message });
  } else {
    await session.client.sendMessage(chatId, message);
  }
}

async function logout(userId) {
  const session = getSession(userId);
  const { client } = session;

  if (client) {
    try {
      await Promise.race([
        client.logout(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('WhatsApp logout timed out')), 15000)),
      ]);
    } catch (e) {
      // ignore
    }
    try {
      await client.destroy();
    } catch (e) {
      // ignore
    }
  }

  session.client = null;
  session.initializing = false;
  session.initPromise = null;
  clearInitTimeout(session);
  session.status = 'disconnected';
  session.info = null;
  session.qr = null;
  session.message = '';
  emitStatus(userId);

  if (io) {
    initClient(io, userId);
  }
}

module.exports = {
  initClient,
  ensureClient,
  getClient,
  getConnectionStatus,
  getClientInfo,
  getQrCode,
  getStatusSnapshot,
  sendMessage,
  logout,
};
