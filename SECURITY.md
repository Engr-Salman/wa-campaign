# Security Policy

## Supported Versions

WA Campaign is currently in early release. Security updates are applied to the latest version only.

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | ✅ Yes (current)   |

Once new versions are released, this table will be updated accordingly. We strongly recommend always running the latest version.

---

## Scope

This policy covers security vulnerabilities in the WA Campaign codebase, including:

- **Backend** — Node.js/Express API server (`backend/`)
- **Frontend** — React/Vite web app (`frontend/`)
- **WhatsApp client layer** — `whatsapp-web.js` integration (`backend/whatsapp/`)
- **Database layer** — SQLite via `better-sqlite3` (`backend/db/`)
- **File upload handling** — CSV/Excel contact import (`backend/routes/contacts.js`)
- **WebSocket server** — Socket.io real-time layer

Out of scope:

- Vulnerabilities in upstream dependencies (report these to the relevant package maintainers)
- WhatsApp's own platform security
- Issues arising from deliberate misconfiguration or running the app on a publicly exposed server without your own access controls

---

## Known Security Considerations

Before deploying, please be aware of the following by design:

### No Authentication Layer
The app is designed to run **locally** (on `localhost`). It has **no login system** — anyone who can reach the server can control campaigns and access contact data. **Do not expose this app to the public internet** without adding your own authentication layer (e.g. a reverse proxy with HTTP Basic Auth, VPN, or firewall rules).

### WhatsApp Session Storage
The WhatsApp session is saved to a local `.wwebjs_auth/` directory. This folder contains your linked device credentials. **Keep this directory private** and ensure it is not committed to version control (it is included in `.gitignore`).

### Uploaded Contact Files
Contact files (CSV/Excel) are uploaded to a local `uploads/` directory on the server and served as static files. Ensure this directory is not publicly accessible if you deploy the app on a server.

### SQLite Database
All campaign data, contact lists, and message logs are stored in a local `data.db` SQLite file. This file contains phone numbers and message content. **Keep it secure and do not expose it.**

### Puppeteer / Chromium
The app uses Puppeteer (headless Chrome) to drive `whatsapp-web.js`. It is launched with `--no-sandbox` by default, which is required in many containerized environments but reduces the Chromium sandbox. Only run the app on a machine you trust and control.

### CORS
CORS is restricted to the `FRONTEND_URL` environment variable (default: `http://localhost:5173`). Do not set this to a wildcard (`*`) in any deployment.

---

## Reporting a Vulnerability

If you discover a security vulnerability in WA Campaign, please **do not open a public GitHub Issue**. Instead, report it privately so it can be assessed and fixed before public disclosure.

### How to Report

**Open a GitHub Security Advisory** (preferred):
1. Go to the repository on GitHub
2. Click the **Security** tab
3. Click **"Report a vulnerability"**
4. Fill in the details of the issue

Alternatively, you can contact the maintainer directly via GitHub: [@Engr-Salman](https://github.com/Engr-Salman)

### What to Include

A good vulnerability report includes:

- A clear description of the vulnerability
- The component or file(s) affected (e.g. `backend/routes/contacts.js`)
- Steps to reproduce the issue
- Potential impact (what an attacker could do)
- Any suggested fix, if you have one

### What to Expect

| Timeline | Action |
|---|---|
| Within **72 hours** | Acknowledgement of your report |
| Within **7 days** | Initial assessment and severity determination |
| Within **30 days** | A fix or mitigation, depending on complexity |
| After fix is released | Public disclosure (coordinated with you if desired) |

We are committed to keeping reporters informed throughout the process. If a vulnerability is accepted, you will be credited in the release notes (unless you prefer to remain anonymous). If it is declined, we will explain why.

---

## Security Best Practices for Users

If you are running this app in any environment beyond your own local machine:

- ✅ Put it behind a reverse proxy (e.g. Nginx) with authentication
- ✅ Restrict network access to trusted IPs only
- ✅ Keep Node.js, npm dependencies, and Chromium up to date
- ✅ Run `npm audit` regularly and address high/critical findings
- ✅ Back up and restrict access to `data.db` and `.wwebjs_auth/`
- ✅ Never commit `.env`, `data.db`, or `.wwebjs_auth/` to version control
- ❌ Do not set `FRONTEND_URL=*` in your `.env`
- ❌ Do not run as root

---

## Dependency Vulnerabilities

This project depends on several third-party packages. To check for known vulnerabilities in dependencies:

```bash
npm audit
cd backend && npm audit
cd frontend && npm audit
```

Dependency security issues should be reported to the respective package maintainers. However, if you find a vulnerability in how **WA Campaign uses** a dependency (e.g. unsafe input handling, insecure configuration), please report it to us using the process above.
