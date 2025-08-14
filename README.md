
# EVX QR Redirector

Cloudflare Worker that ensures `https://cpr.evx.tech/public/cs/{CHARGERID}` resolves to the correct EVX app URL and provides an authenticated admin console to manage chargerID→URL overrides.

## Features
- Smart redirect to `https://cp.evx.tech/public/cs/qr?evseid={COUNTRY}*EVX*{CHARGERID}` with loop protection.
- KV-backed overrides: if a chargerID exists in KV, redirect to that URL instead of the computed one.
- Admin console at `/admin` with login, filter, and CRUD (add/update/delete) mappings.
- Stateless HMAC-signed session cookie for authentication.

## Routes (wrangler.toml)
- `cpr.evx.tech/public/cs/*` – redirector
- `cpr.evx.tech/admin*` – admin UI
- `cpr.evx.tech/login` – server-side login endpoint
- `cpr.evx.tech/api/*` – JSON APIs (auth required for mappings)

## Configuration
- Vars
	- `COUNTRY_CODE` (default `AU`)
	- `ADMIN_USERNAME` (default `admin`)
- Secrets
	- `ADMIN_PASSWORD` – admin login password
	- `SESSION_SECRET` – HMAC signing secret for session cookie

Set secrets (PowerShell):
```powershell
wrangler secret put ADMIN_PASSWORD
wrangler secret put SESSION_SECRET
```

## Admin Console
- Visit `https://cpr.evx.tech/admin`
- Log in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- Filter list: type a prefix and press Enter or click Refresh
- Add/update: use the form, button switches between Add/Update when editing
- Delete: click Delete beside a row

## Redirect Logic
1. Only host `cpr.evx.tech` is served; others 404.
2. Bypass if the path is `/public/cs/qr` or query contains `evseid`/`revseid`.
3. Match `/public/cs/{CHARGERID}` (alphanumeric, not `qr`).
4. If a mapping exists in KV for `{CHARGERID}`, redirect to that URL; otherwise build `evseid={COUNTRY}*EVX*{CHARGERID}` and 302.

## Development
Local dev (optional):
```powershell
wrangler dev
```

Deploy:
```powershell
wrangler deploy
```

## Troubleshooting
- Login loops: ensure `ADMIN_PASSWORD` and `SESSION_SECRET` are set; hard refresh; check `/api/me?debug=1`.
- No cookie: confirm `/login` returns `Set-Cookie` and Worker route `cpr.evx.tech/login` is present.

## Changelog
- v0.1.0: Admin CRUD UI, filter Enter-refresh, server-side login (/login), stateless HMAC cookie, branding tweaks.
