const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { handleMessage, handleOption, getSession, createSession } = require('./src/chatbot-flow');

const https = require('https');
const CRM_API_URL = process.env.CRM_API_URL || 'http://crm-api.crm.svc.cluster.local:80';
const CRM_API_TOKEN = process.env.CRM_API_TOKEN || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'pozuelomail@gmail.com';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';

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
        sendEmailNotification(crmData);
        sendToN8N(crmData);
      } else {
        console.warn('[CRM] Error creating lead:', res.statusCode, body);
      }
    });
  });
  req.on('error', (err) => console.error('[CRM] Request failed:', err.message));
  req.write(payload);
  req.end();
}

function sendEmailNotification(crmData) {
  if (!RESEND_API_KEY) {
    console.log('[EMAIL] No RESEND_API_KEY configured, skipping notification');
    return;
  }
  const subject = `Nuevo lead desde Chatbot — ${crmData.full_name}`;
  const html = `
    <div style="font-family:Inter,sans-serif;background:#080E1A;padding:32px;color:#E8EDF5">
      <div style="max-width:560px;margin:0 auto;background:#111B33;border:1px solid #1E3355;border-radius:12px;padding:28px">
        <div style="font-size:13px;color:#00D4FF;font-weight:600;margin-bottom:16px;font-family:'JetBrains Mono',monospace">NUEVO LEAD · CHATBOT-001</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#556688">Nombre</td><td style="padding:8px 0;font-weight:600">${escHtml(crmData.full_name)}</td></tr>
          <tr><td style="padding:8px 0;color:#556688">Email</td><td style="padding:8px 0">${escHtml(crmData.email)}</td></tr>
          <tr><td style="padding:8px 0;color:#556688">Teléfono</td><td style="padding:8px 0">${escHtml(crmData.phone || '—')}</td></tr>
          <tr><td style="padding:8px 0;color:#556688">Empresa</td><td style="padding:8px 0">${escHtml(crmData.company || '—')}</td></tr>
          <tr><td style="padding:8px 0;color:#556688">Interés</td><td style="padding:8px 0">${escHtml(crmData.notes || '—')}</td></tr>
        </table>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #1E3355;font-size:12px;color:#556688">
          <a href="https://crm.albertopozuelo.com" style="color:#00D4FF;text-decoration:none">Abrir CRM →</a>
        </div>
      </div>
    </div>`;

  const payload = JSON.stringify({
    from: 'Chatbot <onboarding@resend.dev>',
    to: [NOTIFICATION_EMAIL],
    subject,
    html,
  });
  const options = {
    hostname: 'api.resend.com',
    port: 443,
    path: '/emails',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    timeout: 10000,
  };
  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (c) => body += c);
    res.on('end', () => {
      if (res.statusCode < 300) {
        console.log('[EMAIL] Notification sent for:', crmData.email);
      } else {
        console.warn('[EMAIL] Send failed:', res.statusCode, body.slice(0, 200));
      }
    });
  });
  req.on('error', (err) => console.error('[EMAIL] Request error:', err.message));
  req.write(payload);
  req.end();
}

function sendToN8N(crmData) {
  if (!N8N_WEBHOOK_URL) {
    console.log('[N8N] No N8N_WEBHOOK_URL configured, skipping');
    return;
  }
  const url = new URL(N8N_WEBHOOK_URL);
  const payload = JSON.stringify({
    event: 'new_lead',
    timestamp: new Date().toISOString(),
    source: 'chatbot-001',
    data: {
      full_name: crmData.full_name,
      email: crmData.email,
      phone: crmData.phone || '',
      company: crmData.company || '',
      notes: crmData.notes || '',
    },
  });
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    timeout: 10000,
  };
  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (c) => body += c);
    res.on('end', () => {
      if (res.statusCode < 300) {
        console.log('[N8N] Webhook sent for:', crmData.email);
      } else {
        console.warn('[N8N] Webhook error:', res.statusCode, body.slice(0, 200));
      }
    });
  });
  req.on('error', (err) => console.error('[N8N] Request failed:', err.message));
  req.write(payload);
  req.end();
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
