# Security Policy

## Supported Versions

Security fixes are applied to the latest version of the root WA Campaign app only.

| Version | Supported |
|---|---|
| `1.0.x` | Yes |

## Scope

This policy covers the root WhatsApp campaign application in this repository, including:

- `backend/`
- `frontend/`
- `data.db`
- `.wwebjs_auth/`
- `uploads/`

The `email-platform/` directory is a separate project and is out of scope for this document unless explicitly stated in a future update.

## Security Model

The current app includes:

- account registration and login
- email verification
- password reset by email
- JWT-protected API routes
- admin-only routes for user and credit management
- user-scoped Socket.IO connections
- per-user WhatsApp linked-device sessions

This is materially safer than the earlier single-user local-only version, but it is still not a hardened multi-tenant SaaS deployment.

## Sensitive Assets

Protect these files and directories carefully:

- `.env`: contains JWT and email credentials
- `data.db`: stores users, credits, campaigns, phone numbers, and logs
- `.wwebjs_auth/`: stores WhatsApp linked-device session credentials
- `uploads/`: may contain media files and payment receipts

Do not commit any of them to version control.

## Known Security Considerations

### Default Admin Account

If the database has no admin user yet, the app creates a default admin account on first startup.

This is intended only for first-run bootstrapping. You should:

- log in immediately
- rotate the password
- avoid using the default credential in any exposed environment

### Gmail App Password Storage

Verification and reset emails are sent through Gmail using `EMAIL_USER` and `EMAIL_APP_PASSWORD` from the root `.env`.

Treat the Gmail App Password like a production secret:

- never share it in chat or tickets
- never commit it
- rotate it if it is exposed

### WhatsApp Session Storage

Each user gets a separate persistent WhatsApp session under `.wwebjs_auth/` using a per-user `LocalAuth` client id.

This prevents customers from sharing a single live WhatsApp client, but the session data is still local secret material. Anyone with file-system access to that directory may be able to impersonate linked sessions.

### File Uploads

The app accepts:

- contact imports
- campaign media uploads
- credit receipt uploads

Uploaded files are stored on disk. If you deploy this app outside a trusted local environment, ensure those files are not publicly exposed beyond intended routes and access controls.

### In-Process Campaign Execution

Campaign sending runs inside the backend process. Running campaigns are recovered to `paused` after restart, but this is not a durable distributed queue system. Treat restarts carefully and verify campaign status after crashes or deployments.

### Chromium Flags

`whatsapp-web.js` uses Puppeteer/Chromium and is launched with `--no-sandbox` in this app. This is common in local/container setups but reduces browser isolation. Run the app only on systems you trust.

### CORS and Frontend Origin

CORS is restricted by `FRONTEND_URL`. Do not set it to `*`.

## Deployment Guidance

If you run this beyond a local dev machine:

- put it behind HTTPS
- restrict access to trusted users only
- store secrets outside source control
- lock down filesystem access to the app directory
- back up `data.db`
- monitor access to admin routes
- rotate the default admin password and Gmail app password

## Reporting a Vulnerability

Do not report vulnerabilities in a public issue.

Report privately through one of these channels:

1. GitHub Security Advisory for the repository
2. Direct contact with the maintainer on GitHub: [@Engr-Salman](https://github.com/Engr-Salman)

Please include:

- affected area or file
- steps to reproduce
- expected impact
- logs, screenshots, or proof of concept if available

## Response Expectations

| Timeline | Target |
|---|---|
| Acknowledgement | within 72 hours |
| Initial triage | within 7 days |
| Fix or mitigation | depends on severity and complexity |

## Dependency Security

Check dependencies regularly:

```bash
npm audit
cd backend && npm audit
cd frontend && npm audit
```

If the issue is in an upstream package, report it upstream as well. If the issue is caused by how this app uses a dependency, report it through the private process above.
