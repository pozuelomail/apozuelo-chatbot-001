const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { handleMessage, handleOption, getSession, createSession } = require('./src/chatbot-flow');

const CRM_API_URL = process.env.CRM_API_URL || 'http://crm-api.crm.svc.cluster.local:80';
const CRM_API_TOKEN = process.env.CRM_API_TOKEN || '';

function sendToCRM(crmData) {
  if (!CRM_API_TOKEN || !crmData) return;
  const url = new URL('/api/customers', CRM_API_URL);
  const payload = JSON.stringify(crmData);
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Authorization': `Bearer ${CRM_API_TOKEN}`,
    },
    timeout: 5000,
  };
  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (c) => body += c);
    res.on('end', () => {
      if (res.statusCode < 300) {
        console.log('[CRM] Lead created:', crmData.email);
      } else {
        console.warn('[CRM] Error creating lead:', res.statusCode, body);
      }
    });
  });
  req.on('error', (err) => console.error('[CRM] Request failed:', err.message));
  req.write(payload);
  req.end();
}

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

  if (result.crmData) {
    const crmData = result.crmData;
    delete result.crmData;
    setImmediate(() => sendToCRM(crmData));
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
