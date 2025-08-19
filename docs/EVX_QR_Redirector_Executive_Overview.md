# EVX QR Redirector: Executive & Technical Overview

## What is it?
The EVX QR Redirector is a globally distributed Cloudflare Worker that ensures QR code and short-link URLs for EVX charging stations always resolve to the correct destination, regardless of how users access them. It provides a seamless, reliable experience for drivers and enables flexible, future-proof management for the business.

It also includes a secure, lightweight admin console to manage chargerID→URL overrides in real time via Cloudflare KV, so business users can add, update, or remove mappings without code changes.
## Key Features (2025)
- **Smart Redirection:**  
  Scans or short URLs like `https://cpr.evx.tech/public/cs/20501B` are intercepted and redirected to the correct destination, e.g., `https://cp.evx.tech/public/cs/qr?evseid=AU*EVX*20501B`.
- **Duplicate Prevention:**  
  Charger IDs are normalized (uppercase) to prevent accidental duplicates.
- **Not-Found Handling:**  
  If a mapping is missing, users see a clear message and are auto-forwarded to the origin URL after 3 seconds.
- **Admin Console:**  
  Authenticated admins can add, edit, delete, import, and export mappings.  
  - **Import/Export:** CSV backup/restore with confirmation modal and automatic timestamped backup before import.
  - **Password Change:** Secure password change with PBKDF2 hashing and immediate effect.
- **Security:**  
  - Stateless HMAC-signed session cookies.
  - All admin actions require authentication.
  - All changes are live instantly worldwide.

## Why is this valuable?
- **Business Reliability:**  
  QR codes and short links printed on hardware or signage will always work, even if the backend or app URLs change in the future.
- **Operational Safety:**  
  Admins can safely update mappings, back up data, and restore if needed—no risk of accidental data loss.
- **Security & Control:**  
  Only authenticated admins can change mappings. Sessions are signed and time-limited.
- **Scalability:**  
  The system is serverless and globally distributed, so it can handle any scale of user traffic with no performance bottlenecks.

## How to Test
- **QR Code:**  
  Scan a sample QR code or visit a short URL. You’ll be redirected to the correct destination, or shown a not-found message with auto-forward.
- **Admin Console:**  
  Log in at `https://cpr.evx.tech/admin` to manage mappings, export/import CSV, and change the admin password. All changes are instant.

---
# EVX QR Redirector: Executive & Technical Overview

## What is it?
The EVX QR Redirector is a Cloudflare Worker that ensures QR code and short-link URLs for EVX charging stations always resolve to the correct destination, regardless of how users access them. It provides a seamless, reliable experience for drivers and enables flexible, future-proof management for the business.

It also includes a secure, lightweight admin console to manage chargerID→URL overrides in real time via Cloudflare KV, so business users can add, update, or remove mappings without code changes.

## How does it work?
- **Smart Redirection:**
  - When a user scans a QR code or visits a short URL like `https://cpr.evx.tech/public/cs/20501B`, the Worker intercepts the request.
  - It checks that the request is for the correct host and that it matches the expected pattern for a charger ID.
  - If valid, it instantly redirects the user to the main app URL (`https://cp.evx.tech/public/cs/qr`) with a unique identifier for the charger embedded in the query string (e.g., `evseid=AU*EVX*20501B`).

- **Loop & Error Protection:**
  - The Worker will not redirect if the request is already for the QR endpoint or if the special identifier is already present, preventing infinite loops and unnecessary processing.
  - Invalid or malformed requests are safely ignored or return a simple error, ensuring only legitimate traffic is processed.

- **Admin Console & Dynamic Mappings:**
  - Authenticated admins can visit `https://cpr.evx.tech/admin` to view and manage chargerID→URL mappings stored in Cloudflare KV.
  - The console supports filtering, Add/Update/Delete operations, and applies changes instantly worldwide.
  - Login is handled server-side (`/login`) and uses a stateless HMAC-signed session cookie for reliability.

## Why is this valuable?
- **Business Reliability:**
  - QR codes and short links printed on hardware or signage will always work, even if the backend or app URLs change in the future.
  - No need to reprint or update codes—just update the redirect logic if business needs change.

- **Security & Control:**
  - Only valid, expected requests are processed. All others are ignored, reducing risk of abuse.
  - Admin access requires username and password; sessions are signed and time-limited. Logic and mappings are managed centrally in Cloudflare, so changes are instant and global.

- **Scalability:**
  - The system is serverless and globally distributed, so it can handle any scale of user traffic with no performance bottlenecks.


## Example QR Code & How to Test

Below is a sample QR code that demonstrates the redirector in action:

![Sample QR Code](./qr_code_sample.png)

**How to test:**
1. Open your smartphone camera or a QR code scanning app.
2. Scan the QR code above.
3. The code will open a URL in the format: `https://cpr.evx.tech/public/cs/20501B` (or similar, depending on the QR code data).
4. The redirector will automatically forward you to:
  - `https://cp.evx.tech/public/cs/qr?evseid=AU*EVX*20501B`
5. Confirm that the final URL in your browser matches the expected format and that the page loads successfully.

### How to test the Admin Console
1. Open `https://cpr.evx.tech/admin` and log in with your admin credentials.
2. Use the filter to narrow keys; press Enter to refresh the list.
3. Add a mapping by entering a Charger ID and Target URL, then click Add Mapping.
4. Click Edit on an existing mapping to prefill and Update Mapping.
5. Delete mappings as needed; changes take effect immediately in production.

**Note:**
- If you want to test with other charger IDs, simply change the last part of the URL before scanning or entering it in your browser.
- The redirector will only process valid charger IDs and will not redirect if the URL is already in the QR format or contains the special identifier.

This approach ensures a seamless experience for drivers and maximum operational flexibility for EVX.
