const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB } = require('./config/database');
const logger = require('./utils/logger');

// === Route imports ===
const authRoutes = require('./routes/auth');
const contentRoutes = require('./routes/content');
const postRoutes = require('./routes/post');
const allPostsRoutes = require('./routes/allpost');
const categoryRoutes = require('./routes/category');
const ogPreviewRoutes = require('./routes/ogPreview');

const app = express();
const PORT = process.env.PORT || 8080;
const compression = require('compression');
app.use(compression());
const morgan = require('morgan');
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));


// === Security Middleware ===
app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // allow Google OAuth popups
  })
);

// === CORS CONFIG ===
const allowedPatterns = [
  /^http:\/\/localhost(:\d+)?$/,       // localhost dev ports (3000, 5173, etc.)
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,    // 127.0.0.1 local
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/, // LAN access
  /^https?:\/\/(www\.)?inspirestack\.net$/ // production domain
];
// const allowedOrigins = [
//   process.env.CORS_ORIGIN || 'http://localhost:3000',
//   process.env.CORS_ORIGIN1 || 'http://192.168.1.5:3000',
//   'http://inspirestack.net',
//   'https://inspirestack.net',
//   'https://www.inspirestack.net', 
//   'http://www.inspirestack.net'
// ];

app.use(
  cors({
    origin: (origin, callback) => {
      console.log('🌐 Incoming Origin:', origin);

      if (!origin) {
        // Allow curl / Postman / server-side requests
        return callback(null, true);
      }

      const allowed = allowedPatterns.some((pattern) => pattern.test(origin));
      console.log('✅ Allowed:', allowed);

      if (allowed) {
        callback(null, true);
      } else {
        console.warn('❌ Blocked by CORS:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

// ✅ Handle all preflight (OPTIONS) requests safely
app.options(/.*/, cors());




// app.use(
//   cors({
//     origin: (origin, callback) => {
//       console.log('🌐 Incoming Origin:', origin);
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, true);
//       }else{
//         console.warn('❌ Blocked by CORS:', origin);
//         callback(new Error('Not allowed by CORS'));
//       }
//     },
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     credentials: true,
//   })
// )

// === Parse JSON payloads ===
app.use(express.json({ limit: '10mb' }));

// === Rate Limiting ===
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { message: 'Too many requests from this IP' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`⚠️ Rate limit exceeded for IP: ${req.ip}`);
    res.status(options.statusCode).json(options.message);
  },
});

// Skip limiter for localhost testing
app.use((req, res, next) => {
  if (['::1', '127.0.0.1'].includes(req.ip)) return next();
  return limiter(req, res, next);
});

// === Routes ===
app.use('/api', allPostsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/content-type', contentRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/og-preview', ogPreviewRoutes);

// === Health Check ===
app.get('/api/check', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'MySQL',
  });
});

// === 404 Handler ===
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: 'Route not found' });
});

// === Global Error Handler ===
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ message: 'Duplicate entry' });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ message: 'Invalid reference' });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS error: Origin not allowed' });
  }

  res.status(500).json({ message: 'Internal server error' });
});



// === Start Server ===
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      logger.info(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
