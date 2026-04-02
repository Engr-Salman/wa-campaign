const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path = require('path');

let client = null;
let io = null;
let connectionStatus = 'disconnected';
let clientInfo = null;

function getClient() {
  return client;
}

function getConnectionStatus() {
  return connectionStatus;
}

function getClientInfo() {
  return clientInfo;
}

function initClient(socketIo) {
  io = socketIo;

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '..', '..', '.wwebjs_auth'),
    }),
    puppeteer: {
      headless: true,
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

  client.on('qr', (qr) => {
    connectionStatus = 'qr';
    io.emit('whatsapp:qr', qr);
    io.emit('whatsapp:status', { status: 'qr' });
  });

  client.on('authenticated', () => {
    connectionStatus = 'authenticated';
    io.emit('whatsapp:status', { status: 'authenticated' });
  });

  client.on('auth_failure', (msg) => {
    connectionStatus = 'auth_failure';
    io.emit('whatsapp:status', { status: 'auth_failure', message: msg });
  });

  client.on('ready', () => {
    connectionStatus = 'connected';
    clientInfo = {
      pushname: client.info.pushname,
      phone: client.info.wid.user,
      platform: client.info.platform,
    };
    io.emit('whatsapp:status', { status: 'connected', info: clientInfo });
  });

  client.on('disconnected', (reason) => {
    connectionStatus = 'disconnected';
    clientInfo = null;
    io.emit('whatsapp:status', { status: 'disconnected', reason });
  });

  client.on('change_state', (state) => {
    io.emit('whatsapp:status', {
      status: connectionStatus,
      state,
      info: clientInfo,
    });
  });

  client.initialize().catch((err) => {
    console.error('WhatsApp client init error:', err);
    connectionStatus = 'error';
    io.emit('whatsapp:status', {
      status: 'error',
      message: err.message,
    });
  });

  return client;
}

async function sendMessage(phoneNumber, message, mediaPath) {
  if (!client || connectionStatus !== 'connected') {
    throw new Error('WhatsApp client not connected');
  }

  const chatId = `${phoneNumber}@c.us`;

  if (mediaPath) {
    const media = MessageMedia.fromFilePath(mediaPath);
    await client.sendMessage(chatId, media, { caption: message });
  } else {
    await client.sendMessage(chatId, message);
  }
}

async function logout() {
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
    client = null;
    connectionStatus = 'disconnected';
    clientInfo = null;
    io.emit('whatsapp:status', { status: 'disconnected' });
  }
}

module.exports = {
  initClient,
  getClient,
  getConnectionStatus,
  getClientInfo,
  sendMessage,
  logout,
};
