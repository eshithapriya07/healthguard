const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const readingRoutes = require('./routes/reading.routes');
const alertRoutes = require('./routes/alert.routes');
const reminderRoutes = require('./routes/reminder.routes');
const chatRoutes = require('./routes/chat.routes');
const reportRoutes = require('./routes/report.routes');
const shareRoutes = require('./routes/share.routes');
const adminRoutes = require('./routes/admin.routes');

const { ping } = require('./config/db');

const app = express();

// --- security & parsing -------------------------------------------------
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// --- simple request log (dev) -------------------------------------------
app.use((req, res, next) => {
  if (env.nodeEnv !== 'production') console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// --- health check --------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    await ping();
    res.json({ status: 'ok', service: 'healthguard-api', time: new Date().toISOString(), database: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', database: 'down', message: err.message });
  }
});

// --- feature routes ------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api', readingRoutes); // /api/parameters, /api/readings, /api/dashboard, /api/trends
app.use('/api', alertRoutes); // /api/alerts, /api/notifications
app.use('/api/reminders', reminderRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', reportRoutes); // /api/reports, /api/documents, /api/shared/...
app.use('/api', shareRoutes); // /api/shares, /api/shared/...
app.use('/api/admin', adminRoutes);

app.get('/api', (req, res) => {
  res.json({
    name: 'HealthGuard API',
    version: '1.0.0',
    endpoints: ['/api/auth', '/api/profile', '/api/parameters', '/api/readings', '/api/dashboard', '/api/trends',
      '/api/alerts', '/api/notifications', '/api/reminders', '/api/chat', '/api/reports', '/api/shares',
      '/api/shared', '/api/admin', '/api/health'],
  });
});

// --- production: serve the built React client (single-service deploy) ---
const clientDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      else res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));
  // SPA fallback: any non-API GET renders index.html so client routes work.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
