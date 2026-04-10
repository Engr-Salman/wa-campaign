require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaign');
const contactRoutes = require('./routes/contacts');
const settingsRoutes = require('./routes/settings');
const creditsRoutes = require('./routes/credits');
const adminRoutes = require('./routes/admin');
const waClient = require('./whatsapp/client');
const sender = require('./whatsapp/sender');
const { authMiddleware } = require('./middleware/auth');

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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
  res.json({
    status: waClient.getConnectionStatus(),
    info: waClient.getClientInfo(),
  });
});

// WhatsApp logout (protected)
app.post('/api/whatsapp/logout', authMiddleware, async (req, res) => {
  try {
    await waClient.logout();
    res.json({ status: 'logged_out' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.emit('whatsapp:status', {
    status: waClient.getConnectionStatus(),
    info: waClient.getClientInfo(),
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize WhatsApp client and sender
sender.setIo(io);
waClient.initClient(io);

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
