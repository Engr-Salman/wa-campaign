require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaign');
const contactRoutes = require('./routes/contacts');
const settingsRoutes = require('./routes/settings');
const creditsRoutes = require('./routes/credits');
const adminRoutes = require('./routes/admin');
const db = require('./db/database');
const waClient = require('./whatsapp/client');
const sender = require('./whatsapp/sender');
const { authMiddleware, JWT_SECRET } = require('./middleware/auth');

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const FRONTEND_DIST_PATH = path.join(__dirname, '..', 'frontend', 'dist');
const hasFrontendBuild = require('fs').existsSync(FRONTEND_DIST_PATH);

const allowedOrigins = [FRONTEND_URL].filter(Boolean);
function corsOrigin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.getUserById(decoded.id);
    if (!user || !user.is_verified) {
      return next(new Error('Unauthorized'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Unauthorized'));
  }
});

// Middleware
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
if (hasFrontendBuild) {
  app.use(express.static(FRONTEND_DIST_PATH));
}

// Public routes (no auth)
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/admin', adminRoutes);

// WhatsApp status endpoint (protected)
app.get('/api/whatsapp/status', authMiddleware, (req, res) => {
  waClient.initClient(io, req.user.id);
  res.json({
    status: waClient.getConnectionStatus(req.user.id),
    info: waClient.getClientInfo(req.user.id),
  });
});

// WhatsApp logout (protected)
app.post('/api/whatsapp/logout', authMiddleware, async (req, res) => {
  try {
    await waClient.logout(req.user.id);
    res.json({ status: 'logged_out' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (hasFrontendBuild) {
  app.get(/^(?!\/api|\/socket\.io|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST_PATH, 'index.html'));
  });
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.join(`user:${socket.user.id}`);
  waClient.initClient(io, socket.user.id);

  socket.emit('whatsapp:status', {
    status: waClient.getConnectionStatus(socket.user.id),
    info: waClient.getClientInfo(socket.user.id),
  });
  const qrCode = waClient.getQrCode(socket.user.id);
  if (qrCode) {
    socket.emit('whatsapp:qr', qrCode);
  }

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize WhatsApp client and sender
sender.setIo(io);
const recoveredCampaigns = db.recoverInterruptedCampaigns();
if (recoveredCampaigns > 0) {
  console.log(`Recovered ${recoveredCampaigns} interrupted campaign(s) to paused state`);
}
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  if (hasFrontendBuild) {
    console.log(`Serving frontend build from ${FRONTEND_DIST_PATH}`);
  }
});
