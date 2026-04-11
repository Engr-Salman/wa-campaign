# WhatsApp Bulk Messaging Tool

A full-stack web application for sending bulk WhatsApp messages with anti-ban safety measures, campaign management, and real-time progress tracking.

## Features

- **QR Code Login** — Scan to link WhatsApp, with persistent session (no re-scan on restart)
- **CSV/Excel Import** — Upload contacts via drag-and-drop, with validation and preview
- **Message Composer** — Personalization variables (`{{name}}`, `{{custom_field_1}}`, `{{custom_field_2}}`), media attachments, live preview
- **Smart Rate Limiting** — Randomized delays, per-minute/hour/day caps, cooldown pauses to avoid bans
- **Campaign Management** — Start, pause, resume, stop, retry failed messages
- **Real-Time Dashboard** — Live progress bars, activity logs, stats via WebSocket
- **Results & Export** — Per-contact status tracking, CSV export, campaign history
- **Dark Mode** — Full light/dark theme support

## Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- **Google Chrome** or **Chromium** (required by Puppeteer for whatsapp-web.js)

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd whatsapp-bulk-tool

# Install all dependencies
npm run install:all
```

Or install manually:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

## Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend server port |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for CORS |

## Running the Application

```bash
# Start both backend and frontend
npm run dev
```

This starts:
- **Backend** on `http://localhost:3001`
- **Frontend** on `http://localhost:5173`

Open `http://localhost:5173` in your browser.

## How to Use

### 1. Connect WhatsApp

1. Open the app and navigate to "New Campaign"
2. A QR code will appear on screen
3. Open WhatsApp on your phone > Settings > Linked Devices > Link a Device
4. Scan the QR code with your phone camera
5. Once connected, you'll see a green "Connected" status in the header

The session is saved locally — you won't need to scan again unless you log out.

### 2. Prepare Your Contact List

Create a CSV or Excel file with these columns:

| Column | Required | Description |
|---|---|---|
| `phone_number` | Yes | International format, no + sign (e.g., `923001234567`) |
| `name` | No | Contact name for personalization |
| `custom_field_1` | No | Custom field for personalization |
| `custom_field_2` | No | Custom field for personalization |

You can also download a sample CSV from the upload page.

### 3. Create & Send Campaign

1. Upload your contact file (drag-and-drop or click to browse)
2. Review the parsed contacts — remove any unwanted rows
3. Compose your message using personalization variables
4. Optionally attach a media file (image, PDF, video)
5. Give your campaign a name and launch it

### 4. Monitor Progress

- Watch real-time progress on the campaign detail page
- View live activity logs showing each send attempt
- Rate limit pauses are shown with countdown timers

## Configurable Settings

All settings are adjustable from the Settings page:

| Setting | Default | Safe Range |
|---|---|---|
| Messages per minute | 5 | 3-8 |
| Messages per hour | 60 | 30-100 |
| Messages per day | 200 | 100-300 |
| Delay between messages | 10-20 sec | 8-30 sec |
| Cooldown after N messages | 20 | 15-30 |
| Cooldown duration | 2-5 min | 2-10 min |
| Max retries per number | 2 | 1-3 |

## Anti-Ban Safety Measures

This tool implements multiple protections:

1. **Randomized delays** — Never sends at fixed intervals
2. **Batch cooldowns** — Pauses every N messages for a random duration
3. **Rate caps** — Enforces per-minute, per-hour, and per-day limits
4. **Phone validation** — Skips invalid/malformed numbers
5. **Deduplication** — Never sends to the same number twice per campaign
6. **Exponential backoff** — Failed messages are retried with increasing delays
7. **User warnings** — Alerts when configured limits exceed safe values

## Project Structure

```
whatsapp-bulk-tool/
├── backend/
│   ├── index.js              # Express + Socket.io server
│   ├── whatsapp/
│   │   ├── client.js         # whatsapp-web.js setup + QR + session
│   │   └── sender.js         # Message sending + queue logic
│   ├── queue/
│   │   └── messageQueue.js   # In-memory queue manager
│   ├── db/
│   │   └── database.js       # SQLite setup + all queries
│   ├── routes/
│   │   ├── campaign.js       # Campaign CRUD + controls
│   │   ├── contacts.js       # File upload + parsing
│   │   └── settings.js       # Settings get/set + stats
│   └── utils/
│       ├── phoneValidator.js # Phone number validation
│       ├── csvParser.js      # CSV/Excel parsing
│       └── rateLimiter.js    # Token-bucket rate limiter
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main app with routing
│   │   ├── pages/            # Dashboard, NewCampaign, CampaignDetail, History, Settings
│   │   ├── components/       # QRCodeLogin, ConnectionStatus, ContactTable, etc.
│   │   └── hooks/            # useSocket, useCampaign
│   └── public/
│       └── sample_contacts.csv
├── package.json
└── .env.example
```

## Tech Stack

- **Backend:** Node.js, Express, Socket.io, better-sqlite3
- **WhatsApp:** whatsapp-web.js (Puppeteer-based)
- **Frontend:** React 18, Vite, Tailwind CSS
- **File Parsing:** PapaParse (CSV), xlsx (Excel)
- **UI:** Tailwind CSS, Lucide icons, react-hot-toast

## Deployment

### Frontend on Netlify

Only the React frontend can be hosted on Netlify. The backend needs a
long-running process (Puppeteer/Chromium for WhatsApp Web, SQLite on disk,
persistent uploads) and **will not run on Netlify Functions**.

1. In Netlify, import this repository. The included `netlify.toml` already
   configures:
   - `base = "frontend"`
   - `command = "npm install && npm run build"`
   - `publish = "dist"`
   - SPA fallback redirect to `/index.html`
2. Deploy your backend separately (Railway, Render, Fly.io, or a VPS).
3. In **Netlify → Site settings → Environment variables**, add:

   ```
   VITE_API_URL = https://<your-backend-host>
   ```

   Trigger a redeploy. Vite will bake this URL into the build, so every
   `/api/*` call and the Socket.io connection target it.
4. On the backend, set `FRONTEND_URL` to your Netlify origin (you can pass
   multiple comma-separated origins):

   ```
   FRONTEND_URL=http://localhost:5173,https://<your-site>.netlify.app
   ```

### Backend

The backend is a stateful Node service — deploy it to any host that allows
long-running processes with a writable filesystem (Railway, Render, Fly.io,
DigitalOcean, a VPS, etc.). Make sure Chromium is available (most Node
buildpacks install it automatically with `whatsapp-web.js`; otherwise set up
a Dockerfile with `google-chrome-stable`).

## Disclaimer

> **This tool is provided for educational and authorized business communication purposes only.**
>
> Using this tool may violate WhatsApp's Terms of Service. WhatsApp does not officially support bulk messaging through unofficial APIs. Your account may be temporarily or permanently banned.
>
> **Use at your own risk.** The developers are not responsible for any account restrictions, bans, or other consequences resulting from the use of this tool.
>
> Always ensure you have proper consent from recipients before sending messages. Comply with all applicable laws and regulations regarding electronic communications, including anti-spam laws.
