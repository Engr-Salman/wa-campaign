const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path = require('path');

let io = null;
const sessions = new Map();
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH;

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
      initializing: false,
    });
  }

  return sessions.get(userId);
}

function emitStatus(userId, extra = {}) {
  if (!io) return;

  const session = getSession(userId);
  io.to(getRoom(userId)).emit('whatsapp:status', {
    status: session.status,
    info: session.info,
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

function getClient(userId) {
  return getSession(userId).client;
}

function initClient(socketIo, userId) {
  io = socketIo;
  const session = getSession(userId);

  if (session.client || session.initializing) {
    return session.client;
  }

  session.initializing = true;
  session.status = 'initializing';

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `user-${userId}`,
      dataPath: path.join(__dirname, '..', '..', '.wwebjs_auth'),
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
      ],
    },
  });

  session.client = client;

  client.on('qr', (qr) => {
    session.status = 'qr';
    session.qr = qr;
    emitQr(userId, qr);
    emitStatus(userId);
  });

  client.on('authenticated', () => {
    session.status = 'authenticated';
    emitStatus(userId);
  });

  client.on('auth_failure', (msg) => {
    session.initializing = false;
    session.status = 'auth_failure';
    session.info = null;
    session.qr = null;
    session.client = null;
    emitStatus(userId, { message: msg });
  });

  client.on('ready', () => {
    session.initializing = false;
    session.status = 'connected';
    session.qr = null;
    session.info = {
      pushname: client.info.pushname,
      phone: client.info.wid.user,
      platform: client.info.platform,
    };
    emitStatus(userId);
  });

  client.on('disconnected', (reason) => {
    session.initializing = false;
    session.status = 'disconnected';
    session.info = null;
    session.qr = null;
    session.client = null;
    emitStatus(userId, { reason });
  });

  client.on('change_state', (state) => {
    emitStatus(userId, { state });
  });

  client.initialize().catch((err) => {
    console.error(`WhatsApp client init error for user ${userId}:`, err);
    session.initializing = false;
    session.client = null;
    session.status = 'error';
    session.info = null;
    session.qr = null;
    emitStatus(userId, { message: err.message });
  });

  return client;
}

async function ensureClient(userId) {
  const session = getSession(userId);
  if (!session.client && !session.initializing && io) {
    initClient(io, userId);
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
      await client.logout();
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
  session.status = 'disconnected';
  session.info = null;
  session.qr = null;
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
  sendMessage,
  logout,
};
