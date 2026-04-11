# WA Campaign

A full-stack WhatsApp campaign platform with user accounts, email verification, credit-based sending, admin review flows, and per-user WhatsApp session isolation.

## Features

- User registration, login, email verification, and password reset
- Per-user WhatsApp linking with isolated persistent sessions
- CSV/Excel contact import with validation, deduplication, and preview
- Personalized message composer with `{{name}}`, `{{custom_field_1}}`, and `{{custom_field_2}}`
- Media attachments for supported image, video, and PDF sends
- Credit-based campaign sending with admin-managed top-ups
- Real-time campaign progress, logs, and rate-limit events over Socket.IO
- Smart sending controls with randomized delays, cooldowns, retries, and caps
- Admin dashboard for users, campaigns, and credit request review

## Architecture

The active app in this repository is the root workspace:

- `backend/`: Express API, Socket.IO server, SQLite database, WhatsApp session manager
- `frontend/`: React + Vite web client
- `data.db`: SQLite application database
- `uploads/`: uploaded media and receipt files
- `.wwebjs_auth/`: WhatsApp linked-device session storage

## Prerequisites

- Node.js 22.x
- npm 9+
- Google Chrome or Chromium for `whatsapp-web.js`
- A Gmail account with 2-Step Verification enabled and an App Password for outbound email

## Installation

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

Or use:

```bash
npm run install:all
```

## Environment Setup

Create a root `.env` file based on `.env.example`.

Required variables:

| Variable | Example | Purpose |
|---|---|---|
| `PORT` | `3001` | Backend server port |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend origin for CORS |
| `JWT_SECRET` | `change-this-to-a-random-secret-key` | JWT signing secret |
| `EMAIL_FROM` | `salman.ahm97@gmail.com` | Sender address shown in outgoing emails |
| `EMAIL_USER` | `salman.ahm97@gmail.com` | Gmail account used for SMTP |
| `EMAIL_APP_PASSWORD` | `xxxx xxxx xxxx xxxx` | Gmail App Password for verification/reset emails |

Notes:

- `EMAIL_APP_PASSWORD` must be a Gmail App Password, not your regular Gmail password.
- Restart the backend after updating `.env`.

## Running the App

```bash
npm run dev
```

This starts:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

Open `http://localhost:5173` in your browser.

## Hostinger Deployment

This repository is now prepared for single-app Node deployment:

- the frontend is built with Vite
- the backend serves the built frontend from `frontend/dist`
- the app starts with a single process using Node's built-in SQLite module

Recommended Hostinger settings:

- Framework preset: `Other`
- Node version: `22.x`
- Root directory: the uploaded project root
- Build command: `npm run build`
- Start command: `npm start`

Environment variables to set in Hostinger:

- `PORT`
- `FRONTEND_URL`
- `JWT_SECRET`
- `EMAIL_FROM`
- `EMAIL_USER`
- `EMAIL_APP_PASSWORD`
- `PUPPETEER_CACHE_DIR`
- `PUPPETEER_EXECUTABLE_PATH` if Hostinger requires an explicit Chromium path

Important notes:

- `npm install` at the root will trigger `postinstall`, which installs both backend and frontend dependencies
- backend postinstall attempts to install a Puppeteer-managed Chrome binary into `backend/.cache/puppeteer`
- if you deploy from a ZIP, make sure the ZIP root contains `package.json`, `backend/`, and `frontend/`
- the app now uses Node's built-in `node:sqlite` module, so Node `22.x` is required
- if WhatsApp fails to initialize in production, the most likely issue is Chromium availability for Puppeteer
- runtime data like `data.db`, `uploads/`, and `.wwebjs_auth/` must remain writable on the host
- if you set `PUPPETEER_CACHE_DIR`, use an absolute path only; relative paths can break between build and runtime

## Auth Flow

### Register

1. Create an account from the registration page.
2. The app sends a 6-digit verification code to the email address you entered.
3. Enter that code on the verify screen.

If an email is already registered but not verified, registering again resends the verification code and redirects to verification.

### Login

Only verified users can sign in.

### Forgot Password

1. Click `Forgot password?` on the login page.
2. Request a reset code by email.
3. Enter the reset code and your new password.

## WhatsApp Session Isolation

Each user links their own WhatsApp account.

- WhatsApp sessions are stored separately using a per-user `LocalAuth` client id
- One user's QR code, connection status, and linked device cannot be used by another user
- Socket events are scoped to the authenticated user room
- Logging out of WhatsApp only affects that user's linked session

Session files are stored under `.wwebjs_auth/`. Keep this directory private.

## Campaign Workflow

1. Sign in and verify your email if needed.
2. Add credits or have an admin approve your credit request.
3. Link your own WhatsApp account from the campaign screen.
4. Upload contacts from CSV or Excel.
5. Compose a message and optionally upload media.
6. Create and launch a campaign.
7. Monitor progress, retries, failures, and logs in real time.

## Contact File Format

Supported columns:

| Column | Required | Description |
|---|---|---|
| `phone_number` | Yes | International format without `+` |
| `name` | No | Contact name |
| `custom_field_1` | No | Custom personalization field |
| `custom_field_2` | No | Custom personalization field |

Accepted upload types:

- `.csv`
- `.xlsx`
- `.xls`

## Credits and Admin

Users send messages using credits.

- 1 credit = 1 sent message
- Users can submit credit requests with a receipt upload
- Admins review and approve or reject those requests
- Admins can also manually add credits to a user

The default admin account is created only when no admin exists in the database.

## Rate Limiting and Safety

The app includes:

- Randomized delay between messages
- Minute, hour, and day caps
- Cooldown after a configurable batch size
- Retry logic with exponential backoff
- Invalid number detection
- Duplicate contact skipping per campaign

Default settings can be changed from the Settings page. Keep them conservative to reduce account risk.

## Project Structure

```text
wa-campaign/
|-- backend/
|   |-- db/
|   |-- middleware/
|   |-- routes/
|   |-- utils/
|   |-- whatsapp/
|   `-- index.js
|-- frontend/
|   |-- public/
|   `-- src/
|-- uploads/
|-- data.db
|-- package.json
|-- README.md
`-- SECURITY.md
```

## Tech Stack

- Backend: Node.js, Express, Socket.IO, `node:sqlite`
- Frontend: React 18, Vite, Tailwind CSS
- Auth: JWT + bcrypt
- Email: Nodemailer via Gmail SMTP
- WhatsApp: `whatsapp-web.js`
- File parsing: PapaParse and `xlsx`

## Development Notes

- The backend uses Node's built-in `node:sqlite` module
- Campaign execution is in-process
- Interrupted running campaigns are recovered to `paused` state on restart
- Uploaded runtime files such as `data.db-wal` and `data.db-shm` may appear during local execution

## Disclaimer

This project is provided for authorized business communication and internal tooling use only.

WhatsApp does not officially support bulk messaging through unofficial automation libraries. Use of this project may violate WhatsApp policies and may result in restrictions or bans.

You are responsible for:

- obtaining recipient consent
- complying with anti-spam and privacy laws
- protecting uploaded contacts, receipts, and WhatsApp session data

Use at your own risk.
