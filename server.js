const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { handleMessage, handleOption, getSession, createSession } = require('./src/chatbot-flow');

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'chatbot-001', version: '1.0.0' });
});

app.post('/api/chat', (req, res) => {
  const { sessionId, message, optionId } = req.body || {};

  if (!optionId && (!message || typeof message !== 'string' || message.trim().length === 0)) {
    return res.status(400).json({ error: 'Message or optionId is required' });
  }
  if (message && message.length > 500) {
    return res.status(400).json({ error: 'Message too long (max 500 chars)' });
  }

  let session;
  if (sessionId) {
    session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session expired or not found' });
  } else {
    session = createSession();
  }

  let result;
  if (optionId) {
    result = handleOption(session, optionId);
  } else {
    result = handleMessage(session, message.trim());
  }
  res.json({ sessionId: session.id, ...result });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Chatbot-001 listening on port ${PORT}`);
});
