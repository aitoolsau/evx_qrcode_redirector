# Technical Brief: Recreating the EVX QR Redirector App

## 1. Overview

This document describes the architecture, data model, and logic needed to recreate the EVX QR Redirector as a modern, secure, serverless web application. It is intended for AI agents or developers tasked with building a functionally equivalent system.

---

## 2. Platform & Stack

- **Edge compute:** Cloudflare Workers (or equivalent serverless JS runtime)
- **Key-value storage:** Cloudflare KV (or any globally distributed KV store)
- **Frontend:** Single-page admin UI (HTML/JS/CSS, no framework required)
- **Authentication:** Stateless HMAC-signed session cookies
- **Backup/Import:** CSV file format

---

## 3. Data Model

- **Mapping:**  
  - Key: Charger ID (string, uppercase, e.g., "20501B")
  - Value: Target URL (string, e.g., "https://cp.evx.tech/public/cs/qr?evseid=AU*EVX*20501B")
- **Admin Config:**  
  - Password hash (PBKDF2-SHA256, salted, stored in KV)
  - Session version (integer, for forced logout on password change)

---

## 4. Core Logic

### Redirection
- On GET `/public/cs/{CHARGERID}`:
  - Normalize `{CHARGERID}` to uppercase.
  - If mapping exists, 302-redirect to stored URL.
  - If not, show a message: "Charge ID not found in mapping file. Forward to origin URL", then after 3 seconds, redirect to `https://cp.evx.tech/public/cs/{CHARGERID}`.

### Admin UI
- Served at `/admin`.
- Requires login (username/password).
- Features:
  - List, filter, add, edit, delete mappings.
  - Import/Export mappings as CSV.
  - Change admin password (PBKDF2, salted, stored in KV).
  - Confirmation modal and auto-backup before destructive import.

### Authentication
- Login form posts to `/login` or `/api/login`.
- On success, set a stateless HMAC-signed cookie (`admin_session`), 1-hour expiry.
- All admin/API routes require valid session.
- Logout clears the cookie.

### Import/Export
- Export: `/api/mappings?format=csv` returns all mappings as CSV.
- Import: `/api/mappings?import=csv` accepts CSV, wipes all mappings, and replaces them. Confirmation modal and backup required.

---

## 5. Security

- All admin/API routes require authentication.
- Passwords are never stored in plaintext; only PBKDF2 hashes with salt.
- Sessions are stateless, signed with a secret, and time-limited.
- All destructive actions (import) require confirmation and backup.

---

## 6. Deployment

- Deploy Worker to edge (Cloudflare or equivalent).
- Bind KV namespace for mappings and config.
- Set secrets: `ADMIN_PASSWORD`, `SESSION_SECRET`.
- Route `/public/cs/*`, `/admin*`, `/api/*`, `/login`, `/logout` to the Worker.

---

## 7. Testing

- Test redirection for mapped and unmapped charger IDs.
- Test admin login, CRUD, import/export, password change.
- Test not-found redirect and backup/restore.

---

## 8. Extensibility

- Add multi-user/RBAC by extending config and session payload.
- Add audit logging for admin actions.
- Integrate with SSO via Cloudflare Access or similar.

---

This brief provides all the logic and requirements needed to recreate the EVX QR Redirector app in any modern edge/serverless environment.
