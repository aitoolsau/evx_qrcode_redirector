# EVX CPR QR Redirect

## Purpose
Rewrite legacy paths:
`https://cpr.evx.tech/public/cs/{CHARGERID}`
to:
`https://cpr.evx.tech/public/cs/qr?evseid={COUNTRY}*EVX*{CHARGERID}`

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
