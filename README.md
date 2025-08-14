
# EVX CPR QR Redirect

## Purpose
Rewrite legacy paths:
`https://cpr.evx.tech/public/cs/{CHARGERID}`
to:
`https://cp.evx.tech/public/cs/qr?evseid={COUNTRY}*EVX*{CHARGERID}`

## Step-by-step Logic (Cloudflare Worker)
1. **Host Check:**
	- Only requests to `cpr.evx.tech` are processed. All other worker routed hosts return 404.

2. **Bypass for QR and evseid:**
	- If the path is `/public/cs/qr` or the query string contains `evseid`, the Worker returns HTTP 200 OK and does not redirect. This prevents redirect loops and ensures the QR endpoint is not processed again.

3. **Path Matching:**
	- The Worker matches paths of the form `/public/cs/{CHARGERID}` (where `{CHARGERID}` is alphanumeric, case-insensitive, and not `qr`).
	- If the path does not match or `{CHARGERID}` is `qr`, it returns 404.

4. **Redirection:**
	- For valid charger IDs, the Worker constructs a new URL:
	  - Base: `https://cp.evx.tech/public/cs/qr`
	  - Query: `evseid={COUNTRY}*EVX*{CHARGERID}`
	  - `{COUNTRY}` is from the environment variable `COUNTRY_CODE` (default `AU`).
	- Responds with a 302 redirect to this URL.

## Deploy
1. `npm ci`
2. `npm run deploy`

## Test local
```bash
npm run dev
curl -I "http://127.0.0.1:8787/public/cs/20105B"
```

## CI
Push to `main`. GitHub Actions runs tests and deploys via Wrangler.

## Config
- `COUNTRY_CODE` var. Default `AU`.
- Route: `cpr.evx.tech/public/cs/*` in `wrangler.toml`.
