# CLAUDE.md — Chatbot Project

## Project Overview

Conversational AI chatbot (`apozuelo-chatbot-001`) that qualifies leads from the landing page, captures contact data, and pushes it to the CRM. Entry point: `https://chatbot.albertopozuelo.com`. Traffic comes primarily from `landing.albertopozuelo.com`.

## Technical Stack

```
Server:      Express (Node.js) + middleware (Helmet, CORS, rate-limit, Morgan)
Frontend:    Vanilla HTML, CSS, JS (no frameworks)
Fonts:       Inter variable (300–900) + JetBrains Mono (400–600)
Bot logic:   State machine in src/chatbot-flow.js (in-memory sessions, 30 min TTL)
Integrations: CRM REST API (k8s ClusterIP) · Resend (email) · N8N (webhook)
Deployment:  Docker → k3s → Helm
Domain:      chatbot.albertopozuelo.com
```

## Project Structure

```
apozuelo-chatbot-001/
├── CLAUDE.md
├── .env / .env.example
├── package.json
├── server.js                   ← Express server, /api/chat, integrations
├── Dockerfile
├── scripts/
│   └── deploy.sh               ← Build, import to k3s, Helm deploy
├── k8s/helm/chatbot/
│   └── ...
├── src/
│   └── chatbot-flow.js         ← Conversation state machine
└── public/
    ├── index.html              ← Hero + Features + Chat UI
    ├── css/styles.css          ← Design system (shared palette with landing/CRM)
    └── js/chat.js              ← SPA chat client, session management
```

## Chatbot Flow (chatbot-flow.js)

State machine with sessions stored in `Map` (TTL 30 min, cleanup every 1 min):

```
welcome → ask_name → classify → solution_ia / scale / automation
       → capture_data (name → email → phone → description)
       → farewell → feedback → ended
```

- `classifyProblem(text)`: regex → `'ia' | 'scale' | 'automation' | 'other'`
- `capture_data` state collects: `fullName`, `email` (regex validated), `phone`, `description_detail`
- On completion emits `crmData` object → sent to CRM + email + N8N

## API

```
POST /api/chat
Body: { message, sessionId? }
Response: { response, next: 'input'|'options'|'end', options?, sessionId, crmData? }

Rate limit: 60 req/min/IP
```

## Integrations (server.js)

| Integration | Function | Env var |
|-------------|----------|---------|
| CRM | `sendToCRM(crmData)` → POST to `CRM_API_URL` | `CRM_API_URL`, `CRM_API_TOKEN` |
| Email | `sendEmailNotification(crmData)` → Resend API | `RESEND_API_KEY`, `NOTIFICATION_EMAIL` |
| N8N | `sendToN8N(crmData)` → webhook POST | `N8N_WEBHOOK_URL` |

## Page Structure

1. **Hero** — animated blobs, dot-pulse badge ("AI Assistant · Online ahora"), gradient title, CTA scrolls to chat
2. **Features** — 3 cards with colored top border on hover (cyan / green / amber by category)
3. **Chat section** — chat container with header, messages area, options/input area
4. **Footer** — copyright + link to albertopozuelo.com

## Design System

Shared palette with `apozuelo-landingpage-001` and `apozuelo-crm`:

### Color Tokens
```css
--bg:             #080E1A   /* deep navy */
--bg-card:        #111B33   /* card surfaces */
--bg-elevated:    #1A2A4A   /* chat header, input wrap */
--border:         #1E3355
--text:           #F0F4FF
--text-secondary: #8899BB
--text-muted:     #556688
--accent:         #00D4FF   /* cyan */
--accent-glow:    rgba(0, 212, 255, 0.35)
--violet:         #8B5CF6
--green:          #10B981
--amber:          #F59E0B
--grad-brand:     linear-gradient(135deg, #00D4FF, #8B5CF6)
```

### Chat UI Components

**Message bubbles:**
```css
.bot .msg-bubble  → bg-elevated + border; border-bottom-left-radius: 4px
.user .msg-bubble → accent-bg + accent-border; border-bottom-right-radius: 4px
```
Entrance animation: `msg-in` — `translateY(10px) scale(0.97)` → normal, spring easing.

**Chat header:** gradient top accent line via `::after` pseudo-element.

**Feature cards:** `::after` gradient top border per card index:
- Card 1 → `--grad-brand` (cyan→violet)
- Card 2 → green gradient
- Card 3 → amber gradient

**Dot-pulse badge:** `@keyframes dot-pulse` on `.badge-dot` span.

**Status dot:** `@keyframes status-pulse` (opacity pulse) on `.status-dot`.

### Conventions
- `[data-count]` not used here (counters are landing-page only)
- No scroll reveal — page is short, content loads immediately
- Chat session persists in `sessionStorage` implicitly via `sessionId` returned by API

## Deploy

```bash
bash scripts/deploy.sh
```

Script: `docker build` → `k3s ctr images import` → secrets upsert → `helm upgrade --install` → `kubectl rollout restart` → health check `/api/health`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `CRM_API_URL` | `http://crm-api.crm.svc.cluster.local:80` | CRM internal URL |
| `CRM_API_TOKEN` | — | Bearer token for CRM |
| `RESEND_API_KEY` | — | Resend email API key |
| `NOTIFICATION_EMAIL` | `pozuelomail@gmail.com` | Lead notification recipient |
| `N8N_WEBHOOK_URL` | — | N8N lead webhook |

## Related Projects

- **Landing:** `apozuelo-landingpage-001` — `landing.albertopozuelo.com` — sends traffic here
- **CRM:** `apozuelo-crm` — `crm.albertopozuelo.com` — receives lead data from this chatbot
- **Portfolio:** `apozuelo-portfolio-001` — `albertopozuelo.com`
