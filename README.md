
# EVX QR Code Redirector

A secure, serverless QR code redirector and admin UI for managing charger ID → URL mappings. Built on Cloudflare Workers and KV, with a modern, password-protected admin interface, import/export, and robust security.

---

## Table of Contents
- [EVX QR Code Redirector](#evx-qr-code-redirector)
	- [Table of Contents](#table-of-contents)
	- [Features](#features)
	- [Architecture](#architecture)
	- [How It Works](#how-it-works)
		- [Redirection](#redirection)
		- [Admin UI](#admin-ui)
	- [Admin UI](#admin-ui-1)
	- [Authentication](#authentication)
	- [Import/Export \& Backup](#importexport--backup)
	- [Security Model](#security-model)
	- [Deployment](#deployment)
	- [Development](#development)
	- [File Structure](#file-structure)
	- [Troubleshooting](#troubleshooting)
	- [License](#license)

---

## Features
- **Edge-fast QR code redirection** via Cloudflare Workers
- **Admin UI** for managing charger mappings (CRUD)
- **Password-protected** with PBKDF2 hashing
- **Stateless, signed session cookies**
- **CSV import/export** with auto-backup and duplicate prevention
- **Not-found fallback** with user message and auto-forward
- **Single-file deployment** (no external DB)

---

## Architecture
- **Cloudflare Worker**: Handles all HTTP requests, routing, and logic
- **Cloudflare KV**: Stores chargerID→URL mappings and admin config
- **Admin UI**: Served from the Worker, pure HTML/JS/CSS
- **Session Auth**: Stateless, HMAC-signed cookies

```
[User/QR] → [Cloudflare Worker] → [KV Storage]
								↓
					 [Admin UI / API]
```

---

## How It Works

### Redirection
- User scans QR code: `/public/cs/{CHARGERID}`
- Worker normalizes `{CHARGERID}` (uppercase)
- If mapping exists: 302 redirect to target URL
- If not: Show message, then auto-forward to origin after 3 seconds

### Admin UI
- Access `/admin` (login required)
- Manage mappings: add, edit, delete, filter
- Import/export mappings as CSV
- Change password (PBKDF2, salted)
- All changes are instant (KV-backed)

---

## Admin UI
- **Login**: Username/password (single admin)
- **Mappings Table**: Filter, add, edit, delete
- **Import/Export**: CSV, with backup before destructive import
- **Password Change**: Secure, with session invalidation
- **Session Timeout**: 1 hour inactivity

---

## Authentication
- **Login**: POST to `/login` (PBKDF2 check)
- **Session**: HMAC-signed cookie (`admin_session`), 1-hour expiry
- **Logout**: Clears cookie
- **Session version**: Incremented on password change (forces logout)

---

## Import/Export & Backup
- **Export**: Download all mappings as CSV
- **Import**: Upload CSV, wipes and replaces all mappings
- **Auto-backup**: Before import, backup is downloaded
- **Duplicate prevention**: Import skips/alerts on duplicate charger IDs

---

## Security Model
- **No plaintext passwords**: Only PBKDF2 hashes (with salt) in KV
- **Stateless sessions**: Signed, time-limited, no server-side session store
- **All admin/API routes require valid session**
- **Destructive actions**: Require confirmation and backup

---

## Deployment
1. **Install Wrangler:**
	```sh
	npm install -g wrangler
	```
2. **Configure KV namespaces:**
	- `MAPPINGS_KV` (for charger mappings)
	- `CONFIG_KV` (for admin config)
3. **Set secrets:**
	- `ADMIN_PASSWORD` (PBKDF2 hash, or set via first login)
	- `SESSION_SECRET` (random string for HMAC)
4. **Publish:**
	```sh
	wrangler publish
	```
5. **Route:**
	- `/public/cs/*`, `/admin*`, `/api/*`, `/login`, `/logout` → Worker

---

## Development
- **Install dependencies:**
  ```sh
  npm install
  ```
- **Dev server:**
  ```sh
  wrangler dev
  ```
- **Test:**
  - Redirection, admin login, CRUD, import/export, password change

---

## File Structure
```
/ (root)
├── src/
│   ├── worker.ts         # Main Worker entry
│   ├── routes/           # Route handlers (admin, api, public)
│   ├── services/         # Auth, session, mapping logic
│   ├── lib/              # Utility functions
│   └── env.ts            # Environment bindings
├── public/               # Static assets (if any)
├── docs/
│   ├── technical_brief_to_recreate_the_app_in_ai.md
│   └── ...
├── README.md
└── ...
```

---

## Troubleshooting
- **Login fails:** Check `ADMIN_PASSWORD` and `SESSION_SECRET` secrets
- **Mappings not saving:** Ensure KV namespaces are bound
- **Import errors:** Validate CSV format, check for duplicates
- **Session issues:** Confirm system clock, session version

---

## License
MIT (or as specified by project owner)
